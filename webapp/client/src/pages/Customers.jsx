import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Search, Users, X } from "lucide-react";
import { qs, useApi } from "../api.js";
import CustomerDrawer from "../components/CustomerDrawer.jsx";
import { Card, Chips, Empty, ErrorNote, Pager, RiskBadge, Skeleton, StatusBadge, fmt } from "../components/ui.jsx";

const list = (v) => (v ? v.split(",") : []);

export default function Customers() {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState({ contract: list(sp.get("contract")), internet: list(sp.get("internet")), risk: list(sp.get("risk")), payment: list(sp.get("payment")), status: [] });
  const [sort, setSort] = useState({ key: "score", dir: "desc" });
  const [page, setPage] = useState(1);
  const open = sp.get("open");

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  const { data, error, loading, reload } = useApi(`/customers${qs({ ...filters, search: debounced, sort: sort.key, dir: sort.dir, page, pageSize: 15 })}`);
  const toggle = (key) => (v) => { setPage(1); setFilters((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] })); };
  const sortBy = (key) => { setPage(1); setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" })); };
  const Th = ({ k, children, className = "" }) => (
    <th className={`sortable ${className}`} onClick={() => sortBy(k)} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      {children} {sort.key === k && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </th>);
  const closeDrawer = () => { sp.delete("open"); setSp(sp, { replace: true }); };

  return (
    <div className="page">
      <Card title="Find customers" subtitle="Search by ID, filter by segment, sort any column. Click a row for details and a model explanation.">
        <div className="filters">
          <div className="field"><div style={{ position: "relative" }}>
            <Search size={17} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Search customer ID, e.g. 7590" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search customers" />
            {search && <button className="icon-btn" style={{ position: "absolute", right: 3, top: 2, width: 36, height: 36, border: 0, background: "transparent" }} onClick={() => setSearch("")} aria-label="Clear search"><X size={16} /></button>}
          </div></div>
          <div className="filter-row"><span className="lbl">Contract</span><Chips options={["Month-to-month", "One year", "Two year"]} selected={filters.contract} onToggle={toggle("contract")} /></div>
          <div className="filter-row"><span className="lbl">Risk</span><Chips options={["Low", "Medium", "High"]} selected={filters.risk} onToggle={toggle("risk")} /></div>
          <div className="filter-row"><span className="lbl">Status</span><Chips options={["Active", "Churned"]} selected={filters.status} onToggle={(v) => { setPage(1); setFilters((f) => ({ ...f, status: f.status[0] === v ? [] : [v] })); }} /></div>
          {(filters.internet.length > 0 || filters.payment.length > 0) && <div className="filter-row"><span className="lbl">Also</span><Chips options={[...filters.internet, ...filters.payment]} selected={[...filters.internet, ...filters.payment]} onToggle={(v) => { toggle("internet")(v); toggle("payment")(v); }} /></div>}
        </div>
      </Card>

      <Card i={1} className="table-card">
        {error && <ErrorNote error={error} retry={reload} />}
        {!data && loading && <Skeleton h={420} />}
        {data && !data.rows.length && <Empty icon={Users} title="No customers found">Try a different search or fewer filters.</Empty>}
        {data && data.rows.length > 0 && (
          <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
            <div className="tbl-wrap"><table>
              <thead><tr>
                <Th k="customer_id">Customer</Th><th className="hide-sm">Contract</th><Th k="tenure" className="hide-sm r">Tenure</Th>
                <Th k="monthly_charges" className="r">Monthly</Th><Th k="score" className="hide-sm">Risk score</Th><th>Risk</th><th className="hide-sm">Outcome</th>
              </tr></thead>
              <tbody>{data.rows.map((r) => (
                <tr key={r.id} className="click" tabIndex={0} onClick={() => { sp.set("open", r.id); setSp(sp, { replace: true }); }} onKeyDown={(e) => e.key === "Enter" && (sp.set("open", r.id), setSp(sp, { replace: true }))}>
                  <td><b>{r.id}</b><div className="small muted hide-sm">{r.internet} · {r.payment}</div></td>
                  <td className="hide-sm">{r.contract}</td><td className="hide-sm r num">{r.tenure} mo</td><td className="r num">{fmt(r.monthly, 2)}</td>
                  <td className="hide-sm"><div className="bar-cell"><div className="bar-track"><div className="bar-fill" style={{ width: `${(r.score || 0) * 100}%` }} /></div><span className="num small">{r.score != null ? (r.score * 100).toFixed(0) : "-"}</span></div></td>
                  <td><RiskBadge level={r.risk} /></td>
                  <td className="hide-sm">{r.churn ? <StatusBadge status="Churned" /> : r.caseStatus ? <StatusBadge status={r.caseStatus} /> : <span className="muted small">Active</span>}</td>
                </tr>))}</tbody>
            </table></div>
            <Pager page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={setPage} />
          </div>
        )}
      </Card>
      {open && <CustomerDrawer id={open} onClose={closeDrawer} onChanged={reload} />}
    </div>
  );
}
