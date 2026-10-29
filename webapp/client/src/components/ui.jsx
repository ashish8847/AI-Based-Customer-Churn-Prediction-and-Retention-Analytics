import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Lightbulb, X } from "lucide-react";

export const fmt = (n, d = 0) => (n == null || Number.isNaN(Number(n)) ? "-" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));
export const compact = (n) => (n == null ? "-" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n));
export const pct = (n, d = 1) => (n == null ? "-" : `${Number(n).toFixed(d)}%`);

export function Card({ title, subtitle, actions, children, className = "", i = 0 }) {
  return (
    <section className={`card ${className}`} style={{ "--i": i }}>
      {(title || actions) && (
        <div className="card-head">
          <div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function useCountUp(target, duration = 900) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target == null || Number.isNaN(target)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    const from = prev.current, t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

export function Kpi({ label, value, decimals = 0, suffix = "", prefix = "", sub, delta, icon: Icon, accent, i = 0, format }) {
  const v = useCountUp(value);
  return (
    <section className={`card kpi ${accent ? "accent" : ""}`} style={{ "--i": i }}>
      <div className="label">{label}</div>
      <div className="value num">{prefix}{format ? format(v) : fmt(v, decimals)}{suffix}</div>
      <div className="sub">
        {delta != null && (
          <span className={`delta ${delta > 0 ? "up" : "down"}`}>
            {delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta).toFixed(1)} pts
          </span>
        )}{" "}{sub}
      </div>
      {Icon && <Icon className="glyph" size={92} strokeWidth={1.4} />}
    </section>
  );
}

export const RiskBadge = ({ level }) => (level ? <span className={`badge ${level}`}>{level}</span> : <span className="muted">-</span>);
export const StatusBadge = ({ status }) => <span className={`badge status ${status.split(" ")[0]}`}>{status}</span>;

export function Skeleton({ h = 120, w = "100%", style }) { return <div className="skel" style={{ height: h, width: w, ...style }} aria-hidden />; }
export function Empty({ icon: Icon, title, children }) {
  return <div className="empty">{Icon && <Icon size={34} />}<b>{title}</b><span className="small">{children}</span></div>;
}
export function ErrorNote({ error, retry }) {
  return (
    <div className="callout err" role="alert"><AlertTriangle size={18} />
      <div><b>{error?.message || "Something went wrong"}</b>{retry && <> <button className="btn sm ghost" onClick={retry} style={{ marginLeft: 8 }}>Try again</button></>}</div>
    </div>
  );
}

export function Seg({ value, onChange, options, disabled, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => {
        const val = o.value ?? o, text = o.label ?? o;
        return <button key={val} type="button" aria-pressed={value === val} disabled={disabled} onClick={() => onChange(val)}>{text}</button>;
      })}
    </div>
  );
}

export function Chips({ options, selected, onToggle }) {
  return <div className="chips">{options.map((o) => <button key={o} className="chip" aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>{o}</button>)}</div>;
}

export function Pager({ page, pages, total, pageSize, onPage }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1, to = Math.min(total, page * pageSize);
  return (
    <div className="pager">
      <span className="small muted num">{fmt(from)}-{fmt(to)} of {fmt(total)}</span>
      <div className="chips">
        <button className="btn sm ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="small num">Page {page} / {pages}</span>
        <button className="btn sm ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-head" style={{ margin: 0 }}><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </aside>
    </>
  );
}

const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
const arcPath = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a0 - a1 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
};

export function Gauge({ score, level, thresholds = { lowMax: 0.3, highMin: 0.6 }, label = "churn risk score" }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(score), 60); return () => clearTimeout(t); }, [score]);
  const cx = 150, cy = 140, r = 112;
  const angle = (s) => Math.PI - s * Math.PI;
  const color = { Low: "var(--low)", Medium: "var(--med)", High: "var(--high)" }[level] || "var(--gold)";
  const [nx, ny] = polar(cx, cy, r - 30, angle(shown));
  return (
    <div className="gauge" role="img" aria-label={`${label} ${(score * 100).toFixed(1)} percent, ${level} risk`}>
      <svg viewBox="0 0 300 206">
        <path d={arcPath(cx, cy, r, Math.PI, angle(thresholds.lowMax))} stroke="var(--low)" strokeOpacity=".28" strokeWidth="18" fill="none" strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, angle(thresholds.lowMax), angle(thresholds.highMin))} stroke="var(--med)" strokeOpacity=".3" strokeWidth="18" fill="none" />
        <path d={arcPath(cx, cy, r, angle(thresholds.highMin), 0)} stroke="var(--high)" strokeOpacity=".28" strokeWidth="18" fill="none" strokeLinecap="round" />
        {shown > 0.004 && <path d={arcPath(cx, cy, r, Math.PI, angle(shown))} stroke={color} strokeWidth="18" fill="none" strokeLinecap="round" style={{ transition: "all .8s cubic-bezier(.2,.7,.2,1)" }} />}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--heading)" strokeWidth="3" strokeLinecap="round" style={{ transition: "all .8s cubic-bezier(.2,.7,.2,1)" }} />
        <circle cx={cx} cy={cy} r="9" fill="var(--gold)" stroke="var(--brand)" strokeWidth="3" />
      </svg>
      <div className="center"><div className="big num">{(score * 100).toFixed(1)}%</div><div className="small muted">{label}</div></div>
    </div>
  );
}

export function Factors({ factors }) {
  if (!factors?.length) return <p className="small muted">No single factor moved the score noticeably.</p>;
  const max = Math.max(...factors.map((f) => Math.abs(f.impact)), 0.05);
  return (
    <div>
      {factors.map((f) => (
        <div className="factor" key={f.factor} title={f.value}>
          <div><b>{f.factor}</b><div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.value}</div></div>
          <div className="track"><span className="mid" /><span className={`fill ${f.impact > 0 ? "up" : "down"}`} style={{ width: `${(Math.abs(f.impact) / max) * 50}%` }} /></div>
          <div className="num" style={{ textAlign: "right", fontWeight: 700, color: f.impact > 0 ? "var(--high)" : "var(--low)" }}>{f.impact > 0 ? "+" : ""}{(f.impact * 100).toFixed(1)}</div>
        </div>
      ))}
      <p className="small muted" style={{ marginTop: 8 }}>Effect on the score in percentage points compared with an average customer. Approximate and measured one factor at a time.</p>
    </div>
  );
}

export function Recommendations({ items }) {
  return (
    <div>
      {items.map((r, i) => (
        <div className="rec" key={i}>
          <div className="dot"><Lightbulb size={15} /></div>
          <div><b>{r.action}</b><p className="small muted">{r.reason}</p></div>
        </div>
      ))}
    </div>
  );
}

export const Disclaimer = () => (
  <div className="callout"><AlertTriangle size={17} style={{ flex: "none", marginTop: 2 }} />
    <span>This is a machine learning estimate based on patterns in historical data, not a guarantee of what the customer will do. The score ranks risk and is not a calibrated probability.</span>
  </div>
);
