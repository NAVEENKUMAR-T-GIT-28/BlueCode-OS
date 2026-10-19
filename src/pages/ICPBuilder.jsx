import { ArrowLeft, ArrowRight, Check, CircleHelp, Plus, Sparkles, Target, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrototype } from "../context/PrototypeContext";
import { Button } from "../components/UI";
import founderLogo from "../assets/founder-logo.png";
const industries = ["B2B SaaS", "Technology", "Business Services", "FinTech", "Healthcare", "Education", "Manufacturing", "Other"];
const roles = ["Founder / CEO", "COO / Operations", "Head of Growth", "Sales Leader", "IT / Technology Leader", "Department Head"];
export default function ICPBuilder() {
  const navigate = useNavigate();
  const { startup, icp, saveIcp } = usePrototype();
  const [form, setForm] = useState({
    name: icp?.name || "Primary ICP",
    industries: icp?.industries || ["B2B SaaS", "Technology"],
    size: icp?.size || "11–200 employees",
    geography: icp?.geography || startup.geography || "India",
    roles: icp?.roles || ["Founder / CEO", "COO / Operations"],
    painPoints: icp?.painPoints || "Manual workflows, time-consuming research, and difficulty prioritizing potential customers",
    exclusions: icp?.exclusions || "Large enterprises with complex procurement; companies outside the target geography",
    objective: icp?.objective || startup.objective || "Book qualified discovery conversations"
  });
  const [customIndustry, setCustomIndustry] = useState("");
  const toggle = (key, value) => setForm(s => ({ ...s, [key]: s[key].includes(value) ? s[key].filter(x => x !== value) : [...s[key], value] }));
  const submit = e => { e.preventDefault(); saveIcp({ ...form, generatedAt: new Date().toISOString() }); navigate("/icp-review"); };
  return <div className="setup-page">
    <div className="setup-top"><a className="brand" href="/login"><div className="brand-mark">
  <img src={founderLogo} alt="Blue Code - OS logo" />
</div><div><strong>Blue Code - OS</strong><span>Ideal customer profile</span></div></a><span className="step-count">STEP 2 OF 3</span></div>
    <div className="setup-progress"><span style={{ width: "66.66%" }} /></div>
    <div className="setup-container wide">
      <div className="setup-step-kicker"><span>02</span> DEFINE YOUR IDEAL CUSTOMER</div>
      <h1>Who should your team focus on?</h1>
      <p className="setup-intro">Describe the companies and people most likely to benefit from your product. We'll turn this into a structured ICP draft for your approval.</p>
      <div className="setup-context-card"><div className="context-icon"><Sparkles size={18} /></div><div><strong>{startup.companyName || "Your startup"}</strong><p>{startup.product || "Add your product context in Startup Setup."}</p></div><button className="text-button" onClick={() => navigate("/startup-setup")}>Edit startup</button></div>
      <form className="form-card" onSubmit={submit}>
        <div className="form-card-heading"><div className="section-icon"><Target size={19} /></div><div><h2>ICP criteria</h2><p>Choose a starting point. You can review the proposed profile before approval.</p></div></div>
        <div className="form-grid">
          <div className="form-field full-field"><label>ICP profile name</label><input className="input" required value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} /></div>
          <div className="form-field full-field"><label>Target industries <span>*</span></label><div className="choice-grid">{industries.map(item => <button type="button" key={item} className={`choice-chip ${form.industries.includes(item) ? "choice-selected" : ""}`} onClick={() => toggle("industries", item)}>{form.industries.includes(item) && <Check size={14} />}{item}</button>)}</div><div className="custom-add"><input className="input" value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} placeholder="Add another industry" /><button type="button" className="button button-secondary" onClick={() => { if (customIndustry.trim() && !form.industries.includes(customIndustry.trim())) setForm(s => ({ ...s, industries: [...s.industries, customIndustry.trim()] })); setCustomIndustry(""); }}><Plus size={15} /> Add</button></div></div>
          <div className="form-field"><label>Company size <span>*</span></label><select className="input" value={form.size} onChange={e => setForm(s => ({ ...s, size: e.target.value }))}><option>1–10 employees</option><option>11–50 employees</option><option>11–200 employees</option><option>51–200 employees</option><option>201–500 employees</option><option>501–1000 employees</option><option>1000+ employees</option></select></div>
          <div className="form-field"><label>Target geography <span>*</span></label><select className="input" value={form.geography} onChange={e => setForm(s => ({ ...s, geography: e.target.value }))}><option>India</option><option>India and Southeast Asia</option><option>North America</option><option>United Kingdom</option><option>Global</option></select></div>
          <div className="form-field full-field"><label>Target buyer roles <span>*</span></label><div className="choice-grid">{roles.map(item => <button type="button" key={item} className={`choice-chip ${form.roles.includes(item) ? "choice-selected" : ""}`} onClick={() => toggle("roles", item)}>{form.roles.includes(item) && <Check size={14} />}{item}</button>)}</div></div>
          <div className="form-field full-field"><label>Customer pain points</label><textarea className="input textarea" rows={3} value={form.painPoints} onChange={e => setForm(s => ({ ...s, painPoints: e.target.value }))} placeholder="What problems does your product help solve?" /></div>
          <div className="form-field full-field"><label>Companies to exclude</label><textarea className="input textarea" rows={2} value={form.exclusions} onChange={e => setForm(s => ({ ...s, exclusions: e.target.value }))} placeholder="Describe poor-fit companies or exclusions." /></div>
          <div className="form-field full-field"><label>Sales objective</label><select className="input" value={form.objective} onChange={e => setForm(s => ({ ...s, objective: e.target.value }))}><option>Book qualified discovery conversations</option><option>Validate a new market</option><option>Find design partners</option><option>Build a qualified pipeline</option><option>Re-engage potential customers</option></select></div>
        </div>
        <div className="form-note"><CircleHelp size={16} /> The generated ICP is a suggested starting point, not a claim about actual market demand.</div>
        <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => navigate("/startup-setup")}><ArrowLeft size={16} /> Back</button><Button type="submit" icon={Sparkles}>Generate ICP draft</Button></div>
      </form>
    </div>
  </div>;
}
