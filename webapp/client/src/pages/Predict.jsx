import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles, UserCheck, Wand2, Zap } from "lucide-react";
import { ApiError, api } from "../api.js";
import { useApp } from "../context.jsx";
import { Card, Disclaimer, Empty, Factors, Gauge, Recommendations, RiskBadge, Seg } from "../components/ui.jsx";

const ADDONS = [["OnlineSecurity", "Online security"], ["OnlineBackup", "Online backup"], ["DeviceProtection", "Device protection"], ["TechSupport", "Tech support"], ["StreamingTV", "Streaming TV"], ["StreamingMovies", "Streaming movies"]];
const YN = ["No", "Yes"];

const HIGH = { gender: "Male", SeniorCitizen: "No", Partner: "No", Dependents: "No", tenure: 3, PhoneService: "Yes", MultipleLines: "No", InternetService: "Fiber optic", OnlineSecurity: "No", OnlineBackup: "No", DeviceProtection: "No", TechSupport: "No", StreamingTV: "Yes", StreamingMovies: "Yes", Contract: "Month-to-month", PaperlessBilling: "Yes", PaymentMethod: "Electronic check", MonthlyCharges: 95.5 };
const LOYAL = { gender: "Female", SeniorCitizen: "No", Partner: "Yes", Dependents: "Yes", tenure: 60, PhoneService: "Yes", MultipleLines: "No", InternetService: "DSL", OnlineSecurity: "Yes", OnlineBackup: "Yes", DeviceProtection: "No", TechSupport: "Yes", StreamingTV: "No", StreamingMovies: "No", Contract: "Two year", PaperlessBilling: "No", PaymentMethod: "Credit card (automatic)", MonthlyCharges: 58.2 };

function NumberField({ label, value, onChange, min, max, step = 1, id }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 92px", gap: 12, alignItems: "center" }}>
        <input type="range" className="range" style={{ "--pct": `${(Math.min(Math.max(Number(value) || 0, min), max) - min) / (max - min) * 100}%` }} min={min} max={max} step={step} value={value === "" ? min : Math.min(Number(value), max)} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} slider`} />
        <input id={id} className="input num" type="number" min={min} max={max * 4} step={step} value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
    </div>
  );
}

function ScoreChange({ base, next, busy }) {
  const d = next && base ? (next.churn_probability - base.churn_probability) * 100 : 0;
  return (
    <div className="whatif-delta" style={{ opacity: busy ? .6 : 1 }}>
      <div className="stat-pair" style={{ flex: 1 }}>
        <div><span className="small muted">Current</span><b className="num">{(base.churn_probability * 100).toFixed(1)}%</b><RiskBadge level={base.risk_level} /></div>
        <Zap size={20} color="var(--gold)" />
        <div><span className="small muted">Scenario</span><b className="num">{next ? (next.churn_probability * 100).toFixed(1) + "%" : "-"}</b>{next ? <RiskBadge level={next.risk_level} /> : <span className="small muted">change an option</span>}</div>
      </div>
      {next && <span className={`delta ${d > 0.05 ? "up" : d < -0.05 ? "down" : ""}`} style={{ fontSize: ".95rem" }}>{d > 0 ? "+" : ""}{d.toFixed(1)} pts</span>}
    </div>
  );
}

function WhatIf({ result, thresholds }) {
  const [s, setS] = useState(result.customer);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { setS(result.customer); setNext(null); }, [result]);
  const seq = useRef(0);
  useEffect(() => {
    const changed = JSON.stringify(s) !== JSON.stringify(result.customer);
    if (!changed) { setNext(null); setErr(""); return; }
    const id = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const body = { ...s, TotalCharges: result.total_charges_estimated ? null : s.TotalCharges };
        const r = await api("/whatif", { method: "POST", body: { customer: body } });
        if (id === seq.current) { setNext(r); setErr(""); }
      } catch (e) { if (id === seq.current) setErr(e.messages?.join(" ") || e.message); }
      finally { if (id === seq.current) setBusy(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [s, result]);
  const hasNet = s.InternetService !== "No";
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  return (
    <Card title="What-if simulator" subtitle="Change a detail and see how the risk score would move" actions={<button className="btn sm ghost" onClick={() => setS(result.customer)}><RotateCcw size={14} />Reset</button>}>
      <div className="grid" style={{ gap: 16 }}>
        <ScoreChange base={{ churn_probability: result.churn_probability, risk_level: result.risk_level }} next={next} busy={busy} />
        {err && <div className="callout err">{err}</div>}
        <div className="field"><label>Contract</label><Seg label="Contract" value={s.Contract} onChange={(v) => set("Contract", v)} options={["Month-to-month", "One year", "Two year"]} /></div>
        <div className="field"><label htmlFor="wi-pay">Payment method</label>
          <select id="wi-pay" className="select" value={s.PaymentMethod} onChange={(e) => set("PaymentMethod", e.target.value)}>
            {["Electronic check", "Mailed check", "Bank transfer (automatic)", "Credit card (automatic)"].map((o) => <option key={o}>{o}</option>)}
          </select></div>
        <div className="form-grid">
          <div className="field"><label>Tech support</label><Seg label="Tech support" value={s.TechSupport} disabled={!hasNet} onChange={(v) => set("TechSupport", v)} options={hasNet ? YN : ["No internet service"]} /></div>
          <div className="field"><label>Online security</label><Seg label="Online security" value={s.OnlineSecurity} disabled={!hasNet} onChange={(v) => set("OnlineSecurity", v)} options={hasNet ? YN : ["No internet service"]} /></div>
        </div>
        <NumberField id="wi-t" label="Tenure (months)" min={0} max={72} value={s.tenure} onChange={(v) => set("tenure", v)} />
        <NumberField id="wi-m" label="Monthly charges" min={0} max={150} step={0.5} value={s.MonthlyCharges} onChange={(v) => set("MonthlyCharges", v)} />
        <p className="small muted">Scenarios are not saved. They show how the model reacts and are not proof that the change would reduce churn in real life.</p>
      </div>
    </Card>
  );
}

export default function Predict() {
  const { meta, toast } = useApp();
  const [c, setC] = useState(HIGH);
  const [ref, setRef] = useState("");
  const [estimate, setEstimate] = useState(true);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const resultRef = useRef();

  const set = (k, v) => setC((p) => {
    const n = { ...p, [k]: v };
    if (k === "PhoneService") n.MultipleLines = v === "No" ? "No phone service" : p.MultipleLines === "No phone service" ? "No" : p.MultipleLines;
    if (k === "InternetService") ADDONS.forEach(([a]) => { n[a] = v === "No" ? "No internet service" : p[a] === "No internet service" ? "No" : p[a]; });
    return n;
  });
  const preset = (p) => { setC(p); setResult(null); setErrors([]); };

  const localErrors = () => {
    const e = [];
    if (c.tenure === "" || c.tenure < 0 || c.tenure > 120 || !Number.isFinite(c.tenure)) e.push("Tenure must be between 0 and 120 months.");
    if (c.MonthlyCharges === "" || c.MonthlyCharges < 0 || c.MonthlyCharges > 500) e.push("Monthly charges must be between 0 and 500.");
    if (!estimate && (total === "" || total < 0)) e.push("Total charges must be 0 or more.");
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const le = localErrors();
    if (le.length) { setErrors(le); return; }
    setErrors([]); setBusy(true);
    try {
      const r = await api("/predict", { method: "POST", body: { customer: { ...c, TotalCharges: estimate ? null : total }, customerRef: ref.trim() || undefined } });
      setResult(r);
      toast(`Prediction saved (#${r.predictionId})`);
      if (matchMedia("(max-width: 1100px)").matches) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      setResult(null);
      setErrors(err instanceof ApiError && err.messages.length ? err.messages : [err.message]);
    } finally { setBusy(false); }
  };

  const noPhone = c.PhoneService === "No", noNet = c.InternetService === "No";
  const opts = meta?.categories;

  return (
    <div className="page">
      <div className="chips">
        <span className="lbl">Quick start</span>
        <button className="chip" onClick={() => preset(HIGH)}><Sparkles size={13} style={{ verticalAlign: -2 }} /> Typical high-risk customer</button>
        <button className="chip" onClick={() => preset(LOYAL)}><UserCheck size={13} style={{ verticalAlign: -2 }} /> Typical loyal customer</button>
      </div>
      <div className="predict-layout">
        <form onSubmit={submit} className="grid" noValidate>
          <Card i={0} title="Account and billing">
            <div className="form-grid">
              <div className="field"><label htmlFor="ref">Customer ID (optional)</label><input id="ref" className="input" maxLength={30} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 7590-VHVEG" /></div>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Contract</label><Seg label="Contract" value={c.Contract} onChange={(v) => set("Contract", v)} options={["Month-to-month", "One year", "Two year"]} /></div>
              <div className="field"><label htmlFor="pay">Payment method</label>
                <select id="pay" className="select" value={c.PaymentMethod} onChange={(e) => set("PaymentMethod", e.target.value)}>{(opts?.PaymentMethod || [c.PaymentMethod]).map((o) => <option key={o}>{o}</option>)}</select></div>
              <div className="field"><label>Paperless billing</label><Seg label="Paperless billing" value={c.PaperlessBilling} onChange={(v) => set("PaperlessBilling", v)} options={YN} /></div>
            </div>
            <div className="grid" style={{ marginTop: 16, gap: 16 }}>
              <NumberField id="tenure" label="Tenure (months)" min={0} max={72} value={c.tenure} onChange={(v) => set("tenure", v)} />
              <NumberField id="monthly" label="Monthly charges" min={0} max={150} step={0.05} value={c.MonthlyCharges} onChange={(v) => set("MonthlyCharges", v)} />
              <label className="chips" style={{ cursor: "pointer" }}><input type="checkbox" checked={estimate} onChange={(e) => { setEstimate(e.target.checked); if (!e.target.checked) setTotal(Math.round(c.tenure * c.MonthlyCharges * 100) / 100 || 0); }} style={{ accentColor: "var(--gold)", width: 18, height: 18 }} /><span className="small">Estimate total charges (tenure x monthly charges)</span></label>
              {!estimate && <div className="field"><label htmlFor="total">Total charges</label><input id="total" className="input num" type="number" min={0} step={0.01} value={total} onChange={(e) => setTotal(e.target.value === "" ? "" : Number(e.target.value))} /></div>}
            </div>
          </Card>

          <Card i={1} title="Services">
            <div className="form-grid">
              <div className="field"><label>Phone service</label><Seg label="Phone service" value={c.PhoneService} onChange={(v) => set("PhoneService", v)} options={YN} /></div>
              <div className="field"><label>Multiple lines</label><Seg label="Multiple lines" value={noPhone ? "No" : c.MultipleLines} disabled={noPhone} onChange={(v) => set("MultipleLines", v)} options={YN} /></div>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Internet service</label><Seg label="Internet service" value={c.InternetService} onChange={(v) => set("InternetService", v)} options={[{ value: "DSL", label: "DSL" }, { value: "Fiber optic", label: "Fiber optic" }, { value: "No", label: "None" }]} /></div>
              {ADDONS.map(([k, label]) => (
                <div className="field" key={k}><label>{label}</label><Seg label={label} value={noNet ? "No" : c[k]} disabled={noNet} onChange={(v) => set(k, v)} options={YN} /></div>
              ))}
            </div>
            {(noPhone || noNet) && <p className="small muted" style={{ marginTop: 12 }}>Options that need {noPhone && "a phone line"}{noPhone && noNet && " or "}{noNet && "internet"} are switched off automatically.</p>}
          </Card>

          <Card i={2} title="Demographics">
            <div className="form-grid">
              <div className="field"><label>Gender</label><Seg label="Gender" value={c.gender} onChange={(v) => set("gender", v)} options={["Female", "Male"]} /></div>
              {[["SeniorCitizen", "Senior citizen"], ["Partner", "Partner"], ["Dependents", "Dependents"]].map(([k, l]) => <div className="field" key={k}><label>{l}</label><Seg label={l} value={c[k]} onChange={(v) => set(k, v)} options={YN} /></div>)}
            </div>
          </Card>

          {errors.length > 0 && <div className="callout err" role="alert"><div><b>Please correct the following</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{errors.map((m, i) => <li key={i}>{m}</li>)}</ul></div></div>}
          <button className="btn primary" disabled={busy} style={{ padding: "14px 18px", fontSize: "1.02rem" }}><Wand2 size={19} />{busy ? "Scoring..." : "Predict churn risk"}</button>
        </form>

        <div className="sticky" ref={resultRef}>
          {!result ? (
            <Card title="Result"><Empty icon={Wand2} title="Your prediction will appear here">Fill in the customer details and press Predict churn risk.</Empty></Card>
          ) : (
            <>
              <Card title="Prediction result" subtitle={result.predictionId ? `Saved as prediction #${result.predictionId}` : undefined}>
                <Gauge score={result.churn_probability} level={result.risk_level} thresholds={meta?.thresholds} />
                <div className="chips" style={{ justifyContent: "center", marginTop: 12 }}>
                  <span className={`badge ${result.risk_level}`} style={{ fontSize: ".9rem", padding: "5px 14px" }}>{result.risk_level} risk</span>
                  <b>{result.prediction}</b>
                </div>
                {result.total_charges_estimated && <p className="small muted" style={{ textAlign: "center", marginTop: 8 }}>Total charges were estimated from tenure and monthly charges.</p>}
              </Card>
              <Card title="Main factors" subtitle="Why the score looks like this"><Factors factors={result.top_factors} /></Card>
              <Card title="Suggested retention actions"><Recommendations items={result.recommendations} /></Card>
              <WhatIf result={result} thresholds={meta?.thresholds} />
              <Disclaimer />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
