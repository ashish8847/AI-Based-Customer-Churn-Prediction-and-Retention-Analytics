import { useState } from "react";
import { Activity, Eye, EyeOff, LogIn } from "lucide-react";
import { useApp } from "../context.jsx";

export default function Login() {
  const { login } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try { await login(username.trim(), password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <section className="hero">
        <div className="brand" style={{ padding: 0 }}><div className="brand-mark"><Activity size={22} strokeWidth={2.6} /></div><div><b>Churn Insight</b><span>Retention analytics</span></div></div>
        <div style={{ position: "relative", display: "grid", gap: 18 }}>
          <h1>Know who is leaving <em>before</em> they go.</h1>
          <p>Machine learning predicts churn risk, explains the main factors, and turns them into retention actions your team can track.</p>
        </div>
        <div className="hero-stats">
          <div><b>7,043</b><span className="small">customers analysed</span></div>
          <div><b>0.846</b><span className="small">test ROC-AUC</span></div>
          <div><b>5</b><span className="small">models compared</span></div>
        </div>
        <svg className="hero-art" viewBox="0 0 400 400" aria-hidden="true">
          <circle cx="200" cy="200" r="190" fill="none" stroke="#EAAA00" strokeOpacity=".35" strokeWidth="2" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="#DDE3E8" strokeOpacity=".18" strokeWidth="2" />
          <circle cx="200" cy="200" r="90" fill="none" stroke="#DDE3E8" strokeOpacity=".18" strokeWidth="2" />
          <path d="M40 300 C 120 280, 150 200, 220 190 S 330 120, 380 60" fill="none" stroke="#EAAA00" strokeWidth="7" strokeLinecap="round" />
          <circle cx="380" cy="60" r="11" fill="#EAAA00" />
        </svg>
      </section>
      <section className="login-form">
        <form onSubmit={submit} noValidate>
          <div><h1>Welcome back</h1><p className="muted">Sign in to open the retention workspace.</p></div>
          {error && <div className="callout err" role="alert">{error}</div>}
          <div className="field"><label htmlFor="u">Username</label><input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus /></div>
          <div className="field"><label htmlFor="p">Password</label>
            <div style={{ position: "relative" }}>
              <input id="p" className="input" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="icon-btn" style={{ position: "absolute", right: 4, top: 2, width: 36, height: 36, border: 0, background: "transparent" }} onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </div>
          <button className="btn primary" disabled={busy || !username || !password}><LogIn size={17} />{busy ? "Signing in..." : "Sign in"}</button>
          <button type="button" className="btn ghost" onClick={() => { setUsername("admin"); setPassword("admin123"); }}>Fill demo login (admin)</button>
          <p className="small muted">Demo accounts: admin / admin123, analyst / analyst123. Change them with ADMIN_USER and ADMIN_PASSWORD before real use.</p>
        </form>
      </section>
    </div>
  );
}
