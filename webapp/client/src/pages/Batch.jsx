import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Download, FileSpreadsheet, FlaskConical, UploadCloud } from "lucide-react";
import { ApiError, api } from "../api.js";
import { RiskDonut } from "../components/charts.jsx";
import { Card, ErrorNote, Pager, RiskBadge, fmt } from "../components/ui.jsx";
import { useApp } from "../context.jsx";

const FEATURES = ["customerID", "gender", "SeniorCitizen", "Partner", "Dependents", "tenure", "PhoneService", "MultipleLines", "InternetService", "OnlineSecurity", "OnlineBackup", "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies", "Contract", "PaperlessBilling", "PaymentMethod", "MonthlyCharges", "TotalCharges"];
const EXAMPLE = ["EXAMPLE-1", "Male", "No", "No", "No", 3, "Yes", "No", "Fiber optic", "No", "No", "No", "No", "Yes", "Yes", "Month-to-month", "Yes", "Electronic check", 95.5, ""];

function normalize(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k.trim()] = typeof v === "string" ? v.trim() : v;
  if (out.SeniorCitizen === "0" || out.SeniorCitizen === 0) out.SeniorCitizen = "No";
  if (out.SeniorCitizen === "1" || out.SeniorCitizen === 1) out.SeniorCitizen = "Yes";
  ["tenure", "MonthlyCharges", "TotalCharges"].forEach((k) => { if (out[k] === "" || out[k] == null) out[k] = k === "TotalCharges" ? null : ""; else if (!Number.isNaN(Number(out[k]))) out[k] = Number(out[k]); });
  return out;
}

export default function Batch() {
  const { toast } = useApp();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const input = useRef();

  const score = async (rows, name) => {
    setBusy(true); setError(null); setResult(null); setPage(1);
    try {
      const r = await api("/batch", { method: "POST", body: { rows } });
      r.scored.sort((a, b) => b.churn_probability - a.churn_probability);
      setResult({ ...r, name, total: rows.length });
      toast(`Scored ${r.scored.length} of ${rows.length} rows`);
    } catch (e) { setError(e instanceof ApiError ? e : new Error(e.message)); } finally { setBusy(false); }
  };
  const readFile = (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { setError(new Error("Please choose a .csv file")); return; }
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => (r.data.length ? score(r.data.map(normalize), file.name) : setError(new Error("The file has no data rows"))), error: (e) => setError(new Error(e.message)) });
  };
  const sample = async () => { const r = await api("/batch/sample?n=60"); score(r.rows, "60 active customers from the database"); };
  const template = () => {
    const blob = new Blob([Papa.unparse({ fields: FEATURES, data: [EXAMPLE] })], { type: "text/csv" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "batch_template.csv" }).click();
  };
  const exportResults = () => {
    const blob = new Blob([Papa.unparse(result.scored.map((r) => ({ customerID: r.customerID, risk_score: r.churn_probability, risk_level: r.risk_level, predicted_churn: r.predicted_churn, tenure: r.tenure, contract: r.contract, monthly_charges: r.monthly_charges })))], { type: "text/csv" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "scored_customers.csv" }).click();
  };

  const dist = useMemo(() => result && ["Low", "Medium", "High"].map((level) => ({ level, customers: result.scored.filter((r) => r.risk_level === level).length, actualRate: "-" })).filter((d) => d.customers), [result]);
  const pageSize = 12;
  const pages = result ? Math.max(1, Math.ceil(result.scored.length / pageSize)) : 1;

  return (
    <div className="page">
      <Card title="Score many customers at once" subtitle="Upload a CSV with the same columns as the Telco dataset. Each row is validated, then scored by the saved model.">
        <div className={`dropzone ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files[0]); }}>
          <UploadCloud size={38} color="var(--gold)" />
          <b>{busy ? "Scoring..." : "Drag a CSV here"}</b>
          <span className="small muted">or choose a file. Up to 2,000 rows. Nothing is stored.</span>
          <div className="chips" style={{ justifyContent: "center" }}>
            <button className="btn primary" disabled={busy} onClick={() => input.current.click()}><FileSpreadsheet size={17} />Choose CSV</button>
            <button className="btn ghost" disabled={busy} onClick={sample}><FlaskConical size={17} />Try sample data</button>
            <button className="btn ghost" onClick={template}><Download size={17} />Template</button>
          </div>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
      </Card>
      {error && <ErrorNote error={error} />}
      {result && (
        <>
          <div className="grid g-2">
            <Card i={0} title="Summary" subtitle={result.name}>
              <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div><div className="small muted">Rows read</div><b className="num" style={{ fontSize: "1.6rem" }}>{fmt(result.total)}</b></div>
                <div><div className="small muted">Scored</div><b className="num" style={{ fontSize: "1.6rem", color: "var(--low)" }}>{fmt(result.scored.length)}</b></div>
                <div><div className="small muted">Rejected</div><b className="num" style={{ fontSize: "1.6rem", color: result.errors.length ? "var(--high)" : "inherit" }}>{fmt(result.errors.length)}</b></div>
              </div>
              <button className="btn dark" style={{ marginTop: 16 }} onClick={exportResults} disabled={!result.scored.length}><Download size={16} />Download scored CSV</button>
            </Card>
            {dist.length > 0 && <Card i={1} title="Risk mix"><RiskDonut data={dist} height={190} /></Card>}
          </div>
          {result.scored.length > 0 && (
            <Card i={2} title="Highest-risk rows first">
              <div className="tbl-wrap"><table>
                <thead><tr><th>Customer</th><th className="hide-sm">Contract</th><th className="r hide-sm">Tenure</th><th className="r">Monthly</th><th>Risk score</th><th>Risk</th></tr></thead>
                <tbody>{result.scored.slice((page - 1) * pageSize, page * pageSize).map((r) => (
                  <tr key={r.row}><td><b>{r.customerID || `Row ${r.row}`}</b></td><td className="hide-sm">{r.contract}</td><td className="r num hide-sm">{r.tenure}</td><td className="r num">{fmt(r.monthly_charges, 2)}</td>
                    <td><div className="bar-cell"><div className="bar-track"><div className="bar-fill" style={{ width: `${r.churn_probability * 100}%` }} /></div><span className="num small">{(r.churn_probability * 100).toFixed(0)}</span></div></td><td><RiskBadge level={r.risk_level} /></td></tr>))}
                </tbody>
              </table></div>
              <Pager page={page} pages={pages} total={result.scored.length} pageSize={pageSize} onPage={setPage} />
            </Card>
          )}
          {result.errors.length > 0 && (
            <Card i={3} title="Rows that could not be scored" subtitle="Fix these in your file and upload again">
              {result.errors.slice(0, 20).map((e) => <div className="rec" key={e.row}><div className="dot" style={{ background: "var(--high-bg)", color: "var(--high)" }}>{e.row}</div><div><b>{e.customerID || `Row ${e.row}`}</b><p className="small muted">{e.messages.join(" ")}</p></div></div>)}
              {result.errors.length > 20 && <p className="small muted">...and {result.errors.length - 20} more.</p>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
