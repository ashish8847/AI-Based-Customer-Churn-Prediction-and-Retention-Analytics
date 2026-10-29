import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { checkPassword, requireAdmin, requireAuth, signToken } from "./auth.js";
import { config } from "./config.js";
import { rowToFeatures } from "./db.js";

const RISKS = ["Low", "Medium", "High"];
const CASE_STATUSES = ["New", "Contacted", "Offer sent", "Retained", "Lost"];
const FILTER_COLUMNS = {
  contract: "c.contract", internet: "c.internet_service", payment: "c.payment_method", risk: "r.risk_level",
};
const BASE = "FROM customers c LEFT JOIN customer_risk r ON r.customer_id = c.customer_id";
const TENURE_CASE = "CASE WHEN c.tenure <= 12 THEN '0-12' WHEN c.tenure <= 24 THEN '13-24' WHEN c.tenure <= 48 THEN '25-48' ELSE '49-72' END";
const BAND_CASE = "CASE WHEN c.monthly_charges <= 35 THEN 'Up to 35' WHEN c.monthly_charges <= 70 THEN '35-70' WHEN c.monthly_charges <= 90 THEN '70-90' ELSE 'Above 90' END";

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);

function buildWhere(query, extra = []) {
  const clauses = [...extra];
  const params = [];
  for (const [key, column] of Object.entries(FILTER_COLUMNS)) {
    const values = list(query[key]);
    if (values.length) {
      clauses.push(`${column} IN (${values.map(() => "?").join(",")})`);
      params.push(...values);
    }
  }
  const status = list(query.status);
  if (status.length === 1) clauses.push(`c.churn = ${status[0] === "Churned" ? 1 : 0}`);
  if (query.search) { clauses.push("c.customer_id LIKE ?"); params.push(`%${String(query.search).slice(0, 30)}%`); }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function parseCsvFile(file) {
  if (!fs.existsSync(file)) return [];
  const [head, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, isNaN(Number(cells[i])) || cells[i] === "" ? cells[i] : Number(cells[i])]));
  });
}

export function createApp({ db, worker }) {
  const app = express();
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "3mb" }));

  const api = express.Router();

  const loginLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  api.post("/auth/login", loginLimiter, (req, res) => {
    const { username, password } = req.body || {};
    const user = typeof username === "string" && db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user || typeof password !== "string" || !checkPassword(password, user.password_hash))
      return res.status(401).json({ error: "Invalid username or password" });
    res.json({ token: signToken(user), user: { username: user.username, role: user.role } });
  });

  api.get("/health", (_req, res) => res.json({ ok: true }));
  api.use(requireAuth);
  api.get("/auth/me", (req, res) => res.json({ username: req.user.username, role: req.user.role }));

  let metaCache = null;
  api.get("/meta", wrap(async (_req, res) => {
    metaCache ||= await worker.call("meta");
    res.json(metaCache);
  }));

  api.get("/dashboard", (req, res) => {
    const w = buildWhere(req.query);
    const one = (sql) => db.prepare(sql).get(...w.params);
    const rates = (expr, order) => db.prepare(
      `SELECT ${expr} AS label, COUNT(*) AS customers, SUM(c.churn) AS churned,
              ROUND(100.0 * SUM(c.churn) / COUNT(*), 2) AS rate ${BASE} ${w.sql} GROUP BY label ORDER BY ${order}`
    ).all(...w.params);

    const kpis = one(`SELECT COUNT(*) AS total, COALESCE(SUM(c.churn),0) AS churned,
        ROUND(AVG(c.monthly_charges),2) AS avgMonthly, ROUND(AVG(c.tenure),1) AS avgTenure,
        ROUND(AVG(r.churn_probability),3) AS avgScore,
        COALESCE(SUM(CASE WHEN c.churn = 0 AND r.risk_level = 'High' THEN 1 ELSE 0 END),0) AS highRiskActive,
        ROUND(COALESCE(SUM(CASE WHEN c.churn = 0 AND r.risk_level = 'High' THEN c.monthly_charges ELSE 0 END),0),2) AS revenueAtRisk,
        ROUND(COALESCE(SUM(CASE WHEN c.churn = 0 THEN c.monthly_charges ELSE 0 END),0),2) AS activeRevenue,
        ROUND(COALESCE(SUM(CASE WHEN c.churn = 1 THEN c.monthly_charges ELSE 0 END),0),2) AS lostRevenue ${BASE} ${w.sql}`);
    const overall = db.prepare("SELECT ROUND(100.0 * SUM(churn) / COUNT(*), 2) AS rate FROM customers").get();
    kpis.churnRate = kpis.total ? Math.round((10000 * kpis.churned) / kpis.total) / 100 : 0;
    kpis.overallRate = overall.rate;

    const curve = db.prepare(
      `SELECT MAX(1, (c.tenure + 5) / 6) AS bucket, COUNT(*) AS customers,
              ROUND(100.0 * SUM(c.churn) / COUNT(*), 2) AS rate ${BASE} ${w.sql} GROUP BY bucket ORDER BY bucket`
    ).all(...w.params).map((r) => ({ ...r, label: `${(r.bucket - 1) * 6 + 1}-${r.bucket * 6}` }));

    res.json({
      kpis,
      byContract: rates("c.contract", "rate DESC"),
      byTenure: rates(TENURE_CASE, "MIN(c.tenure)"),
      byPayment: rates("c.payment_method", "rate DESC"),
      byInternet: rates("c.internet_service", "rate DESC"),
      byChargeBand: rates(BAND_CASE, "MIN(c.monthly_charges)"),
      tenureCurve: curve,
      riskDistribution: db.prepare(
        `SELECT COALESCE(r.risk_level,'Unscored') AS level, COUNT(*) AS customers,
                ROUND(AVG(r.churn_probability),3) AS avgScore,
                ROUND(100.0 * SUM(c.churn) / COUNT(*), 2) AS actualRate ${BASE} ${w.sql}
         GROUP BY level ORDER BY avgScore`).all(...w.params),
      revenueByRisk: db.prepare(
        `SELECT r.risk_level AS level, COUNT(*) AS customers, ROUND(SUM(c.monthly_charges),2) AS revenue
         ${BASE} ${buildWhere(req.query, ["c.churn = 0", "r.risk_level IS NOT NULL"]).sql}
         GROUP BY level ORDER BY CASE level WHEN 'Low' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END`
      ).all(...buildWhere(req.query, ["c.churn = 0"]).params),
      topSegments: db.prepare(
        `SELECT c.contract, c.internet_service AS internet, c.payment_method AS payment, COUNT(*) AS customers,
                ROUND(100.0 * SUM(c.churn) / COUNT(*), 2) AS rate ${BASE} ${w.sql}
         GROUP BY c.contract, c.internet_service, c.payment_method HAVING COUNT(*) >= 80
         ORDER BY rate DESC LIMIT 6`).all(...w.params),
    });
  });

  const SORTS = { customer_id: "c.customer_id", tenure: "c.tenure", monthly_charges: "c.monthly_charges",
    total_charges: "c.total_charges", score: "r.churn_probability" };
  api.get("/customers", (req, res) => {
    const w = buildWhere(req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize) || 15));
    const sort = SORTS[req.query.sort] || SORTS.customer_id;
    const dir = req.query.dir === "desc" ? "DESC" : "ASC";
    const total = db.prepare(`SELECT COUNT(*) AS n ${BASE} ${w.sql}`).get(...w.params).n;
    const rows = db.prepare(
      `SELECT c.customer_id AS id, c.contract, c.tenure, c.internet_service AS internet, c.payment_method AS payment,
              c.monthly_charges AS monthly, c.total_charges AS total, c.churn,
              r.churn_probability AS score, r.risk_level AS risk, rc.status AS caseStatus
       ${BASE} LEFT JOIN retention_cases rc ON rc.customer_id = c.customer_id ${w.sql}
       ORDER BY ${sort} ${dir}, c.customer_id LIMIT ? OFFSET ?`
    ).all(...w.params, pageSize, (page - 1) * pageSize);
    res.json({ rows, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  });

  api.get("/customers/:id", (req, res) => {
    const row = db.prepare(
      `SELECT c.*, r.churn_probability AS score, r.risk_level AS risk, rc.status AS caseStatus, rc.note AS caseNote
       ${BASE} LEFT JOIN retention_cases rc ON rc.customer_id = c.customer_id WHERE c.customer_id = ?`
    ).get(req.params.id);
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json(row);
  });

  api.post("/customers/:id/analyze", wrap(async (req, res) => {
    const row = db.prepare("SELECT * FROM customers WHERE customer_id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json(await worker.call("predict", rowToFeatures(row)));
  }));

  const validationAware = (err, res) => {
    if (err.type === "validation") return res.status(422).json({ error: "Please correct the highlighted details", messages: err.messages });
    throw err;
  };

  api.post("/predict", wrap(async (req, res) => {
    const { customer, customerRef } = req.body || {};
    if (!customer || typeof customer !== "object") return res.status(400).json({ error: "customer object is required" });
    let result;
    try { result = await worker.call("predict", customer); } catch (e) { return validationAware(e, res); }
    const c = result.customer;
    const id = db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO predictions (customer_ref, input_json, tenure, contract, monthly_charges, churn_probability,
                                  predicted_churn, risk_level, result_json) VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(customerRef ? String(customerRef).slice(0, 30) : null, JSON.stringify(c), Math.round(c.tenure), c.Contract,
        c.MonthlyCharges, result.churn_probability, result.predicted_churn ? 1 : 0, result.risk_level, JSON.stringify(result));
      const ins = db.prepare("INSERT INTO recommendations (prediction_id, action, reason) VALUES (?,?,?)");
      for (const r of result.recommendations) ins.run(info.lastInsertRowid, r.action, r.reason);
      return info.lastInsertRowid;
    })();
    res.status(201).json({ ...result, predictionId: Number(id) });
  }));

  api.post("/whatif", wrap(async (req, res) => {
    const { customer } = req.body || {};
    if (!customer || typeof customer !== "object") return res.status(400).json({ error: "customer object is required" });
    try { res.json(await worker.call("whatif", customer)); } catch (e) { validationAware(e, res); }
  }));

  api.post("/batch", wrap(async (req, res) => {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: "rows array is required" });
    if (rows.length > 2000) return res.status(413).json({ error: "Please upload at most 2000 rows at a time" });
    res.json(await worker.call("batch", { rows }, 120000));
  }));

  api.get("/batch/sample", (req, res) => {
    const n = Math.min(200, Math.max(1, parseInt(req.query.n) || 50));
    const rows = db.prepare("SELECT * FROM customers WHERE churn = 0 ORDER BY customer_id LIMIT ?").all(n)
      .map((r) => ({ customerID: r.customer_id, ...rowToFeatures(r) }));
    res.json({ rows });
  });

  api.get("/predictions", (req, res) => {
    const limit = Math.min(500, parseInt(req.query.limit) || 200);
    const risk = RISKS.includes(req.query.risk) ? req.query.risk : null;
    const rows = db.prepare(
      `SELECT prediction_id AS id, customer_ref AS ref, created_at AS createdAt, tenure, contract,
              monthly_charges AS monthly, churn_probability AS score, risk_level AS risk
       FROM predictions ${risk ? "WHERE risk_level = ?" : ""} ORDER BY prediction_id DESC LIMIT ?`
    ).all(...(risk ? [risk, limit] : [limit]));
    res.json({ rows, total: db.prepare("SELECT COUNT(*) AS n FROM predictions").get().n });
  });

  api.get("/predictions/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM predictions WHERE prediction_id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Prediction not found" });
    const recommendations = db.prepare("SELECT action, reason FROM recommendations WHERE prediction_id = ?").all(row.prediction_id);
    res.json({ ...row, input: JSON.parse(row.input_json), result: row.result_json ? JSON.parse(row.result_json) : null, recommendations });
  });

  api.delete("/predictions/:id", (req, res) => {
    const info = db.prepare("DELETE FROM predictions WHERE prediction_id = ?").run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: "Prediction not found" });
    res.json({ deleted: info.changes });
  });
  api.delete("/predictions", requireAdmin, (_req, res) => res.json({ deleted: db.prepare("DELETE FROM predictions").run().changes }));

  const queueQuery = (query) => {
    const risks = list(query.risk).filter((r) => RISKS.includes(r));
    const w = buildWhere({ ...query, risk: (risks.length ? risks : ["High"]).join(",") }, ["c.churn = 0"]);
    const caseStatus = list(query.caseStatus).filter((s) => CASE_STATUSES.includes(s));
    if (caseStatus.length) {
      w.sql += ` AND COALESCE(rc.status,'New') IN (${caseStatus.map(() => "?").join(",")})`;
      w.params.push(...caseStatus);
    }
    return w;
  };
  const QUEUE_FROM = `${BASE} LEFT JOIN retention_cases rc ON rc.customer_id = c.customer_id`;
  const QUEUE_COLS = `c.customer_id AS id, c.contract, c.tenure, c.internet_service AS internet, c.payment_method AS payment,
      c.monthly_charges AS monthly, r.churn_probability AS score, r.risk_level AS risk,
      COALESCE(rc.status,'New') AS status, rc.note AS note, rc.updated_at AS updatedAt`;

  api.get("/retention/queue", (req, res) => {
    const w = queueQuery(req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize) || 12));
    const sort = { monthly: "c.monthly_charges", score: "r.churn_probability", tenure: "c.tenure" }[req.query.sort] || "r.churn_probability";
    const dir = req.query.dir === "asc" ? "ASC" : "DESC";
    const rows = db.prepare(`SELECT ${QUEUE_COLS} ${QUEUE_FROM} ${w.sql} ORDER BY ${sort} ${dir}, c.customer_id LIMIT ? OFFSET ?`)
      .all(...w.params, pageSize, (page - 1) * pageSize);
    const total = db.prepare(`SELECT COUNT(*) AS n ${QUEUE_FROM} ${w.sql}`).get(...w.params).n;
    const base = queueQuery({ ...req.query, caseStatus: "" });
    const summary = db.prepare(
      `SELECT COALESCE(rc.status,'New') AS status, COUNT(*) AS customers, ROUND(SUM(c.monthly_charges),2) AS revenue
       ${QUEUE_FROM} ${base.sql} GROUP BY status`).all(...base.params);
    res.json({ rows, total, page, pageSize, pages: Math.ceil(total / pageSize), summary, statuses: CASE_STATUSES });
  });

  api.get("/retention/export.csv", (req, res) => {
    const w = queueQuery(req.query);
    const rows = db.prepare(`SELECT ${QUEUE_COLS} ${QUEUE_FROM} ${w.sql} ORDER BY r.churn_probability DESC`).all(...w.params);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=retention_queue.csv");
    res.send(toCsv(rows));
  });

  api.patch("/retention/cases/:customerId", (req, res) => {
    const { status, note } = req.body || {};
    if (!CASE_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of ${CASE_STATUSES.join(", ")}` });
    if (note != null && String(note).length > 500) return res.status(400).json({ error: "note must be 500 characters or fewer" });
    if (!db.prepare("SELECT 1 FROM customers WHERE customer_id = ?").get(req.params.customerId))
      return res.status(404).json({ error: "Customer not found" });
    db.prepare(
      `INSERT INTO retention_cases (customer_id, status, note, updated_by, updated_at)
       VALUES (?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(customer_id) DO UPDATE SET status = excluded.status, note = excluded.note,
         updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`
    ).run(req.params.customerId, status, note ?? null, req.user.username);
    res.json({ customerId: req.params.customerId, status, note: note ?? null });
  });

  api.get("/retention/segments", (_req, res) => {
    const charges = db.prepare("SELECT monthly_charges AS m FROM customers ORDER BY m").all().map((r) => r.m);
    const p75 = quantile(charges, 0.75);
    const defs = [
      ["Month-to-month contract", "c.contract = 'Month-to-month'", []],
      ["Tenure 0-12 months", "c.tenure <= 12", []],
      ["Electronic check payment", "c.payment_method = 'Electronic check'", []],
      ["Fiber optic internet", "c.internet_service = 'Fiber optic'", []],
      ["No tech support (internet users)", "c.internet_service != 'No' AND c.tech_support = 'No'", []],
      ["Top 25% monthly charges", "c.monthly_charges >= ?", [p75]],
      ["Senior citizens", "c.senior_citizen = 'Yes'", []],
      ["Month-to-month + Fiber + E-check", "c.contract = 'Month-to-month' AND c.internet_service = 'Fiber optic' AND c.payment_method = 'Electronic check'", []],
      ["Two-year contract", "c.contract = 'Two year'", []],
    ];
    const totalChurn = db.prepare("SELECT SUM(churn) AS n FROM customers").get().n;
    const out = defs.map(([name, cond, params]) => {
      const r = db.prepare(
        `SELECT COUNT(*) AS customers, SUM(c.churn) AS churned,
                SUM(CASE WHEN c.churn = 0 AND r.risk_level = 'High' THEN 1 ELSE 0 END) AS activeAtRisk ${BASE} WHERE ${cond}`
      ).get(...params);
      return { name, customers: r.customers, churned: r.churned, rate: Math.round((10000 * r.churned) / r.customers) / 100,
        shareOfChurners: Math.round((10000 * r.churned) / totalChurn) / 100, activeAtRisk: r.activeAtRisk };
    }).sort((a, b) => b.rate - a.rate);
    res.json({ segments: out, p75 });
  });

  api.get("/models", (_req, res) => {
    const r = config.reportsDir;
    const summaryPath = path.join(r, "training_summary.json");
    res.json({
      summary: fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, "utf8")) : null,
      comparison: parseCsvFile(path.join(r, "model_comparison.csv")),
      imbalance: parseCsvFile(path.join(r, "imbalance_effect.csv")),
      thresholds: parseCsvFile(path.join(r, "threshold_analysis.csv")),
      importance: parseCsvFile(path.join(r, "permutation_importance.csv")).slice(0, 10),
      figures: ["13_model_comparison", "12_roc_curves", "11_confusion_matrices", "14_feature_importance"]
        .filter((f) => fs.existsSync(path.join(r, "figures", `${f}.png`))).map((f) => `/figures/${f}.png`),
    });
  });

  app.use("/api", api);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use("/figures", express.static(path.join(config.reportsDir, "figures"), { maxAge: "1h" }));

  if (fs.existsSync(path.join(config.clientDist, "index.html"))) {
    app.use(express.static(config.clientDist, { maxAge: "1h", index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(config.clientDist, "index.html")));
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server", detail: process.env.NODE_ENV === "production" ? undefined : err.message });
  });
  return app;
}
