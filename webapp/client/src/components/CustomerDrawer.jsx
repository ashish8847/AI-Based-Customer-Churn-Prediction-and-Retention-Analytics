import { useState } from "react";
import { Brain, Save } from "lucide-react";
import { api, useApi } from "../api.js";
import { useApp } from "../context.jsx";
import { Disclaimer, Drawer, ErrorNote, Factors, Gauge, Recommendations, RiskBadge, Skeleton, fmt } from "./ui.jsx";

export const CASE_STATUSES = ["New", "Contacted", "Offer sent", "Retained", "Lost"];

export default function CustomerDrawer({ id, onClose, onChanged }) {
  const { data: c, error, reload } = useApi(`/customers/${encodeURIComponent(id)}`);
  const { meta, toast } = useApp();
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [note, setNote] = useState(null);

  const analyze = async () => {
    setBusy(true);
    try { setAnalysis(await api(`/customers/${encodeURIComponent(id)}/analyze`, { method: "POST" })); } catch (e) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const save = async () => {
    try {
      await api(`/retention/cases/${encodeURIComponent(id)}`, { method: "PATCH", body: { status: status ?? c.caseStatus ?? "New", note: note ?? c.caseNote ?? "" } });
      toast("Retention case updated"); reload(); onChanged?.();
    } catch (e) { toast(e.message, "err"); }
  };

  const rows = c && [
    ["Contract", c.contract], ["Tenure", `${c.tenure} months`], ["Internet", c.internet_service], ["Payment", c.payment_method],
    ["Monthly charges", fmt(c.monthly_charges, 2)], ["Total charges", fmt(c.total_charges, 2)], ["Tech support", c.tech_support], ["Online security", c.online_security],
    ["Paperless billing", c.paperless_billing], ["Senior citizen", c.senior_citizen], ["Partner", c.partner], ["Dependents", c.dependents],
  ];

  return (
    <Drawer title={`Customer ${id}`} onClose={onClose}>
      {error && <ErrorNote error={error} />}
      {!c && !error && <><Skeleton h={90} /><Skeleton h={220} /></>}
      {c && (
        <>
          <div className="chips"><RiskBadge level={c.risk} />
            <span className={`badge status ${c.churn ? "Lost" : "Retained"}`}>{c.churn ? "Churned" : "Active"}</span>
            {c.score != null && <span className="small muted num">stored score {(c.score * 100).toFixed(1)}%</span>}</div>
          <div className="card" style={{ animation: "none" }}>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {rows.map(([k, v]) => <div key={k}><div className="small muted">{k}</div><b>{v}</b></div>)}
            </div>
          </div>
          <button className="btn dark" onClick={analyze} disabled={busy}><Brain size={17} />{busy ? "Analyzing..." : analysis ? "Re-run analysis" : "Explain with the model"}</button>
          {analysis && (
            <div className="card" style={{ animation: "none", display: "grid", gap: 14 }}>
              <Gauge score={analysis.churn_probability} level={analysis.risk_level} thresholds={meta?.thresholds} />
              <h3>Main factors</h3><Factors factors={analysis.top_factors} />
              <h3>Suggested actions</h3><Recommendations items={analysis.recommendations} />
              <Disclaimer />
            </div>
          )}
          {!c.churn && (
            <div className="card" style={{ animation: "none", display: "grid", gap: 12 }}>
              <h3>Retention case</h3>
              <div className="field"><label htmlFor="cs">Status</label>
                <select id="cs" className="select" value={status ?? c.caseStatus ?? "New"} onChange={(e) => setStatus(e.target.value)}>{CASE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="field"><label htmlFor="cn">Note</label><textarea id="cn" rows={3} maxLength={500} value={note ?? c.caseNote ?? ""} onChange={(e) => setNote(e.target.value)} placeholder="What was discussed or offered?" /></div>
              <button className="btn primary" onClick={save}><Save size={16} />Save case</button>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
