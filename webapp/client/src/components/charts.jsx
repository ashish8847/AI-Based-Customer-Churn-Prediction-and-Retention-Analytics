import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const RISK_COLOR = { Low: "var(--low)", Medium: "var(--med)", High: "var(--high)", Unscored: "var(--chart-4)" };
const axis = { tickLine: false, axisLine: false, tick: { fontSize: 12 } };

export function Tip({ active, payload, label, unit = "", extra }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div style={{ opacity: .8 }}>{label ?? payload[0].payload.label}</div>
      {payload.map((p, i) => <div key={i}><b>{typeof p.value === "number" ? p.value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : p.value}{unit}</b> {p.name}</div>)}
      {extra && extra(payload[0].payload)}
    </div>
  );
}

export function RateBars({ data, onSelect, selected = [], horizontal, height = 260, unit = "%", xKey = "label", yKey = "rate", name = "churn rate", overall }) {
  const dim = (d) => (selected.length && !selected.includes(d[xKey]) ? 0.35 : 1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 14, left: horizontal ? 24 : -14, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={!horizontal} horizontal={horizontal ? false : true} strokeDasharray="3 4" />
        {horizontal ? <><XAxis type="number" {...axis} unit={unit} /><YAxis type="category" dataKey={xKey} width={118} {...axis} /></> : <><XAxis dataKey={xKey} {...axis} interval={0} /><YAxis {...axis} unit={unit} /></>}
        <Tooltip cursor={{ fill: "var(--surface-2)", opacity: .6 }} content={<Tip unit={unit} extra={(p) => p.customers != null && <div style={{ opacity: .8 }}>{p.customers.toLocaleString("en-IN")} customers</div>} />} />
        <Bar dataKey={yKey} name={name} radius={horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]} onClick={onSelect ? (d) => onSelect(d[xKey]) : undefined} style={onSelect ? { cursor: "pointer" } : undefined} isAnimationActive animationDuration={700}>
          {data.map((d, i) => <Cell key={i} fill={overall != null && d[yKey] >= overall ? "var(--chart-2)" : "var(--chart-1)"} fillOpacity={dim(d)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TenureCurve({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 14, left: -14, bottom: 0 }}>
        <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: "var(--chart-2)", stopOpacity: .65 }} /><stop offset="100%" style={{ stopColor: "var(--chart-2)", stopOpacity: .02 }} /></linearGradient></defs>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis dataKey="label" {...axis} interval={1} /><YAxis {...axis} unit="%" />
        <Tooltip content={<Tip unit="%" extra={(p) => <div style={{ opacity: .8 }}>{p.customers.toLocaleString("en-IN")} customers, months {p.label}</div>} />} />
        <Area type="monotone" dataKey="rate" name="churn rate" stroke="var(--chart-2)" strokeWidth={3} fill="url(#gold)" dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }} activeDot={{ r: 6 }} animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RiskDonut({ data, onSelect, selected = [], height = 220 }) {
  const total = data.reduce((a, d) => a + d.customers, 0);
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(170px, 1fr) minmax(150px, 1fr)", alignItems: "center" }}>
      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="customers" nameKey="level" innerRadius="62%" outerRadius="92%" paddingAngle={3} stroke="none" onClick={onSelect ? (d) => onSelect(d.level) : undefined} animationDuration={800}>
              {data.map((d) => <Cell key={d.level} fill={RISK_COLOR[d.level]} fillOpacity={selected.length && !selected.includes(d.level) ? 0.3 : 1} style={{ cursor: onSelect ? "pointer" : "default" }} />)}
            </Pie>
            <Tooltip content={<Tip extra={(p) => <div style={{ opacity: .8 }}>actual churn {p.actualRate}%</div>} />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center" }}>
          <div><b className="num" style={{ fontSize: "1.5rem", color: "var(--heading)" }}>{total.toLocaleString("en-IN")}</b><div className="small muted">customers</div></div>
        </div>
      </div>
      <div className="legend">
        {data.map((d) => (
          <div className="legend-row" key={d.level}>
            <span className="swatch" style={{ background: RISK_COLOR[d.level] }} />
            <div><b>{d.level}</b> <span className="num">{d.customers.toLocaleString("en-IN")}</span><div className="small muted">actual churn {d.actualRate}%</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupedBars({ data, keys, xKey, height = 280, domain = [0, 1], colors = ["var(--chart-4)", "var(--chart-2)", "var(--chart-1)"], decimals = 2 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }} barGap={3}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis dataKey={xKey} {...axis} interval={0} /><YAxis {...axis} domain={domain} />
        <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)", opacity: .6 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.name} fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} animationDuration={700} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ThresholdLines({ data, height = 260 }) {
  const lines = [["precision", "var(--chart-1)"], ["recall", "var(--chart-2)"], ["f1", "var(--chart-3)"]];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 14, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis dataKey="threshold" {...axis} /><YAxis {...axis} domain={[0.3, 1]} />
        <Tooltip content={<Tip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {lines.map(([k, c]) => <Line key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={3} dot={{ r: 4 }} animationDuration={800} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
