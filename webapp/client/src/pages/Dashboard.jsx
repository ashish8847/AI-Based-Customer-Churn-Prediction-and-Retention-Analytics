import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, Banknote, FilterX, Percent, Timer, UserMinus, Users } from "lucide-react";
import { qs, useApi } from "../api.js";
import { RISK_COLOR, RateBars, RiskDonut, Tip, TenureCurve } from "../components/charts.jsx";
import { Card, Chips, ErrorNote, Kpi, Skeleton, compact, fmt } from "../components/ui.jsx";

const OPTIONS = {
  contract: ["Month-to-month", "One year", "Two year"],
  internet: ["DSL", "Fiber optic", "No"],
  risk: ["Low", "Medium", "High"],
};

export default function Dashboard() {
  const [filters, setFilters] = useState({ contract: [], internet: [], risk: [], payment: [] });
  const { data, error, loading, reload } = useApi(`/dashboard${qs(filters)}`);
  const toggle = (key) => (value) => setFilters((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));
  const active = Object.values(filters).some((a) => a.length);
  const reset = () => setFilters({ contract: [], internet: [], risk: [], payment: [] });
  const k = data?.kpis;
  const customersLink = useMemo(() => `/customers${qs(filters)}`, [filters]);

  return (
    <div className="page">
      <Card i={0} title="Filters" subtitle="Click any bar or donut slice below to filter the whole dashboard." actions={
        <div className="chips">
          <Link className="btn sm ghost" to={customersLink}><Users size={15} />View customers</Link>
          <button className="btn sm ghost" onClick={reset} disabled={!active}><FilterX size={15} />Reset</button>
        </div>}>
        <div className="filters">
          {[["Contract", "contract"], ["Internet", "internet"], ["Risk level", "risk"]].map(([label, key]) => (
            <div className="filter-row" key={key}><span className="lbl">{label}</span><Chips options={OPTIONS[key]} selected={filters[key]} onToggle={toggle(key)} /></div>
          ))}
          {filters.payment.length > 0 && <div className="filter-row"><span className="lbl">Payment</span><Chips options={filters.payment} selected={filters.payment} onToggle={toggle("payment")} /></div>}
        </div>
      </Card>

      {error && <ErrorNote error={error} retry={reload} />}
      {!data && loading && <><div className="grid g-kpi6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={118} />)}</div><Skeleton h={300} /></>}

      {data && k.total === 0 && <Card><div className="empty"><b>No customers match these filters</b><span className="small">Try removing one of them.</span></div></Card>}
      {data && k.total > 0 && (
        <>
          <div className="grid g-kpi6" style={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
            <Kpi i={1} label="Customers" value={k.total} icon={Users} sub={active ? "in selection" : "in dataset"} />
            <Kpi i={2} label="Churned" value={k.churned} icon={UserMinus} sub={`${fmt(k.total - k.churned)} still active`} />
            <Kpi i={3} accent label="Churn rate" value={k.churnRate} decimals={2} suffix="%" icon={Percent} delta={active ? k.churnRate - k.overallRate : null} sub={active ? "vs overall" : "overall"} />
            <Kpi i={4} label="High-risk active" value={k.highRiskActive} icon={AlertOctagon} sub="active customers to watch" />
            <Kpi i={5} label="Monthly revenue at risk" value={k.revenueAtRisk} format={compact} icon={Banknote} sub={`of ${compact(k.activeRevenue)} active revenue`} />
            <Kpi i={6} label="Avg tenure" value={k.avgTenure} decimals={1} suffix=" mo" icon={Timer} sub={`avg bill ${fmt(k.avgMonthly, 2)}`} />
          </div>

          <div className="grid g-charts" style={{ opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
            <Card i={2} title="Churn by contract" subtitle="Gold bars are above the overall rate"><RateBars data={data.byContract} selected={filters.contract} onSelect={toggle("contract")} overall={k.overallRate} /></Card>
            <Card i={3} title="Churn by months of tenure" subtitle="Six-month cohorts: the first year is riskiest"><TenureCurve data={data.tenureCurve} /></Card>
            <Card i={4} title="Predicted risk levels" subtitle="Out-of-fold scores vs what actually happened"><RiskDonut data={data.riskDistribution} selected={filters.risk} onSelect={toggle("risk")} /></Card>
            <Card i={5} title="Monthly revenue of active customers by risk" subtitle="Where the money at stake sits">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.revenueByRisk} margin={{ top: 8, right: 14, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} strokeDasharray="3 4" />
                  <XAxis dataKey="level" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={compact} />
                  <Tooltip cursor={{ fill: "var(--surface-2)", opacity: .6 }} content={<Tip extra={(p) => <div style={{ opacity: .8 }}>{fmt(p.customers)} active customers</div>} />} />
                  <Bar dataKey="revenue" name="monthly revenue" radius={[8, 8, 0, 0]} animationDuration={700}>{data.revenueByRisk.map((d) => <Cell key={d.level} fill={RISK_COLOR[d.level]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card i={6} title="Churn by payment method"><RateBars horizontal data={data.byPayment} selected={filters.payment} onSelect={toggle("payment")} overall={k.overallRate} /></Card>
            <Card i={7} title="Churn by internet service"><RateBars data={data.byInternet} selected={filters.internet} onSelect={toggle("internet")} overall={k.overallRate} /></Card>
            <Card i={8} title="Churn by monthly charge band" subtitle="Not a straight line: the cheapest customers rarely leave"><RateBars data={data.byChargeBand} overall={k.overallRate} /></Card>
            <Card i={9} title="Highest-churn segments" subtitle="Contract + internet + payment combinations with 80+ customers">
              <div className="tbl-wrap"><table>
                <thead><tr><th>Segment</th><th className="r">Customers</th><th>Churn rate</th></tr></thead>
                <tbody>{data.topSegments.map((s, i) => (
                  <tr key={i}><td><b>{s.contract}</b><div className="small muted">{s.internet} · {s.payment}</div></td><td className="r num">{fmt(s.customers)}</td>
                    <td><div className="bar-cell"><div className="bar-track"><div className="bar-fill" style={{ width: `${s.rate}%` }} /></div><b className="num">{s.rate}%</b></div></td></tr>))}
                </tbody>
              </table></div>
            </Card>
          </div>
          <p className="small muted">Amounts are in the dataset's currency units. Risk levels come from out-of-fold predictions, so each customer was scored by a model that never trained on them.</p>
        </>
      )}
    </div>
  );
}
