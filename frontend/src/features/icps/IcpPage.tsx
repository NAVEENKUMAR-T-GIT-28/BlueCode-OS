import { FormEvent, useEffect, useState } from "react";
import { ApiRequestError, api, formatDate, formatDateTime, formatMoneyPaise, getId, isRecord, queryString, readError } from "../../api";
import { useMutation, useRemote } from "../../app/hooks";
import { Icon, Logo, Button, Badge, PageHeader, Field, TextArea, LoadingState, ErrorState, EmptyState, Notice, InlineFeedback, AppMark, StatusBadge, ScoreBadge, DataTable } from "../../components/shared";
import type { AppUser } from "../auth/auth.types";
import type { PageContext, RecordValue } from "../page-types";


const criteriaFields = [
  { key: "industries", label: "Industries", placeholder: "SaaS, developer tools" },
  { key: "countries", label: "Countries", placeholder: "India, United States" },
  { key: "regions", label: "Regions", placeholder: "South India" },
  { key: "employeeRanges", label: "Employee ranges", placeholder: "11-50, 51-200" },
  { key: "revenueRanges", label: "Revenue ranges", placeholder: "Not required" },
  { key: "technologies", label: "Technologies", placeholder: "React, MongoDB" },
  { key: "companyKeywords", label: "Company keywords", placeholder: "B2B, product-led" },
  { key: "excludedIndustries", label: "Excluded industries", placeholder: "Agencies" },
  { key: "excludedCompanies", label: "Excluded companies", placeholder: "Existing customers" },
  { key: "targetJobTitles", label: "Target job titles", placeholder: "Founder, VP Sales" },
  { key: "targetSeniority", label: "Target seniority", placeholder: "Founder, C-suite" },
  { key: "contactLocations", label: "Contact locations", placeholder: "India" },
];

function splitCriteria(value: string): string[] { return value.split(",").map((item) => item.trim()).filter(Boolean); }

function criteriaToText(value: unknown): Record<string, string> {
  const criteria = isRecord(value) ? value : {};
  return Object.fromEntries(criteriaFields.map((field) => [field.key, Array.isArray(criteria[field.key]) ? criteria[field.key].join(", ") : ""]));
}

function textToCriteria(value: Record<string, string>): RecordValue {
  return Object.fromEntries(criteriaFields.map((field) => [field.key, splitCriteria(value[field.key] || "")]));
}

export function IcpPage({ path, startupId, navigate }: PageContext) {
  const selectedId = path === "/icps/new" ? "new" : path.startsWith("/icps/") ? path.split("/")[2] : "";
  const showBuilder = selectedId !== "";
  const list = useRemote<RecordValue[]>(showBuilder && selectedId !== "" ? null : "/api/v1/icps?limit=100&sort=-createdAt", startupId);
  const detail = useRemote<RecordValue>(showBuilder && selectedId && selectedId !== "new" ? `/api/v1/icps/${encodeURIComponent(selectedId)}` : null, startupId);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [geography, setGeography] = useState(""); const [objective, setObjective] = useState(""); const [notes, setNotes] = useState("");
  const [criteriaText, setCriteriaText] = useState<Record<string, string>>(() => criteriaToText(null)); const [rationale, setRationale] = useState(""); const [proposalReady, setProposalReady] = useState(false);
  const mutation = useMutation(); const editingExisting = selectedId !== "" && selectedId !== "new";
  useEffect(() => { if (detail.data) { setName(detail.data.name || ""); setCriteriaText(criteriaToText(detail.data.criteria)); setProposalReady(true); } }, [detail.data]);
  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const response = await mutation.execute(() => api.post<RecordValue>("/api/v1/icps/propose", { productDescription: description, targetGeography: geography || undefined, salesObjective: objective || undefined, notes: notes || undefined }, startupId), "Proposal ready to review.");
    if (response) { setCriteriaText(criteriaToText(response.data.criteria)); setRationale(response.data.rationale || ""); setProposalReady(true); }
  }
  async function saveIcp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { name: name.trim(), criteria: textToCriteria(criteriaText) };
    const response = await mutation.execute(() => editingExisting
      ? api.patch<RecordValue>(`/api/v1/icps/${encodeURIComponent(selectedId)}`, payload, startupId)
      : api.post<RecordValue>("/api/v1/icps", payload, startupId), editingExisting ? "ICP updated." : "ICP created.");  
    if (response) { navigate("/icps"); list.reload(); }
  }
  async function archiveIcp(id: string) {
    if (!window.confirm("Archive this ICP? Archived profiles cannot be used for new scoring or campaign creation.")) return;
    const result = await mutation.execute(() => api.postNoContent(`/api/v1/icps/${encodeURIComponent(id)}/archive`, startupId), "ICP archived.");
    if (result !== null) list.reload();
  }
  if (showBuilder) return <div className="page-stack"><PageHeader title={editingExisting ? "Edit ideal customer profile" : "Create ideal customer profile"} description="Keep criteria explicit. A proposal is not saved until you review and confirm it." action={<Button variant="secondary" onClick={() => navigate("/icps")}>Back to ICPs</Button>}/>
    {detail.loading && editingExisting && <LoadingState label="Loading ICPâ€¦"/>}{detail.error && <ErrorState error={detail.error} retry={detail.reload}/>}
    {(!editingExisting || detail.data) && <>
      {!editingExisting && <section className="card panel"><div className="section-heading"><h2>Start with a description</h2><p>Describe what you sell and the companies you want to reach.</p></div><Notice tone="warning" title="Proposal preview">In mock mode, the backend may return a deterministic demo fixture rather than live AI advice. Review every criterion before saving; live AI use remains gated by backend configuration and approved cost estimates.</Notice><form onSubmit={propose} className="form-grid form-grid-single"><TextArea label="Product or service description" value={description} onChange={setDescription} placeholder="Describe your product, target customer, and problem it solvesâ€¦" required minLength={20} maxLength={2000} help="20â€“2,000 characters required by the API."/><div className="form-grid"><Field label="Target geography" value={geography} onChange={setGeography} placeholder="e.g. India"/><Field label="Sales objective" value={objective} onChange={setObjective} placeholder="e.g. Find product-led SaaS teams"/></div><TextArea label="Additional notes (optional)" value={notes} onChange={setNotes} placeholder="Any constraints or exclusionsâ€¦" maxLength={2000} rows={2}/><div className="form-actions"><Button type="submit" loading={mutation.pending} icon="target">Propose criteria</Button></div></form><InlineFeedback error={mutation.error} success={mutation.success}/></section>}
      <form className="card panel" onSubmit={saveIcp}><div className="section-heading"><h2>{editingExisting ? "Review criteria" : "Review and save"}</h2><p>All fields can be edited. Each list accepts comma-separated values, up to 25 items.</p></div>
        <div className="field"><span>Profile name</span><input value={name} required maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. B2B SaaS â€” India"/></div>
        {!editingExisting && <p className="field-help">Generate a proposal first or enter criteria manually and save.</p>}
        {proposalReady && rationale && <Notice title="Proposal rationale">{rationale}</Notice>}
        <div className="criteria-grid">{criteriaFields.map((field) => <label className="field" key={field.key}><span>{field.label}</span><input value={criteriaText[field.key] || ""} onChange={(event) => setCriteriaText((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder}/><small className="field-help">Comma-separated Â· maximum 25 values</small></label>)}</div>
        <InlineFeedback error={mutation.error}/><div className="form-actions"><Button variant="secondary" onClick={() => navigate("/icps")}>Cancel</Button><Button type="submit" loading={mutation.pending}>{editingExisting ? "Save changes" : "Save ICP"}</Button></div>
      </form>
    </>}
  </div>;
  return <div className="page-stack"><PageHeader title="Ideal customer profiles" description="Manage the criteria that organize and qualify prospects." action={<Button icon="plus" onClick={() => navigate("/icps/new")}>Create ICP</Button>}/>
    {list.loading && <LoadingState/>}{list.error && <ErrorState error={list.error} retry={list.reload}/>}
    {list.data && list.data.length === 0 && <EmptyState title="No ICPs yet" description="Create an ideal customer profile before selecting or scoring prospects." action={<Button icon="plus" onClick={() => navigate("/icps/new")}>Create ICP</Button>}/>}
    {list.data && list.data.length > 0 && <DataTable><thead><tr><th>Profile</th><th>Criteria summary</th><th>Version</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{list.data.map((icp) => <tr key={icp.id}><td><div className="table-primary"><AppMark name={icp.name}/><div><b>{icp.name}</b><small>{icp.id}</small></div></div></td><td>{criteriaSummary(icp.criteria)}</td><td>{icp.criteriaVersion ?? "â€”"}</td><td><StatusBadge value={icp.isActive ? "active" : "archived"}/></td><td>{formatDate(icp.createdAt)}</td><td><div className="table-actions"><Button variant="ghost" onClick={() => navigate(`/icps/${encodeURIComponent(icp.id)}`)}>Edit</Button>{icp.isActive && <Button variant="ghost" onClick={() => void archiveIcp(icp.id)}>Archive</Button>}</div></td></tr>)}</tbody></DataTable>}
    <InlineFeedback error={mutation.error} success={mutation.success}/>
  </div>;
}

function criteriaSummary(criteria: unknown): string {
  if (!isRecord(criteria)) return "No criteria saved";
  const parts = ["industries", "employeeRanges", "countries"].flatMap((key) => Array.isArray(criteria[key]) && criteria[key].length ? [`${key === "industries" ? "Industry" : key === "employeeRanges" ? "Employees" : "Countries"}: ${criteria[key].slice(0, 3).join(", ")}`] : []);
  return parts.length ? parts.join(" Â· ") : "Criteria configured";
}
