import { useState } from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { api, qs, useApi } from "../api.js";
import { Card, Chips, Disclaimer, Drawer, Empty, ErrorNote, Factors, Gauge, Recommendations, RiskBadge, Skeleton, fmt } from "../components/ui.jsx";
import { useApp } from "../context.jsx";

function Detail({ id, onClose, onDeleted }) {
  const { data, error } = useApi(`/predictions/${id}`);
  const { meta, toast, user } = useApp();
  const remove = async () => {
    if (!confirm(`Delete prediction #${id}?`)) return;
    try { await api(`/predictions/${id}`, { method: "DELETE" }); toast("Prediction deleted"); onDeleted(); } catch (e) { toast(e.message, "err"); }
  };
  return (
    <Drawer title={`Prediction #${id}`} onClose={onClose}>
      {error && <ErrorNote error={error} />}
      {!data && !error && <Skeleton h={260} />}
      {data && (
        <>
          <p className="small muted">{data.customer_ref ? `Customer ${data.customer_ref} · ` : ""}{data.created_at} UTC</p>
          {data.result ? <div className="card" style={{ animation: "none", display: "grid", gap: 14 }}>
            <Gauge score={data.churn_probability} level={data.risk_level} thresholds={meta?.thresholds} />
            <h3>Main factors</h3><Factors factors={data.result.top_factors} />
          </div> : <div className="callout">This older prediction was saved without factor details.</div>}
          <div className="card" style={{ animation: "none" }}><h3 style={{ marginBottom: 6 }}>Suggested actions</h3><Recommendations items={data.recommendations} /></div>
          <div className="card" style={{ animation: "none" }}>
            <h3 style={{ marginBottom: 10 }}>Input</h3>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              {Object.entries(data.input).map(([k, v]) => <div key={k}><div className="small muted">{k}</div><b>{String(v)}</b></div>)}
            </div>
          </div>
          <Disclaimer />
          <button className="btn danger" onClick={remove}><Trash2 size={16} />Delete this prediction</button>
        </>
      )}
    </Drawer>
  );
}

export default function History() {
  const [risk, setRisk] = useState([]);
  const [open, setOpen] = useState(null);
  const { toast, user } = useApp();
  const { data, error, loading, reload } = useApi(`/predictions${qs({ risk: risk[0] })}`);
  const clearAll = async () => {
    if (!confirm("Delete ALL saved predictions? This cannot be undone.")) return;
    try { const r = await api("/predictions", { method: "DELETE" }); toast(`Deleted ${r.deleted} predictions`); reload(); } catch (e) { toast(e.message, "err"); }
  };
  return (
    <div className="page">
      <Card title="Saved predictions" subtitle={data ? `${fmt(data.total)} stored in the database. Click a row to see the full explanation.` : undefined}
        actions={<div className="chips">{user.role === "admin" && <button className="btn sm danger" onClick={clearAll} disabled={!data?.total}><Trash2 size={14} />Clear all</button>}</div>}>
        <div className="filter-row" style={{ marginBottom: 14 }}><span className="lbl">Risk</span><Chips options={["Low", "Medium", "High"]} selected={risk} onToggle={(v) => setRisk((r) => (r[0] === v ? [] : [v]))} /></div>
        {error && <ErrorNote error={error} retry={reload} />}
        {!data && loading && <Skeleton h={300} />}
        {data && !data.rows.length && <Empty icon={HistoryIcon} title="No predictions yet">Make one on the Predict page and it will appear here.</Empty>}
        {data && data.rows.length > 0 && (
          <div className="tbl-wrap"><table>
            <thead><tr><th>#</th><th>Customer</th><th className="hide-sm">When (UTC)</th><th className="hide-sm">Contract</th><th className="r hide-sm">Tenure</th><th className="r">Monthly</th><th className="r">Score</th><th>Risk</th></tr></thead>
            <tbody>{data.rows.map((r) => (
              <tr key={r.id} className="click" tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(r.id)}>
                <td className="num">{r.id}</td><td>{r.ref || <span className="muted">-</span>}</td><td className="hide-sm small">{r.createdAt}</td><td className="hide-sm">{r.contract}</td>
                <td className="r num hide-sm">{r.tenure}</td><td className="r num">{fmt(r.monthly, 2)}</td><td className="r num">{(r.score * 100).toFixed(1)}%</td><td><RiskBadge level={r.risk} /></td></tr>))}
            </tbody>
          </table></div>
        )}
      </Card>
      {open && <Detail id={open} onClose={() => setOpen(null)} onDeleted={() => { setOpen(null); reload(); }} />}
    </div>
  );
}
