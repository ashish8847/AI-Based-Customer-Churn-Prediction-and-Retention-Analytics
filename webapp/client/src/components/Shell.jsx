import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, BarChart3, BrainCircuit, Command, History as HistoryIcon, LayoutDashboard, LogOut, Menu, Moon, Search, Sun, Target, Upload, Users, Wand2 } from "lucide-react";
import { api } from "../api.js";
import { useApp } from "../context.jsx";
import { Drawer } from "./ui.jsx";

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, title: "Dashboard" },
  { to: "/predict", label: "Predict", icon: Wand2, title: "Predict churn" },
  { to: "/customers", label: "Customers", icon: Users, title: "Customers" },
  { to: "/retention", label: "Retention", icon: Target, title: "Retention workspace" },
  { to: "/batch", label: "Batch scoring", icon: Upload, title: "Batch scoring" },
  { to: "/models", label: "Models", icon: BrainCircuit, title: "Model performance" },
  { to: "/history", label: "History", icon: HistoryIcon, title: "Prediction history" },
];

function Palette({ onClose }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState([]);
  const [idx, setIdx] = useState(0);
  const input = useRef();
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 3) { setCustomers([]); return; }
    const t = setTimeout(() => api(`/customers?search=${encodeURIComponent(q.trim())}&pageSize=5`).then((r) => setCustomers(r.rows)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  const items = useMemo(() => [
    ...NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).map((n) => ({ key: n.to, label: `Go to ${n.label}`, icon: n.icon, run: () => nav(n.to) })),
    ...customers.map((c) => ({ key: c.id, label: `Customer ${c.id}`, hint: `${c.contract}, ${c.risk || "unscored"} risk`, icon: Users, run: () => nav(`/customers?open=${c.id}`) })),
  ], [q, customers, nav]);
  const go = (it) => { it?.run(); onClose(); };
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="palette" role="dialog" aria-label="Command palette">
        <input ref={input} className="input" placeholder="Search pages or type a customer ID..." value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            if (e.key === "Enter") go(items[idx]);
            if (e.key === "Escape") onClose();
          }} />
        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {items.map((it, i) => (
            <div key={it.key} className="item" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => go(it)}>
              <it.icon size={18} /><span>{it.label}</span>{it.hint && <span className="small muted" style={{ marginLeft: "auto" }}>{it.hint}</span>}
            </div>
          ))}
          {!items.length && <div className="empty small">No matches</div>}
        </div>
      </div>
    </>
  );
}

export default function Shell({ children }) {
  const { user, logout, theme, toggleTheme, meta } = useApp();
  const loc = useLocation();
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);
  const title = NAV.find((n) => n.to === loc.pathname)?.title || "Churn Insight";

  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { document.title = `${title} | Churn Insight`; window.scrollTo(0, 0); }, [title]);

  const m = meta?.model?.test_metrics;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark"><Activity size={22} strokeWidth={2.6} /></div>
          <div><b>Churn Insight</b><span>Retention analytics</span></div>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/"} title={n.label}><n.icon size={19} /><span>{n.label}</span></NavLink>)}
        </nav>
        <div className="side-foot">
          {m && <div className="side-card"><b>{meta.model.selected_model}</b>Recall {m.recall.toFixed(3)} · AUC {m.roc_auc.toFixed(3)}<br />held-out test set</div>}
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <h1>{title}</h1>
          <button className="search-btn" onClick={() => setPalette(true)} aria-label="Open search"><Search size={17} /><span className="txt">Search or jump to...</span><kbd className="kbd">Ctrl K</kbd></button>
          <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="user-chip"><div className="avatar">{user.username[0].toUpperCase()}</div><span className="small" style={{ paddingRight: 8 }}><b>{user.username}</b></span></div>
          <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
        </header>
        <main>{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Primary">
        {NAV.slice(0, 4).map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/"}><n.icon size={20} />{n.label}</NavLink>)}
        <button onClick={() => setMore(true)}><Menu size={20} />More</button>
      </nav>
      {more && (
        <Drawer title="More" onClose={() => setMore(false)}>
          <div className="grid">
            {NAV.slice(4).map((n) => <NavLink key={n.to} to={n.to} className="btn ghost" onClick={() => setMore(false)}><n.icon size={18} />{n.label}</NavLink>)}
            <button className="btn ghost" onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />} {theme === "dark" ? "Light" : "Dark"} theme</button>
            <button className="btn ghost" onClick={() => { setMore(false); setPalette(true); }}><Command size={18} />Search</button>
          </div>
        </Drawer>
      )}
      {palette && <Palette onClose={() => setPalette(false)} />}
    </div>
  );
}
