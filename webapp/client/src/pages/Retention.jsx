import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, PhoneCall, Target, Trophy, UserX, Mail, Inbox } from "lucide-react";
import { api, download, qs, useApi } from "../api.js";
import CustomerDrawer, { CASE_STATUSES } from "../components/CustomerDrawer.jsx";
import { Card, Chips, Empty, ErrorNote, Pager, RiskBadge, Skeleton, compact, fmt } from "../components/ui.jsx";
import { useApp } from "../context.jsx";

const ICONS = { New: Inbox, Contacted: PhoneCall, "Offer sent": Mail, Retained: Trophy, Lost: UserX };

export default function Retention() {
  const { toast } = useApp();
  const [risk, setRisk] = useState(["High"]);
  const [caseStatus, setCaseStatus] = useState([]);
  const [sort, setSort] = useState("score");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const params = { risk, caseStatus, sort, page, pageSize: 12 };
  const { data, error, loading, reload } = useApi(`/retention/queue${qs(params)}`);
  const seg = useApi("/retention/segments");

  const setStatus = async (id, status) => {
    try { await api(`/retention/cases/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }); toast(`${id} marked ${status}`); reload(); } catch (e) { toast(e.message, "err"); }
  };
  const summary = Object.fromEntries((data?.summary || []).map((s) => [s.status, s]));
  const exportCsv = () => download(`/retention/export.csv${qs({ risk, caseStatus })}`, "retention_queue.csv").catch((e) => toast(e.message, "err"));

  return (
    <div className="page">
      <div className="grid g-kpi">
        {CASE_STATUSES.map((s, i) => {
          const Icon = ICONS[s];
          const on = caseStatus.includes(s);
          return (
            <button key={s} className="card kpi" aria-pressed={on} onClick={() => { setPage(1); setCaseStatus((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s])); }}
              style={{ "--i": i, textAlign: "left", cursor: "pointer", outline: on ? "3px solid var(--gold)" : "none" }}>
              <div className="label"><Icon size={15} />{s}</div>
              <div className="value num">{fmt(summary[s]?.customers || 0)}</div>
              <div className="sub">{compact(summary[s]?.revenue || 0)} monthly revenue</div>
            </button>);
        })}
      </div>

      <Card i={2} title="Retention queue" subtitle="Active customers ranked by churn risk. Update the status as your team works through them."
        actions={<div className="chips"><button className="btn sm ghost" onClick={exportCsv}><Download size={15} />Export CSV</button></div>}>
        <div className="filters" style={{ marginBottom: 14 }}>
          <div className="filter-row"><span className="lbl">Risk level</span><Chips options={["High", "Medium", "Low"]} selected={risk} onToggle={(v) => { setPage(1); setRisk((r) => (r.includes(v) ? (r.length > 1 ? r.filter((x) => x !== v) : r) : [...r, v])); }} /></div>
          <div className="filter-row"><span className="lbl">Sort by</span><Chips options={["score", "monthly", "tenure"]} selected={[sort]} onToggle={(v) => { setSort(v); setPage(1); }} /></div>
        </div>
        {error && <ErrorNote error={error} retry={reload} />}
        {!data && loading && <Skeleton h={380} />}
        {data && !data.rows.length && <Empty icon={Target} title="Nothing in this queue">Change the risk or status filters.</Empty>}
        {data && data.rows.length > 0 && (
          <div style={{ opacity: loading ? 0.6 : 1 }}>
            <div className="tbl-wrap"><table>
              <thead><tr><th>Customer</th><th className="hide-sm">Contract</th><th className="r">Monthly</th><th className="hide-sm">Score</th><th>Risk</th><th>Status</th></tr></thead>
              <tbody>{data.rows.map((r) => (
                <tr key={r.id}>
                  <td><button className="btn sm ghost" style={{ border: 0, padding: 0, fontWeight: 700 }} onClick={() => setOpen(r.id)}>{r.id}</button><div className="small muted hide-sm">{r.tenure} mo · {r.payment}</div></td>
                  <td className="hide-sm">{r.contract}</td><td className="r num">{fmt(r.monthly, 2)}</td>
                  <td className="hide-sm"><div className="bar-cell"><div className="bar-track"><div className="bar-fill" style={{ width: `${r.score * 100}%` }} /></div><span className="num small">{(r.score * 100).toFixed(0)}</span></div></td>
                  <td><RiskBadge level={r.risk} /></td>
                  <td><select className="select" style={{ padding: "6px 8px", minWidth: 118 }} value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} aria-label={`Status for ${r.id}`}>{CASE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                </tr>))}</tbody>
            </table></div>
            <Pager page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={setPage} />
          </div>
        )}
      </Card>

      <Card i={3} title="Where churn concentrates" subtitle="Segments overlap, so shares of churners add up to more than 100%. These are associations, not proven causes.">
        {seg.error && <ErrorNote error={seg.error} />}
        {!seg.data && <Skeleton h={300} />}
        {seg.data && (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Segment</th><th className="r hide-sm">Customers</th><th>Churn rate</th><th className="r hide-sm">Share of churners</th><th className="r">Active at risk</th></tr></thead>
            <tbody>{seg.data.segments.map((s) => (
              <tr key={s.name}><td><b>{s.name}</b></td><td className="r num hide-sm">{fmt(s.customers)}</td>
                <td><div className="bar-cell"><div className="bar-track"><div className="bar-fill" style={{ width: `${s.rate}%` }} /></div><b className="num">{s.rate}%</b></div></td>
                <td className="r num hide-sm">{s.shareOfChurners}%</td><td className="r num">{fmt(s.activeAtRisk)}</td></tr>))}
            </tbody>
          </table></div>
        )}
        <div className="callout" style={{ marginTop: 14 }}>Suggested actions (longer contracts, onboarding, automatic payment, support trials, pricing review) are hypotheses from historical patterns. Test them, for example with an A/B trial, before assuming they reduce churn. <Link to="/predict" style={{ fontWeight: 700 }}>Try the what-if simulator</Link></div>
      </Card>
      {open && <CustomerDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
