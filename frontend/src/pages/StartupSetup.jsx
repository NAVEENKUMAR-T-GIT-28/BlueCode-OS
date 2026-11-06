import { ArrowLeft, ArrowRight, Building2, Check, Globe2, Rocket, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrototype } from "../context/PrototypeContext";
import { Button, PageHeader } from "../components/UI";
import founderLogo from "../assets/founder-logo.png";
export default function StartupSetup() {
  const navigate = useNavigate();
  const { startup, saveStartup } = usePrototype();
  const [form, setForm] = useState({ ...startup });
  const update = (key, value) => setForm(s => ({ ...s, [key]: value }));
  const submit = e => { e.preventDefault(); saveStartup(form); navigate("/icp-builder"); };
  return <div className="setup-page">
    <div className="setup-top"><a className="brand" href="/login"><div className="brand-mark">
  <img src={founderLogo} alt="Blue Code - OS logo" />
</div><div><strong>Blue Code - OS</strong><span>Founder onboarding</span></div></a><span className="step-count">STEP 1 OF 3</span></div>
    <div className="setup-progress"><span style={{ width: "33.33%" }} /></div>
    <div className="setup-container">
      <div className="setup-step-kicker"><span>01</span> YOUR STARTUP</div>
      <h1>First, tell us about your business.</h1>
      <p className="setup-intro">This context helps shape a useful ideal customer profile. You can use sample details for this prototype.</p>
      <div className="step-indicators"><div className="step-indicator active"><span>1</span><div><strong>Startup setup</strong><small>Company context</small></div></div><div className="step-indicator"><span>2</span><div><strong>Define your ICP</strong><small>Target customers</small></div></div><div className="step-indicator"><span>3</span><div><strong>Review & approve</strong><small>AI-generated draft</small></div></div></div>
      <form className="form-card" onSubmit={submit}>
        <div className="form-card-heading"><div className="section-icon"><Building2 size={19} /></div><div><h2>Company basics</h2><p>A few details about what you are building.</p></div></div>
        <div className="form-grid">
          <div className="form-field"><label>Company name <span>*</span></label><input className="input" required value={form.companyName} onChange={e => update("companyName", e.target.value)} placeholder="e.g. Acme Technologies" /></div>
          <div className="form-field"><label>Target geography <span>*</span></label><div className="input-with-icon"><Globe2 size={17} /><select className="input" value={form.geography} onChange={e => update("geography", e.target.value)}><option>India</option><option>India and Southeast Asia</option><option>North America</option><option>United Kingdom</option><option>Global</option></select></div></div>
          <div className="form-field full-field"><label>What does your product do? <span>*</span></label><textarea className="input textarea" required value={form.product} onChange={e => update("product", e.target.value)} placeholder="Describe your product, who it helps and the problem it solves..." rows={3} /></div>
          <div className="form-field full-field"><label>Who are your existing customers? <span className="optional">(optional)</span></label><div className="input-with-icon"><Users size={17} /><input className="input" value={form.customers} onChange={e => update("customers", e.target.value)} placeholder="e.g. Early-stage SaaS teams, or no customers yet" /></div></div>
          <div className="form-field full-field"><label>Primary sales objective <span>*</span></label><div className="input-with-icon"><Rocket size={17} /><select className="input" value={form.objective} onChange={e => update("objective", e.target.value)}><option>Book qualified discovery conversations</option><option>Validate a new market</option><option>Find design partners</option><option>Build a qualified pipeline</option><option>Re-engage potential customers</option></select></div></div>
        </div>
        <div className="form-note"><Check size={16} /> This profile will be used to prepare a proposed ICP for your review.</div>
        <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => navigate("/login")}><ArrowLeft size={16} /> Back</button><Button type="submit" icon={ArrowRight}>Continue to ICP Builder</Button></div>
      </form>
      <p className="privacy-note">Demo data is stored in this browser only. No backend or external service is connected.</p>
    </div>
  </div>;
}
