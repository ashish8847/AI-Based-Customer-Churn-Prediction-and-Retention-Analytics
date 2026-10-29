import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "churn-api-"));
const tmpDb = path.join(tmp, "churn.db");
fs.copyFileSync(path.join(config.dbPath), tmpDb);
process.env.CHURN_DB_PATH = tmpDb;

const { createApp } = await import("../app.js");
const { openDb } = await import("../db.js");
const { MlWorker } = await import("../worker.js");

const CUSTOMER = {
  gender: "Male", SeniorCitizen: "No", Partner: "No", Dependents: "No", tenure: 3, PhoneService: "Yes",
  MultipleLines: "No", InternetService: "Fiber optic", OnlineSecurity: "No", OnlineBackup: "No",
  DeviceProtection: "No", TechSupport: "No", StreamingTV: "Yes", StreamingMovies: "Yes",
  Contract: "Month-to-month", PaperlessBilling: "Yes", PaymentMethod: "Electronic check",
  MonthlyCharges: 95.5, TotalCharges: null,
};

let server, base, worker, token;
const call = async (url, opts = {}) => {
  const res = await fetch(base + url, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
};

before(async () => {
  const db = openDb(tmpDb);
  worker = new MlWorker();
  await worker.start();
  server = createApp({ db, worker }).listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => { worker.stop(); server.close(); });

describe("authentication", () => {
  it("rejects requests without a token", async () => assert.equal((await call("/dashboard")).status, 401));
  it("rejects wrong password", async () => assert.equal((await call("/auth/login", { method: "POST", body: { username: "admin", password: "nope" } })).status, 401));
  it("logs in with demo credentials", async () => {
    const r = await call("/auth/login", { method: "POST", body: { username: "admin", password: "admin123" } });
    assert.equal(r.status, 200);
    token = r.body.token;
    assert.ok(token);
  });
});

describe("dashboard and customers", () => {
  it("returns KPIs matching the dataset", async () => {
    const { body } = await call("/dashboard");
    assert.equal(body.kpis.total, 7043);
    assert.equal(body.kpis.churned, 1869);
    assert.equal(body.kpis.churnRate, 26.54);
    assert.equal(body.byContract.find((r) => r.label === "Month-to-month").rate, 42.71);
  });
  it("applies filters", async () => {
    const { body } = await call("/dashboard?contract=Two%20year");
    assert.ok(body.kpis.total < 7043);
    assert.equal(body.byContract.length, 1);
  });
  it("paginates, sorts and searches customers", async () => {
    const { body } = await call("/customers?page=2&pageSize=10&sort=monthly_charges&dir=desc");
    assert.equal(body.rows.length, 10);
    assert.ok(body.rows[0].monthly >= body.rows[9].monthly);
    const s = await call("/customers?search=7590");
    assert.equal(s.body.rows[0].id, "7590-VHVEG");
  });
  it("ignores an unsafe sort value", async () => {
    const r = await call("/customers?sort=tenure;DROP%20TABLE%20customers");
    assert.equal(r.status, 200);
  });
  it("returns 404 for an unknown customer", async () => assert.equal((await call("/customers/NOPE")).status, 404));
});

describe("prediction", () => {
  it("scores and stores a prediction", async () => {
    const r = await call("/predict", { method: "POST", body: { customer: CUSTOMER, customerRef: "T-1" } });
    assert.equal(r.status, 201);
    assert.equal(r.body.risk_level, "High");
    assert.ok(r.body.top_factors.length > 0 && r.body.recommendations.length > 0);
    const d = await call(`/predictions/${r.body.predictionId}`);
    assert.equal(d.body.ref ?? d.body.customer_ref, "T-1");
    assert.ok(d.body.recommendations.length > 0);
    assert.equal((await call(`/predictions/${r.body.predictionId}`, { method: "DELETE" })).status, 200);
  });
  it("returns 422 with messages for invalid input", async () => {
    const r = await call("/predict", { method: "POST", body: { customer: { ...CUSTOMER, tenure: -3 } } });
    assert.equal(r.status, 422);
    assert.ok(r.body.messages.length > 0);
  });
  it("what-if responds without saving", async () => {
    const before = (await call("/predictions")).body.total;
    const r = await call("/whatif", { method: "POST", body: { customer: { ...CUSTOMER, Contract: "Two year" } } });
    assert.ok(r.body.churn_probability < 0.6);
    assert.equal((await call("/predictions")).body.total, before);
  });
  it("analyses a stored customer", async () => {
    const r = await call("/customers/7590-VHVEG/analyze", { method: "POST" });
    assert.equal(r.status, 200);
    assert.ok(r.body.top_factors);
  });
  it("serves sample rows that can be batch scored", async () => {
    const sample = await call("/batch/sample?n=5");
    assert.equal(sample.body.rows.length, 5);
    const r = await call("/batch", { method: "POST", body: { rows: sample.body.rows } });
    assert.equal(r.body.scored.length, 5);
    assert.equal(r.body.errors.length, 0);
  });
  it("scores a batch and reports bad rows", async () => {
    const r = await call("/batch", { method: "POST", body: { rows: [{ customerID: "A", ...CUSTOMER }, { customerID: "B", ...CUSTOMER, Contract: "Weekly" }] } });
    assert.equal(r.body.scored.length, 1);
    assert.equal(r.body.errors[0].customerID, "B");
  });
});

describe("retention workflow", () => {
  it("lists the high-risk active queue", async () => {
    const { body } = await call("/retention/queue?pageSize=5");
    assert.equal(body.rows.length, 5);
    assert.ok(body.rows.every((r) => r.risk === "High"));
  });
  it("updates and filters case status", async () => {
    const q = (await call("/retention/queue?pageSize=5")).body.rows[0];
    const p = await call(`/retention/cases/${q.id}`, { method: "PATCH", body: { status: "Contacted", note: "Called" } });
    assert.equal(p.status, 200);
    const f = await call("/retention/queue?caseStatus=Contacted");
    assert.ok(f.body.rows.some((r) => r.id === q.id && r.note === "Called"));
  });
  it("rejects an invalid status", async () => {
    const r = await call("/retention/cases/7590-VHVEG", { method: "PATCH", body: { status: "Whatever" } });
    assert.equal(r.status, 400);
  });
  it("exports CSV", async () => {
    const r = await call("/retention/export.csv");
    assert.match(r.body, /^id,contract/);
  });
  it("computes segments", async () => {
    const { body } = await call("/retention/segments");
    const combo = body.segments.find((s) => s.name.includes("Fiber + E-check"));
    assert.equal(combo.customers, 1307);
    assert.equal(combo.rate, 60.37);
  });
});

describe("models", () => {
  it("returns comparison tables", async () => {
    const { body } = await call("/models");
    assert.equal(body.comparison.length, 5);
    assert.equal(body.summary.selected_model, "XGBoost");
  });
});
