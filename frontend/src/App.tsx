import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiEnvelope, ApiRequestError, api, formatDate, formatDateTime, formatMoneyPaise, getId, isRecord, queryString, readError } from "./api";
import { Icon, Logo, Button, Badge, PageHeader, Field, TextArea, LoadingState, ErrorState, EmptyState, Notice, InlineFeedback, AppMark, StatusBadge, ScoreBadge, DataTable } from "./components/shared";

type RecordValue = Record<string, any>;
type AppUser = { id: string; name: string; email: string; status?: string };
type BrowserLocation = { pathname: string; search: string };

type NavItem = { path: string; label: string; icon: string };
const navItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { path: "/icps", label: "Ideal customer profiles", icon: "target" },
  { path: "/prospects", label: "Prospects", icon: "building" },
  { path: "/outreach", label: "Outreach", icon: "send" },
  { path: "/next-actions", label: "Next actions", icon: "check-square" },
  { path: "/activity", label: "Activity", icon: "activity" },
  { path: "/usage", label: "Usage", icon: "chart" },
  { path: "/settings", label: "Workspace settings", icon: "settings" },
];

function useBrowserLocation() {
  const [location, setLocation] = useState<BrowserLocation>(() => ({ pathname: window.location.pathname, search: window.location.search }));
  useEffect(() => {
    const update = () => setLocation({ pathname: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((path: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setLocation({ pathname: window.location.pathname, search: window.location.search });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);
  return { location, navigate };
}

function useRemote<T>(path: string | null, startupId?: string) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<ApiEnvelope<T>["meta"]>();
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) { setLoading(false); setData(null); setError(null); setMeta(undefined); return () => { active = false; }; }
    setLoading(true);
    setError(null);
    api.get<T>(path, startupId).then((result) => {
      if (!active) return;
      setData(result.data);
      setMeta(result.meta);
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      setData(null);
      setMeta(undefined);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, startupId, version]);
  return { data, meta, loading, error, reload: () => setVersion((v) => v + 1) };
}























function useMutation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState("");
  const execute = useCallback(async <T,>(work: () => Promise<T>, successText = "") => {
    setPending(true); setError(null); setSuccess("");
    try { const result = await work(); setSuccess(successText); return result; }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(String(cause))); return null; }
    finally { setPending(false); }
  }, []);
  return { pending, error, success, execute, clearError: () => setError(null), setSuccess };
}











function AuthPage({ onAuthenticated, navigate }: { onAuthenticated: (user: AppUser) => Promise<void>; navigate: (path: string) => void }) {
  const isRegister = window.location.pathname === "/register";
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState<unknown>(null); const [message, setMessage] = useState(() => {
    const notice = window.location.pathname === "/login" ? sessionStorage.getItem("bc_registered_notice") || "" : "";
    if (notice) sessionStorage.removeItem("bc_registered_notice");
    return notice;
  });
  useEffect(() => {
    if (window.location.pathname !== "/login") return;
    const notice = sessionStorage.getItem("bc_registered_notice");
    if (notice) { setMessage(notice); sessionStorage.removeItem("bc_registered_notice"); }
  }, [isRegister]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setMessage("");
    try {
      if (isRegister) {
        await api.post<RecordValue>("/api/v1/auth/register", { name: name.trim(), email: email.trim(), password });
        const notice = "Account created. Sign in to continue, then choose or create a workspace.";
        sessionStorage.setItem("bc_registered_notice", notice);
        setMessage(notice);
        setPassword(""); navigate("/login");
      } else {
        const response = await api.post<{ user: AppUser } & RecordValue>("/api/v1/auth/login", { email: email.trim(), password });
        if (!response.data?.user) throw new Error("The login response did not include a user.");
        await onAuthenticated(response.data.user);
      }
    } catch (cause) { setError(cause); }
    finally { setPending(false); }
  }
  return <main className="auth-shell">
    <section className="auth-aside"><Logo light/><div className="auth-copy"><Badge tone="blue">Founder-controlled sales workspace</Badge><h1>Find the right companies. Reach the right people.</h1><p>Organize ideal customer profiles, evaluate stored prospects, and prepare thoughtful outreach with a human in control at every step.</p><div className="auth-benefits"><div><span><Icon name="target" size={17}/></span><div><b>Focus your customer profile</b><small>Keep qualification criteria explicit.</small></div></div><div><span><Icon name="check-square" size={17}/></span><div><b>Review before outreach</b><small>Draft, approve, then hand off to email.</small></div></div><div><span><Icon name="activity" size={17}/></span><div><b>Track what you know</b><small>No inbox sync or delivery claims.</small></div></div></div></div><p className="auth-footnote">BlueCode OS · MVP preview</p></section>
    <section className="auth-panel"><form className="auth-card" onSubmit={submit}><Logo/><div className="auth-heading"><h2>{isRegister ? "Create your account" : "Welcome back"}</h2><p>{isRegister ? "Create an account to get started." : "Sign in to continue to your workspace."}</p></div>
      {isRegister && <Field label="Full name" name="name" value={name} onChange={setName} placeholder="Your name" required minLength={1} maxLength={80} autoComplete="name"/>}
      <Field label="Email address" name="email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required autoComplete="email"/>
      <Field label="Password" name="password" type="password" value={password} onChange={setPassword} placeholder={isRegister ? "At least 10 characters" : "Your password"} required minLength={isRegister ? 10 : 1} autoComplete={isRegister ? "new-password" : "current-password"}/>
      {Boolean(error) && <InlineFeedback error={error}/>}{message && <InlineFeedback success={message}/>}
      <Button type="submit" className="button-full" loading={pending}>{isRegister ? "Create account" : "Sign in"}<Icon name="arrow" size={16}/></Button>
      <p className="auth-switch">{isRegister ? "Already have an account?" : "New to BlueCode OS?"} <button type="button" onClick={() => navigate(isRegister ? "/login" : "/register")}>{isRegister ? "Sign in" : "Create account"}</button></p>
      <p className="auth-security"><Icon name="check" size={14}/> Session is managed with a secure cookie. No token is stored in the browser app.</p>
    </form></section>
  </main>;
}

function WorkspacePicker({ navigate, setActiveWorkspace, activeWorkspaceId }: { navigate: (path: string) => void; setActiveWorkspace: (id: string) => void; activeWorkspaceId: string }) {
  const { data, loading, error, reload } = useRemote<{ startups: RecordValue[] }>("/api/v1/startups");
  const [creating, setCreating] = useState(false); const [name, setName] = useState("");
  const create = useMutation();
  const rows = data?.startups || [];
  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await create.execute(() => api.post<RecordValue>("/api/v1/startups", { name: name.trim() }), "Workspace created.");
    if (response) { const id = getId(response.data); if (id) { setActiveWorkspace(id); navigate("/dashboard"); } else reload(); }
  }
  return <main className="center-shell"><div className="workspace-wrap"><Logo/><div className="workspace-heading"><div><h1>{creating ? "Create a workspace" : "Choose a workspace"}</h1><p>{creating ? "A workspace keeps your sales data separated from other teams." : "Select a workspace to continue."}</p></div>{!creating && <Button icon="plus" onClick={() => { setCreating(true); setName(""); }}>Create workspace</Button>}</div>
    {loading && <LoadingState label="Loading your workspaces…"/>}{error && <ErrorState error={error} retry={reload}/>}
    {!loading && !error && !creating && rows.length === 0 && <EmptyState title="No workspace yet" description="Create your first workspace to keep your customer profiles and outreach together." action={<Button icon="plus" onClick={() => setCreating(true)}>Create workspace</Button>}/>}
    {!loading && !error && !creating && rows.length > 0 && <div className="workspace-list">{rows.map((workspace) => { const id = getId(workspace); return <button className={`workspace-card ${activeWorkspaceId === id ? "workspace-card-selected" : ""}`} key={id || workspace.startupName} onClick={() => { if (id) { setActiveWorkspace(id); navigate("/dashboard"); } }}><span className="workspace-avatar"><AppMark name={workspace.startupName}/></span><span><b>{workspace.startupName || workspace.name || "Workspace"}</b><small>{workspace.role || "Member"} · {workspace.plan || "Plan not specified"}</small></span><StatusBadge value={workspace.startupStatus || workspace.status || "unknown"}/><Icon name="chevron" size={18}/></button>; })}</div>}
    {creating && <form className="card form-card workspace-create" onSubmit={createWorkspace}><Field label="Workspace name" value={name} onChange={setName} placeholder="e.g. Acme Ventures" required minLength={1} maxLength={80}/><p className="field-help">Creating a workspace does not configure or promise a specific spend cap.</p><InlineFeedback error={create.error} success={create.success}/><div className="form-actions"><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" loading={create.pending}>Create workspace</Button></div></form>}
    <p className="workspace-note"><Icon name="info" size={15}/> API permissions and workspace membership are validated by the server.</p>
  </div></main>;
}

function AppShell({ user, startupId, navigate, location, onLogout, setActiveWorkspace }: {
  user: AppUser; startupId: string; navigate: (path: string, replace?: boolean) => void; location: BrowserLocation; onLogout: () => void; setActiveWorkspace: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const current = useRemote<{ startup: RecordValue }>("/api/v1/startups/current", startupId);
  const startup = current.data?.startup;
  const cap = startup?.capabilities || {};
  const spend = startup?.spend || {};
  const spendConfigured = typeof spend.capPaise === "number" && spend.capPaise > 0;
  const trialExpired = startup?.status === "trial_expired";
  const budgetExhausted = startup?.status === "budget_blocked" || (spendConfigured && typeof spend.remainingPaise === "number" && spend.remainingPaise <= 0);
  const activePath = location.pathname;
  useEffect(() => {
    if (current.error instanceof ApiRequestError && ["NOT_A_MEMBER", "UNAUTHENTICATED"].includes(current.error.code)) {
      setActiveWorkspace(""); navigate(current.error.code === "UNAUTHENTICATED" ? "/login" : "/workspaces", true);
    }
  }, [current.error, navigate, setActiveWorkspace]);
  const navTo = (path: string) => { navigate(path); setMenuOpen(false); };
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}><div className="sidebar-brand"><Logo light/><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close"/></button></div>
      <div className="sidebar-workspace"><span className="mini-avatar">{(startup?.name || "W").slice(0, 1).toUpperCase()}</span><span><b>{startup?.name || "Active workspace"}</b><small>{startup?.me?.role || "Workspace member"}</small></span><button aria-label="Switch workspace" onClick={() => navTo("/workspaces")}>⌄</button></div>
      <nav>{navItems.map((item) => { const active = activePath === item.path || (item.path === "/outreach" && activePath.startsWith("/outreach/")) || (item.path === "/prospects" && activePath.startsWith("/prospects/")) || (item.path === "/icps" && activePath.startsWith("/icps/")); return <button key={item.path} className={active ? "active" : ""} onClick={() => navTo(item.path)}><Icon name={item.icon} size={17}/><span>{item.label}</span></button>; })}</nav>
      <div className="sidebar-footer"><div className="avatar">{user.name?.trim().slice(0, 1).toUpperCase() || "U"}</div><div className="user-details"><b>{user.name || "Workspace user"}</b><small>{user.email}</small></div><button className="icon-button logout-button" aria-label="Sign out" title="Sign out" onClick={onLogout}><Icon name="logout" size={16}/></button></div>
    </aside>
    {menuOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <div className="app-main"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="topbar-context"><span className="topbar-breadcrumb">Workspace</span><span className="topbar-separator">/</span><b>{startup?.name || "Loading…"}</b></div><div className="top-actions"><span className="topbar-spend" title={spendConfigured ? "Remaining configured workspace budget, as reported by the API" : "A spend cap has not been configured"}>{spendConfigured ? `${formatMoneyPaise(spend.remainingPaise, "estimated")} remaining` : "Spend not configured"}</span><span className="topbar-plan">{startup?.plan ? String(startup.plan).toUpperCase() : "MVP PREVIEW"}</span><span className="avatar top-avatar" aria-label="Signed in as current user" title={user.email}>{user.name?.trim().slice(0, 1).toUpperCase() || "U"}</span></div></header>
      {startup && (trialExpired || budgetExhausted) && <div className="global-banner"><Icon name="info" size={17}/><span>{trialExpired ? "Your trial has ended. Existing data remains available, but some write actions may be blocked by the backend." : "This workspace has reached its configured usage limit. Paid actions may be blocked by the backend."}</span></div>}
      {current.loading && <div className="shell-loading"><LoadingState label="Verifying workspace access…"/></div>}
      {current.error && <div className="content"><ErrorState error={current.error} retry={current.reload}/><Button variant="secondary" onClick={() => navigate("/workspaces")}>Choose workspace</Button></div>}
      {startup && !current.error && <main className="content">{renderRoute({ path: location.pathname, search: location.search, startupId, startup, capabilities: cap, navigate, reloadWorkspace: current.reload, user })}</main>}
    </div>
  </div>;
}

function renderRoute(context: { path: string; search: string; startupId: string; startup: RecordValue; capabilities: RecordValue; navigate: (path: string) => void; reloadWorkspace: () => void; user: AppUser }) {
  const { path } = context;
  if (path === "/" || path === "/dashboard") return <DashboardPage {...context}/>;
  if (path === "/icps" || path === "/icps/new" || /^\/icps\/[^/]+$/.test(path)) return <IcpPage key={path} {...context}/>;
  if (path === "/prospects" || path === "/prospects/discover" || /^\/prospects\/[^/]+$/.test(path)) return <ProspectsPage {...context}/>;
  if (path === "/outreach" || /^\/outreach\/[^/]+$/.test(path) || path === "/outreach/messages" || /^\/outreach\/messages\/[^/]+$/.test(path)) return <OutreachPage {...context}/>;
  if (path === "/next-actions") return <NextActionsPage {...context}/>;
  if (path === "/activity") return <ActivityPage {...context}/>;
  if (path === "/usage") return <UsagePage {...context}/>;
  if (path === "/settings") return <SettingsPage {...context}/>;
  return <div className="page-stack"><PageHeader title="Page not found" description="This route is not part of the BlueCode OS MVP preview."/><section className="card panel"><Button onClick={() => context.navigate("/dashboard")}>Back to dashboard</Button></section></div>;
}

type PageContext = { path: string; search: string; startupId: string; startup: RecordValue; capabilities: RecordValue; navigate: (path: string) => void; reloadWorkspace: () => void; user: AppUser };

function DashboardPage({ startupId, navigate, user }: PageContext) {
  const remote = useRemote<RecordValue>("/api/v1/dashboard", startupId);
  const summary = useRemote<RecordValue>("/api/v1/usage/summary", startupId);
  const dashboard = remote.data || {};
  const today = dashboard.today || {};
  const funnel = dashboard.funnel || {};
  const stages = [
    ["Discovered", funnel.discovered], ["Qualified", funnel.qualified], ["With email", funnel.contactsWithEmail],
    ["Approved", funnel.approvedDrafts], ["Handoff requested", funnel.handedOff], ["Marked sent by you", funnel.userReportedSent], ["Replies logged", funnel.repliesLogged],
  ] as [string, unknown][];
  const maxValue = Math.max(1, ...stages.map(([, v]) => typeof v === "number" ? v : 0));
  const usage = summary.data || {};
  return <div className="page-stack"><PageHeader title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`} description="A grounded snapshot of what your workspace has recorded." action={<Button icon="plus" onClick={() => navigate("/icps/new")}>Create ICP</Button>}/>
    {remote.loading && <LoadingState/>}{Boolean(remote.error) && (<ErrorState error={remote.error} retry={remote.reload}/>)}
    {remote.data && <>
      <div className="metrics">
        <MetricCard label="Prospects found" value={today.prospectsFound} icon="building" detail="Recorded in this workspace"/>
        <MetricCard label="Hot & high fit" value={today.hotAndHigh} icon="target" detail="Rules-based estimates"/>
        <MetricCard label="Drafts awaiting approval" value={today.draftsPendingApproval} icon="mail" detail="Human review required"/>
        <MetricCard label="Ready for email handoff" value={today.readyForHandoff} icon="send" detail="Not sent automatically"/>
      </div>
      <div className="dash-grid">
        <section className="card panel"><div className="panel-heading"><div><h2>Recorded outreach funnel</h2><p>These are workspace events, not delivery analytics.</p></div><Badge>API reported</Badge></div>
          <div className="funnel honest-funnel">{stages.map(([label, raw]) => { const count = typeof raw === "number" ? raw : 0; return <div className="funnel-row" key={label}><span>{label}</span><div className="funnel-bar"><i style={{ width: `${Math.max(count > 0 ? 2 : 0, (count / maxValue) * 100)}%` }}/></div><b>{typeof raw === "number" ? raw : "—"}</b></div>; })}</div>
          <p className="footnote">“Marked sent by you” is founder-reported. BlueCode cannot verify sending or delivery.</p>
        </section>
        <section className="card panel"><div className="panel-heading"><div><h2>Next actions</h2><p>Recommendations are never executed automatically.</p></div><button className="text-button" onClick={() => navigate("/next-actions")}>View all <Icon name="arrow" size={14}/></button></div>
          <div className="action-list">{Array.isArray(dashboard.topActions) && dashboard.topActions.length ? dashboard.topActions.slice(0, 5).map((action: RecordValue) => <div className="action-item" key={action.id}><span className={`action-dot ${action.priority === "high" ? "amber" : "blue"}`}/><div><b>{action.title || "Recommendation"}</b><small>{action.reason || action.actionType || "Review the suggested next step"}</small></div><button className="text-button" onClick={() => navigate("/next-actions")}>Review</button></div>) : <EmptyState title="No pending recommendations" description="New suggestions appear when supported by recorded workspace activity."/>}</div>
        </section>
      </div>
      <div className="dash-grid lower">
        <section className="card panel"><div className="panel-heading"><div><h2>Start with the essentials</h2><p>A simple workflow for a new workspace.</p></div></div><div className="checklist"><ChecklistItem step="01" title="Create an ideal customer profile" description="Define the criteria used to qualify stored prospects." onClick={() => navigate("/icps/new")}/><ChecklistItem step="02" title="Review prospect records" description="Search and qualify companies already in your workspace." onClick={() => navigate("/prospects")}/><ChecklistItem step="03" title="Prepare approved outreach" description="Create drafts, review them, then use your email app." onClick={() => navigate("/outreach")}/></div></section>
        <section className="card panel"><div className="panel-heading"><div><h2>Usage overview</h2><p>Values reported by the API.</p></div><button className="text-button" onClick={() => navigate("/usage")}>Details <Icon name="arrow" size={14}/></button></div>{summary.loading && <LoadingState label="Loading usage…"/>}{summary.error && <ErrorState error={summary.error} retry={summary.reload} compact/>}{usage.spend && <><div className="usage-highlight"><span>Remaining configured budget</span><strong>{typeof usage.spend.capPaise === "number" && usage.spend.capPaise > 0 ? formatMoneyPaise(usage.spend.remainingPaise, usage.spend.costType) : "Not configured"}</strong><small>{typeof usage.spend.capPaise === "number" && usage.spend.capPaise > 0 ? `Cost type: ${usage.spend.costType || "not specified"}` : "The workspace spend cap has not been frozen."}</small></div><div className="usage-row"><span>Trial days left</span><b>{typeof usage.trialDaysLeft === "number" ? usage.trialDaysLeft : "Not reported"}</b></div><div className="usage-row"><span>ICP entitlement</span><b>{usage.entitlements?.icps?.limit == null ? `${usage.entitlements?.icps?.used ?? "—"} used · limit unconfigured` : `${usage.entitlements.icps.used} / ${usage.entitlements.icps.limit}`}</b></div></>}</section>
      </div>
    </>}
  </div>;
}

function MetricCard({ label, value, detail, icon }: { label: string; value: unknown; detail: string; icon: string }) {
  return <div className="metric card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon name={icon} size={17}/></span></div><strong>{typeof value === "number" ? value.toLocaleString() : "—"}</strong><small>{detail}</small></div>;
}

function ChecklistItem({ step, title, description, onClick }: { step: string; title: string; description: string; onClick: () => void }) {
  return <button className="checklist-item" onClick={onClick}><span>{step}</span><div><b>{title}</b><small>{description}</small></div><Icon name="arrow" size={16}/></button>;
}

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

function IcpPage({ path, startupId, navigate }: PageContext) {
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
    {detail.loading && editingExisting && <LoadingState label="Loading ICP…"/>}{detail.error && <ErrorState error={detail.error} retry={detail.reload}/>}
    {(!editingExisting || detail.data) && <>
      {!editingExisting && <section className="card panel"><div className="section-heading"><h2>Start with a description</h2><p>Describe what you sell and the companies you want to reach.</p></div><Notice tone="warning" title="Proposal preview">In mock mode, the backend may return a deterministic demo fixture rather than live AI advice. Review every criterion before saving; live AI use remains gated by backend configuration and approved cost estimates.</Notice><form onSubmit={propose} className="form-grid form-grid-single"><TextArea label="Product or service description" value={description} onChange={setDescription} placeholder="Describe your product, target customer, and problem it solves…" required minLength={20} maxLength={2000} help="20–2,000 characters required by the API."/><div className="form-grid"><Field label="Target geography" value={geography} onChange={setGeography} placeholder="e.g. India"/><Field label="Sales objective" value={objective} onChange={setObjective} placeholder="e.g. Find product-led SaaS teams"/></div><TextArea label="Additional notes (optional)" value={notes} onChange={setNotes} placeholder="Any constraints or exclusions…" maxLength={2000} rows={2}/><div className="form-actions"><Button type="submit" loading={mutation.pending} icon="target">Propose criteria</Button></div></form><InlineFeedback error={mutation.error} success={mutation.success}/></section>}
      <form className="card panel" onSubmit={saveIcp}><div className="section-heading"><h2>{editingExisting ? "Review criteria" : "Review and save"}</h2><p>All fields can be edited. Each list accepts comma-separated values, up to 25 items.</p></div>
        <div className="field"><span>Profile name</span><input value={name} required maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. B2B SaaS — India"/></div>
        {!editingExisting && <p className="field-help">Generate a proposal first or enter criteria manually and save.</p>}
        {proposalReady && rationale && <Notice title="Proposal rationale">{rationale}</Notice>}
        <div className="criteria-grid">{criteriaFields.map((field) => <label className="field" key={field.key}><span>{field.label}</span><input value={criteriaText[field.key] || ""} onChange={(event) => setCriteriaText((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder}/><small className="field-help">Comma-separated · maximum 25 values</small></label>)}</div>
        <InlineFeedback error={mutation.error}/><div className="form-actions"><Button variant="secondary" onClick={() => navigate("/icps")}>Cancel</Button><Button type="submit" loading={mutation.pending}>{editingExisting ? "Save changes" : "Save ICP"}</Button></div>
      </form>
    </>}
  </div>;
  return <div className="page-stack"><PageHeader title="Ideal customer profiles" description="Manage the criteria that organize and qualify prospects." action={<Button icon="plus" onClick={() => navigate("/icps/new")}>Create ICP</Button>}/>
    {list.loading && <LoadingState/>}{list.error && <ErrorState error={list.error} retry={list.reload}/>}
    {list.data && list.data.length === 0 && <EmptyState title="No ICPs yet" description="Create an ideal customer profile before selecting or scoring prospects." action={<Button icon="plus" onClick={() => navigate("/icps/new")}>Create ICP</Button>}/>}
    {list.data && list.data.length > 0 && <DataTable><thead><tr><th>Profile</th><th>Criteria summary</th><th>Version</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{list.data.map((icp) => <tr key={icp.id}><td><div className="table-primary"><AppMark name={icp.name}/><div><b>{icp.name}</b><small>{icp.id}</small></div></div></td><td>{criteriaSummary(icp.criteria)}</td><td>{icp.criteriaVersion ?? "—"}</td><td><StatusBadge value={icp.isActive ? "active" : "archived"}/></td><td>{formatDate(icp.createdAt)}</td><td><div className="table-actions"><Button variant="ghost" onClick={() => navigate(`/icps/${encodeURIComponent(icp.id)}`)}>Edit</Button>{icp.isActive && <Button variant="ghost" onClick={() => void archiveIcp(icp.id)}>Archive</Button>}</div></td></tr>)}</tbody></DataTable>}
    <InlineFeedback error={mutation.error} success={mutation.success}/>
  </div>;
}

function criteriaSummary(criteria: unknown): string {
  if (!isRecord(criteria)) return "No criteria saved";
  const parts = ["industries", "employeeRanges", "countries"].flatMap((key) => Array.isArray(criteria[key]) && criteria[key].length ? [`${key === "industries" ? "Industry" : key === "employeeRanges" ? "Employees" : "Countries"}: ${criteria[key].slice(0, 3).join(", ")}`] : []);
  return parts.length ? parts.join(" · ") : "Criteria configured";
}

function ProspectsPage({ path, search, startupId, capabilities, navigate }: PageContext) {
  const isDiscover = path === "/prospects/discover";
  const selectedId = path !== "/prospects" && !isDiscover ? path.split("/")[2] : "";
  if (selectedId) return <ProspectDetailPage key={selectedId} prospectId={selectedId} startupId={startupId} navigate={navigate}/>;
  if (isDiscover) return <DiscoveryPage startupId={startupId} capabilities={capabilities} navigate={navigate}/>;
  return <ProspectListPage key={search} startupId={startupId} navigate={navigate} search={search} capabilities={capabilities}/>;
}

function ProspectListPage({ startupId, navigate, search, capabilities }: { startupId: string; navigate: (path: string) => void; search: string; capabilities: RecordValue }) {
  const searchParams = new URLSearchParams(search);
  const [q, setQ] = useState(searchParams.get("q") || ""); const [icpId, setIcpId] = useState(searchParams.get("icpId") || ""); const [scoredAgainstIcpId, setScoredAgainstIcpId] = useState(searchParams.get("scoredAgainstIcpId") || ""); const [status, setStatus] = useState(searchParams.get("status") || ""); const [category, setCategory] = useState(searchParams.get("category") || ""); const [minScore, setMinScore] = useState(searchParams.get("minScore") || ""); const [showLow, setShowLow] = useState(searchParams.get("includeLow") === "true"); const [page, setPage] = useState(Number(searchParams.get("page") || 1)); const [selected, setSelected] = useState<string[]>([]); const [scoreIcpId, setScoreIcpId] = useState("");
  const icps = useRemote<RecordValue[]>("/api/v1/icps?isActive=true&limit=100", startupId);
  // Fetch only applied URL filters, not every keystroke in the draft filter controls.
  const appliedPage = Math.max(1, Number(searchParams.get("page") || 1));
  const endpoint = `/api/v1/prospects${queryString({
    q: searchParams.get("q") || undefined,
    icpId: searchParams.get("icpId") || undefined,
    scoredAgainstIcpId: searchParams.get("scoredAgainstIcpId") || undefined,
    status: searchParams.get("status") || undefined,
    category: searchParams.get("category") || undefined,
    minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined,
    includeLow: searchParams.get("includeLow") === "true" ? true : undefined,
    page: appliedPage, limit: 20, sort: "-createdAt",
  })}`;
  const list = useRemote<RecordValue[]>(endpoint, startupId);
  const action = useMutation();
  useEffect(() => { const values = icps.data || []; if (!scoreIcpId && values[0]?.id) setScoreIcpId(values[0].id); }, [icps.data, scoreIcpId]);
  function applyFilters(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPage(1); navigate(`/prospects${queryString({ q: q.trim() || undefined, icpId: icpId || undefined, scoredAgainstIcpId: scoredAgainstIcpId || undefined, status: status || undefined, category: category || undefined, minScore: minScore.trim() ? Number(minScore) : undefined, includeLow: showLow || undefined, page: 1 })}`); }
  function goPage(nextPage: number) { setPage(nextPage); navigate(`/prospects${queryString({ q: searchParams.get("q") || undefined, icpId: searchParams.get("icpId") || undefined, scoredAgainstIcpId: searchParams.get("scoredAgainstIcpId") || undefined, status: searchParams.get("status") || undefined, category: searchParams.get("category") || undefined, minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined, includeLow: searchParams.get("includeLow") === "true" ? true : undefined, page: nextPage })}`); }
  const rows = list.data || [];
  const meta = list.meta || {};
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((v) => v !== id) : current.length < 50 ? [...current, id] : current); }
  async function selectForOutreach() {
    if (!selected.length) return;
    const result = await action.execute(() => api.post<RecordValue>("/api/v1/prospects/select", { prospectIds: selected }, startupId));
    if (result) { const skipped = Array.isArray(result.data?.skipped) ? result.data.skipped.length : 0; action.setSuccess(`${typeof result.data?.updated === "number" ? result.data.updated : 0} prospect(s) updated${skipped ? `; ${skipped} skipped by backend rules` : ""}.`); setSelected([]); list.reload(); }
  }
  async function scoreSelected() {
    if (!selected.length || !scoreIcpId) return;
    const result = await action.execute(() => api.post<RecordValue>("/api/v1/prospects/score", { prospectIds: selected, icpId: scoreIcpId }, startupId));
    if (result) { action.setSuccess(`${typeof result.data?.scored === "number" ? result.data.scored : 0} prospect(s) scored by the deterministic backend rules.`); setSelected([]); list.reload(); }
  }
  return <div className="page-stack"><PageHeader title="Prospects" description="Review stored companies and the scores calculated against your ICPs." action={<Button variant="secondary" icon="search" onClick={() => navigate("/prospects/discover")}>Discover prospects</Button>}/>
    {!capabilities.searchOrgs ? <Notice title="Live company discovery is disabled">Apollo organization search is not available in this preview. This list only displays prospect records already stored by the backend.</Notice> : <Notice title="Company discovery capability is reported enabled">Only results returned by the backend are shown. The server remains authoritative about capability, commercial terms, and any spend limits.</Notice>}
    <form className="filterbar card" onSubmit={applyFilters}><div className="searchbox"><Icon name="search" size={17}/><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search stored companies" aria-label="Search stored companies" maxLength={100}/></div><select aria-label="Origin ICP" value={icpId} onChange={(event) => setIcpId(event.target.value)}><option value="">All origin ICPs</option>{(icps.data || []).map((icp) => <option key={icp.id} value={icp.id}>{icp.name}</option>)}</select><select aria-label="Score against ICP" value={scoredAgainstIcpId} onChange={(event) => setScoredAgainstIcpId(event.target.value)}><option value="">Any scored ICP</option>{(icps.data || []).map((icp) => <option key={icp.id} value={icp.id}>{icp.name}</option>)}</select><select aria-label="Prospect status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="discovered">Discovered</option><option value="qualified">Qualified</option><option value="disqualified">Disqualified</option><option value="do_not_contact">Do not contact</option></select><select aria-label="Score category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All score categories</option><option value="hot">Hot</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><label className="field filter-min-score"><span>Minimum score</span><input type="number" min="0" max="100" value={minScore} onChange={(event) => setMinScore(event.target.value)} placeholder="0–100"/></label><label className="toggle-field"><input type="checkbox" checked={showLow} onChange={(event) => setShowLow(event.target.checked)}/><span>Include low-fit</span></label><Button type="submit" icon="filter">Apply filters</Button></form>
    {selected.length > 0 && <section className="bulk-toolbar card"><div><b>{selected.length} selected</b><small>Choose the action to apply to selected stored records.</small></div><select value={scoreIcpId} onChange={(event) => setScoreIcpId(event.target.value)} aria-label="Scoring ICP">{(icps.data || []).map((icp) => <option key={icp.id} value={icp.id}>{icp.name}</option>)}</select><Button variant="secondary" onClick={() => void scoreSelected()} loading={action.pending} disabled={!scoreIcpId}>Score against ICP</Button><Button onClick={() => void selectForOutreach()} loading={action.pending}>Select for outreach</Button><Button variant="ghost" onClick={() => setSelected([])}>Clear</Button></section>}
    {action.error && <InlineFeedback error={action.error}/>}{action.success && <InlineFeedback success={action.success}/>}
    {list.loading && <LoadingState/>}{list.error && <ErrorState error={list.error} retry={list.reload}/>}
    {list.data && rows.length === 0 && <EmptyState title="No stored prospects match" description={capabilities.searchOrgs ? "Try a different search or filter. Only backend-returned prospects appear here." : "Try a different search or filter. Company discovery is currently disabled in this workspace."} action={<Button variant="secondary" onClick={() => { setQ(""); setIcpId(""); setScoredAgainstIcpId(""); setStatus(""); setCategory(""); setMinScore(""); setScoreIcpId(""); setShowLow(false); setPage(1); navigate("/prospects"); }}>Clear filters</Button>}/>}
    {list.data && rows.length > 0 && <><DataTable><thead><tr><th><input type="checkbox" aria-label="Select all visible prospects" checked={rows.length > 0 && rows.every((row) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? rows.slice(0, 50).map((row) => row.id) : [])}/></th><th>Company</th><th>Industry</th><th>Employees</th><th>Fit score</th><th>Status</th><th>Updated</th><th/></tr></thead><tbody>{rows.map((prospect) => { const firmographics = prospect.firmographics || {}; const score = prospect.latestScore || {}; return <tr key={prospect.id}><td><input type="checkbox" checked={selected.includes(prospect.id)} onChange={() => toggle(prospect.id)} aria-label={`Select ${prospect.name}`}/></td><td><button className="table-link" onClick={() => navigate(`/prospects/${encodeURIComponent(prospect.id)}`)}><span className="table-primary"><AppMark name={prospect.name}/><span><b>{prospect.name}</b><small>{prospect.domain || "Domain not stored"}</small></span></span></button></td><td>{firmographics.industry || "—"}</td><td>{typeof firmographics.employeeCount === "number" ? firmographics.employeeCount.toLocaleString() : "—"}</td><td><ScoreBadge score={score.score ?? prospect.score} category={score.category || prospect.category} coverage={score.coverage}/></td><td><StatusBadge value={prospect.status}/></td><td>{formatDate(prospect.updatedAt)}</td><td><Button variant="ghost" onClick={() => navigate(`/prospects/${encodeURIComponent(prospect.id)}`)}>View</Button></td></tr>; })}</tbody></DataTable><div className="pagination"><span>{typeof meta.total === "number" ? `${meta.total.toLocaleString()} records` : "Stored prospects"} · Page {meta.page || page}</span><div><Button variant="secondary" disabled={page <= 1 || list.loading} onClick={() => goPage(Math.max(1, page - 1))}>Previous</Button><Button variant="secondary" disabled={rows.length < 20 || list.loading} onClick={() => goPage(page + 1)}>Next</Button></div></div></>}
  </div>;
}

function DiscoveryPage({ startupId, capabilities, navigate }: { startupId: string; capabilities: RecordValue; navigate: (path: string) => void }) {
  const icps = useRemote<RecordValue[]>("/api/v1/icps?isActive=true&limit=100", startupId);
  const [icpId, setIcpId] = useState(""); const [page, setPage] = useState(1);
  const mutation = useMutation();
  useEffect(() => { if (!icpId && icps.data?.[0]?.id) setIcpId(icps.data[0].id); }, [icps.data, icpId]);
  async function discover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!icpId) return;
    await mutation.execute(() => api.post<RecordValue>("/api/v1/prospects/search", { icpId, page, perPage: 25 }, startupId));
  }
  return <div className="page-stack"><PageHeader title="Discover prospects" description="Search capability status for your selected customer profile." action={<Button variant="secondary" onClick={() => navigate("/prospects")}>Back to prospects</Button>}/>
    {!capabilities.searchOrgs ? <Notice tone="warning" title="Company discovery isn't available right now">The current workspace reports live organization search as disabled. The UI will not create fabricated search results or retry this request automatically.</Notice> : <Notice title="Company discovery capability is reported enabled">The backend still decides whether a search can run. Review the API response and any usage effects; unavailable capability errors will not be retried automatically.</Notice>}
    <section className="card panel discovery-panel"><div className="discovery-illustration"><div className="discovery-orbit"><Icon name="search" size={36}/></div><span className="discovery-dot dot-one"/><span className="discovery-dot dot-two"/></div><form onSubmit={discover} className="discovery-form"><div className="section-heading"><h2>Choose an active ICP</h2><p>{capabilities.searchOrgs ? "The backend decides whether a search can run." : "Discovery is gated until the backend capability is enabled."}</p></div><label className="field"><span>Ideal customer profile</span><select value={icpId} onChange={(event) => setIcpId(event.target.value)} required><option value="">Select an ICP</option>{(icps.data || []).map((icp) => <option key={icp.id} value={icp.id}>{icp.name}</option>)}</select></label><label className="field"><span>Page</span><select value={page} onChange={(event) => setPage(Number(event.target.value))}><option value={1}>Page 1</option><option value={2}>Page 2</option><option value={3}>Page 3</option></select></label><Button type="submit" loading={mutation.pending} disabled={!capabilities.searchOrgs || !icpId}>Find companies</Button><small className="field-help">Capability: {capabilities.searchOrgs ? "Reported enabled — server response will decide" : "Disabled by workspace"}</small><InlineFeedback error={mutation.error}/></form></section>
  </div>;
}

function ProspectDetailPage({ prospectId, startupId, navigate }: { prospectId: string; startupId: string; navigate: (path: string) => void }) {
  const detail = useRemote<RecordValue>(`/api/v1/prospects/${encodeURIComponent(prospectId)}`, startupId);
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") || "Overview");
  const [showContactForm, setShowContactForm] = useState(false);
  const [contact, setContact] = useState({ fullName: "", jobTitle: "", businessEmail: "", linkedinUrl: "" });
  const mutation = useMutation();
  const prospect = detail.data?.prospect || {};
  const scores: RecordValue[] = detail.data?.scores || [];
  const signals: RecordValue[] = detail.data?.signals || [];
  const contacts: RecordValue[] = detail.data?.contacts || [];
  const activity: RecordValue[] = detail.data?.recentActivity || [];
  const originScore = scores.find((item) => item.icpId === prospect.icpId)?.latest;
  const selectedScore = originScore || prospect.latestScore || scores[0]?.latest || {};
  const selectedIcpId = prospect.icpId || scores[0]?.icpId || "";
  const setDetailTab = (value: string) => { setTab(value); window.history.replaceState({}, "", `/prospects/${encodeURIComponent(prospectId)}?tab=${encodeURIComponent(value.toLowerCase())}`); };
  async function detailAction(action: string, body: unknown = {}) {
    const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/prospects/${encodeURIComponent(prospectId)}/${action}`, body, startupId), "Prospect updated.");
    if (result) detail.reload();
  }
  async function scoreAgain() {
    const icpId = selectedIcpId;
    if (!icpId) { mutation.setSuccess(""); return; }
    const result = await mutation.execute(() => api.post<RecordValue>("/api/v1/prospects/score", { prospectIds: [prospectId], icpId }, startupId), "Score refreshed from stored fields.");
    if (result) detail.reload();
  }
  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      fullName: contact.fullName.trim(),
      businessEmail: contact.businessEmail.trim(),
      ...(contact.jobTitle.trim() ? { jobTitle: contact.jobTitle.trim() } : {}),
      ...(contact.linkedinUrl.trim() ? { linkedinUrl: contact.linkedinUrl.trim() } : {}),
    };
    const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/prospects/${encodeURIComponent(prospectId)}/decision-makers`, payload, startupId), "Contact added manually.");
    if (result) { setContact({ fullName: "", jobTitle: "", businessEmail: "", linkedinUrl: "" }); setShowContactForm(false); detail.reload(); }
  }
  if (detail.loading) return <div className="page-stack"><Button variant="ghost" onClick={() => navigate("/prospects")}>← Back to prospects</Button><LoadingState/></div>;
  if (detail.error) return <div className="page-stack"><Button variant="ghost" onClick={() => navigate("/prospects")}>← Back to prospects</Button><ErrorState error={detail.error} retry={detail.reload}/></div>;
  const firmographics = prospect.firmographics || {};
  return <div className="page-stack"><button className="back-link" onClick={() => navigate("/prospects")}>← Back to prospects</button><div className="prospect-heading card"><div className="prospect-title"><AppMark name={prospect.name}/><div><div className="prospect-title-line"><h1>{prospect.name || "Prospect"}</h1><StatusBadge value={prospect.status}/></div><p>{prospect.domain || "Domain not stored"} · Origin ICP: {prospect.icpId || "Not reported"}</p><div className="prospect-header-badges"><ScoreBadge score={selectedScore.score} category={selectedScore.category} coverage={selectedScore.coverage}/></div></div></div><div className="prospect-actions"><Button variant="secondary" onClick={() => setDetailTab("Contacts")}>Contacts</Button>{prospect.status !== "do_not_contact" ? <><Button variant="secondary" onClick={() => { const reason = window.prompt("Optional reason for disqualifying this prospect (up to 300 characters):"); if (reason !== null) void detailAction("disqualify", reason.trim() ? { reason: reason.trim().slice(0, 300) } : {}); }}>Disqualify</Button><Button variant="danger" onClick={() => { if (window.confirm("Mark this prospect and its saved contacts do-not-contact?")) void detailAction("do-not-contact", { reason: "Marked from prospect review" }); }}>Mark do-not-contact</Button></> : <Button variant="secondary" onClick={() => { const reason = window.prompt("Required reason to clear this prospect's DNC status (5–300 characters):"); if (reason && reason.trim().length >= 5 && reason.trim().length <= 300) void detailAction("clear-do-not-contact", { reason: reason.trim() }); else if (reason !== null) window.alert("Enter a reason between 5 and 300 characters."); }}>Review DNC</Button>}</div></div>
    <div className="tabbar" role="tablist">{["Overview", "Score", "Signals", "Contacts", "Outreach", "Activity"].map((item) => <button key={item} className={tab.toLowerCase() === item.toLowerCase() ? "active" : ""} onClick={() => setDetailTab(item)} role="tab" aria-selected={tab.toLowerCase() === item.toLowerCase()}>{item}</button>)}</div>
    <InlineFeedback error={mutation.error} success={mutation.success}/>
    {tab.toLowerCase() === "overview" && <div className="detail-grid"><section className="card panel"><div className="section-heading"><h2>Company overview</h2><p>Only firmographic fields returned by the API are shown.</p></div><DefinitionList rows={[["Website", prospect.domain], ["Industry", firmographics.industry], ["Company size", firmographics.employeeCount], ["Location", firmographics.location || firmographics.country], ["Founded", firmographics.foundedYear], ["Origin ICP", prospect.icpId]]}/></section><section className="card panel"><div className="section-heading"><h2>Qualification</h2><p>Rules-based estimate against a saved ICP.</p></div><div className="score-summary"><strong>{typeof selectedScore.score === "number" ? selectedScore.score : "—"}</strong><div><ScoreBadge score={selectedScore.score} category={selectedScore.category} coverage={selectedScore.coverage}/><p>{selectedScore.scoringVersion ? `Scoring version ${selectedScore.scoringVersion}` : "No score details available"}</p></div></div><Button variant="secondary" onClick={() => setDetailTab("Score")}>View score breakdown</Button></section><section className="card panel detail-wide"><div className="section-heading"><h2>Saved ICP scores</h2><p>Each score remains tied to its own ICP.</p></div>{scores.length ? <DataTable><thead><tr><th>ICP ID</th><th>Score estimate</th><th>Coverage</th><th>Scoring version</th></tr></thead><tbody>{scores.map((row) => <tr key={row.icpId}><td>{row.icpId}</td><td><ScoreBadge score={row.latest?.score} category={row.latest?.category} coverage={row.latest?.coverage}/></td><td>{typeof row.latest?.coverage === "number" ? `${Math.round(row.latest.coverage * 100)}%` : "—"}</td><td>{row.latest?.scoringVersion ?? "—"}</td></tr>)}</tbody></DataTable> : <EmptyState title="No saved score" description="Score this prospect against its origin ICP to see a deterministic breakdown."/>}</section></div>}
    {tab.toLowerCase() === "score" && <div className="detail-grid"><section className="card panel"><div className="section-heading"><h2>Deterministic score breakdown</h2><p>Score is an estimate from stored fields, not a prediction.</p></div>{selectedScore.breakdown && isRecord(selectedScore.breakdown) ? Object.entries(selectedScore.breakdown).map(([key, val]) => <div className="score-row" key={key}><span>{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</span><div className="score-track"><i style={{ width: `${Math.max(0, Math.min(100, Number((val as any)?.score ?? (val as any)?.points ?? val)))}%` }}/></div><b>{isRecord(val) ? String(val.score ?? val.points ?? val.value ?? "—") : String(val)}</b></div>) : <p className="muted-copy">No breakdown is stored for this prospect and ICP.</p>}<div className="form-actions score-actions"><Button variant="secondary" onClick={() => void scoreAgain()} loading={mutation.pending} disabled={!selectedIcpId}>Re-score from stored fields</Button><Button variant="secondary" disabled title="The frozen API document lists this endpoint, but the current scoring router does not register it yet.">Explain score (not wired)</Button></div></section><section className="card mock-panel"><Badge tone="amber">MOCK-ONLY when provided by API</Badge><h2>Score explanation</h2>{selectedScore.explanation ? <><p className="explanation-text">{selectedScore.explanation}</p><small>Source: {selectedScore.explanationSource || "not reported"} · Numeric score is unchanged by explanation.</small></> : <><p>The explanation endpoint can only explain an existing score. It must not change the score, category, coverage, breakdown, or scoring version.</p><p className="muted-copy">The frozen API document lists a mock explanation endpoint, but the current backend scoring router does not register it. This action stays disabled until the backend implementation and tests are in place. The frontend does not create explanations on its own.</p></>}</section></div>}
    {tab.toLowerCase() === "signals" && <section className="card panel"><div className="panel-heading"><div><h2>Evidence-backed signals</h2><p>Signals are grounded in stored data. No intent is inferred without evidence.</p></div><Button icon="refresh" onClick={() => void (async () => { const result = await mutation.execute(() => api.postNoBody<RecordValue>(`/api/v1/prospects/${encodeURIComponent(prospectId)}/signals/detect`, startupId), "Signal detection checked stored evidence."); if (result) detail.reload(); })()} loading={mutation.pending}>Detect from stored data</Button></div>{signals.length ? <div className="signal-list">{signals.map((signal) => <div className="signal-card" key={signal.id}><div className="signal-card-head"><Badge tone={signal.status === "stale" ? "amber" : "blue"}>{signal.status || "active"}</Badge><small>{formatDate(signal.detectedAt || signal.createdAt)}</small></div><h3>{signal.description || signal.signalType || "Signal"}</h3><p>{signal.description || "No description returned."}</p><div className="evidence-list">{isRecord(signal.evidence) ? Object.entries(signal.evidence).map(([key, value]) => <span key={key}><b>{key}:</b> {String(value)}</span>) : <span>{String(signal.evidence || "No evidence details returned")}</span>}</div>{signal.status !== "dismissed" && <div className="card-actions"><Button variant="ghost" onClick={() => void (async () => { const result = await mutation.execute(() => api.postNoBody<RecordValue>(`/api/v1/signals/${encodeURIComponent(signal.id)}/dismiss`, startupId), "Signal dismissed."); if (result) detail.reload(); })()}>Dismiss signal</Button></div>}</div>)}</div> : <EmptyState title="No signals found in available data" description="The detector checks evidence already stored with the prospect. It does not invent funding, growth, or buyer intent."/>}<InlineFeedback error={mutation.error} success={mutation.success}/></section>}
    {tab.toLowerCase() === "contacts" && <section className="card panel"><div className="panel-heading"><div><h2>Decision makers</h2><p>Manually added contacts are not verified unless the API explicitly reports verification.</p></div><Button icon="plus" onClick={() => setShowContactForm((value) => !value)}>Add contact manually</Button></div>{showContactForm && <form className="contact-create-form" onSubmit={addContact}><div className="form-grid"><Field label="Full name" value={contact.fullName} onChange={(value) => setContact((c) => ({ ...c, fullName: value }))} required maxLength={120}/><Field label="Job title" value={contact.jobTitle} onChange={(value) => setContact((c) => ({ ...c, jobTitle: value }))} maxLength={120}/><Field label="Business email" type="email" value={contact.businessEmail} onChange={(value) => setContact((c) => ({ ...c, businessEmail: value }))} required/><Field label="LinkedIn URL (optional)" value={contact.linkedinUrl} onChange={(value) => setContact((c) => ({ ...c, linkedinUrl: value }))} placeholder="https://www.linkedin.com/in/…"/></div><InlineFeedback error={mutation.error}/><div className="form-actions"><Button variant="secondary" onClick={() => setShowContactForm(false)}>Cancel</Button><Button type="submit" loading={mutation.pending}>Save contact</Button></div></form>}{contacts.length ? <div className="contact-grid">{contacts.map((item) => <div className="contact-card" key={item.id}><span className="contact-avatar">{(item.fullName || "C").slice(0, 1).toUpperCase()}</span><div className="contact-details"><b>{item.fullName}</b><small>{item.jobTitle || "Role not stored"}</small><span>{item.businessEmail || "No business email"}</span><div className="contact-tags"><Badge tone={item.source === "apollo" ? "blue" : "neutral"}>{item.source === "apollo" ? "Apollo source" : "Added by you"}</Badge><Badge tone={item.emailVerified ? "green" : "amber"}>{item.emailVerified ? "Verified by Apollo" : "Not verified"}</Badge><StatusBadge value={item.outreachStatus}/></div></div>{item.outreachStatus !== "do_not_contact" && <Button variant="ghost" onClick={() => void (async () => { const result = await mutation.execute(() => api.postNoBody<RecordValue>(`/api/v1/decision-makers/${encodeURIComponent(item.id)}/do-not-contact`, startupId), "Contact marked do-not-contact."); if (result) detail.reload(); })()}>Mark DNC</Button>}</div>)}</div> : <EmptyState title="No contacts saved" description="Add a person manually. Provider search and enrichment remain disabled until verified." action={<Button icon="plus" onClick={() => setShowContactForm(true)}>Add contact manually</Button>}/>}<InlineFeedback error={mutation.error} success={mutation.success}/></section>}
    {tab.toLowerCase() === "outreach" && <section className="card panel"><div className="section-heading"><h2>Outreach</h2><p>Messages for this prospect are loaded from campaign/message records.</p></div><Button onClick={() => navigate("/outreach/messages")}>Open message workspace</Button><p className="muted-copy">Create a draft only after selecting a campaign and a saved contact. Every message requires human approval before email handoff.</p></section>}
    {tab.toLowerCase() === "activity" && <section className="card panel"><div className="section-heading"><h2>Recent recorded activity</h2><p>Events recorded by the backend, not inbox telemetry.</p></div>{activity.length ? <div className="timeline">{activity.map((item) => <div className="timeline-item" key={item.id}><span className="timeline-dot"/><div><b>{activityLabel(item.activityType)}</b><small>{item.summary || "Recorded workspace event"}</small></div><time>{formatDateTime(item.occurredAt)}</time></div>)}</div> : <EmptyState title="No activity recorded" description="Recorded events will appear here after relevant actions take place."/>}<Button variant="secondary" onClick={() => navigate("/activity")}>View workspace activity</Button></section>}
  </div>;
}

function DefinitionList({ rows }: { rows: [string, unknown][] }) {
  return <dl className="definition-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}
function activityLabel(value?: string) { return (value || "activity").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function CampaignForm({ startupId, navigate, onCreated }: { startupId: string; navigate: (path: string) => void; onCreated: () => void }) {
  const icps = useRemote<RecordValue[]>("/api/v1/icps?isActive=true&limit=100", startupId);
  const [name, setName] = useState(""); const [icpId, setIcpId] = useState(""); const [open, setOpen] = useState(false);
  const mutation = useMutation();
  useEffect(() => { if (!icpId && icps.data?.[0]?.id) setIcpId(icps.data[0].id); }, [icps.data, icpId]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const result = await mutation.execute(() => api.post<RecordValue>("/api/v1/campaigns", { name: name.trim(), icpId, channel: "email" }, startupId), "Campaign created.");
    if (result) { setName(""); setOpen(false); onCreated(); navigate(`/outreach/${encodeURIComponent(result.data.id)}`); }
  }
  return <section className="card panel"><div className="panel-heading"><div><h2>Campaigns</h2><p>Create email drafts grouped under an active ICP.</p></div><Button icon="plus" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "New campaign"}</Button></div>{open && <form className="inline-create-form" onSubmit={create}><Field label="Campaign name" value={name} onChange={setName} required minLength={1} maxLength={80} placeholder="e.g. Founder outreach"/><label className="field"><span>Active ICP</span><select value={icpId} onChange={(event) => setIcpId(event.target.value)} required><option value="">Select ICP</option>{(icps.data || []).map((icp) => <option key={icp.id} value={icp.id}>{icp.name}</option>)}</select></label><div className="inline-create-actions"><Button type="submit" loading={mutation.pending} disabled={!icpId}>Create campaign</Button><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button></div><InlineFeedback error={mutation.error}/>{icps.error && <InlineFeedback error={icps.error}/>}</form>}</section>;
}

function OutreachPage({ path, startupId, navigate }: PageContext) {
  if (path === "/outreach/messages") return <MessagesListPage startupId={startupId} navigate={navigate}/>;
  if (path.startsWith("/outreach/messages/")) return <MessageEditorPage messageId={path.split("/")[3]} startupId={startupId} navigate={navigate}/>;
  if (path !== "/outreach") return <CampaignDetailPage campaignId={path.split("/")[2]} startupId={startupId} navigate={navigate}/>;
  return <OutreachListPage startupId={startupId} navigate={navigate}/>;
}

function OutreachListPage({ startupId, navigate }: { startupId: string; navigate: (path: string) => void }) {
  const list = useRemote<RecordValue[]>("/api/v1/campaigns?limit=100&sort=-createdAt", startupId);
  return <div className="page-stack"><PageHeader title="Outreach" description="Manage campaigns, drafts, approvals, and founder-controlled email handoff." action={<Button icon="mail" onClick={() => navigate("/outreach/messages")}>Message workspace</Button>}/>
    <Notice title="Human-controlled outreach">BlueCode OS does not send email, schedule sequences, read inboxes, or verify delivery. Approved drafts open through your own email app.</Notice>
    <CampaignForm startupId={startupId} navigate={navigate} onCreated={() => list.reload()}/>
    <CampaignTable rows={list.data || []} loading={list.loading} error={list.error} retry={list.reload} navigate={navigate}/>
  </div>;
}

function CampaignTable({ rows, loading, error, retry, navigate }: { rows: RecordValue[]; loading: boolean; error: unknown; retry: () => void; navigate: (path: string) => void }) {
  if (loading) return <LoadingState label="Loading campaigns…"/>;
  if (error) return <ErrorState error={error} retry={retry}/>;
  if (!rows.length) return <EmptyState title="No campaigns yet" description="Create a campaign from an active ICP to start organizing messages."/>;
  return <DataTable><thead><tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Created</th><th>Updated</th><th/></tr></thead><tbody>{rows.map((campaign) => <tr key={campaign.id}><td><div className="table-primary"><AppMark name={campaign.name}/><span><b>{campaign.name}</b><small>ICP {campaign.icpId}</small></span></div></td><td>{campaign.channel || "email"}</td><td><StatusBadge value={campaign.status}/></td><td>{formatDate(campaign.createdAt)}</td><td>{formatDate(campaign.updatedAt)}</td><td><Button variant="ghost" onClick={() => navigate(`/outreach/${encodeURIComponent(campaign.id)}`)}>Open</Button></td></tr>)}</tbody></DataTable>;
}

function CampaignDetailPage({ campaignId, startupId, navigate }: { campaignId: string; startupId: string; navigate: (path: string) => void }) {
  const campaign = useRemote<RecordValue>(`/api/v1/campaigns/${encodeURIComponent(campaignId)}`, startupId);
  const messages = useRemote<RecordValue[]>(`/api/v1/messages${queryString({ campaignId })}`, startupId);
  const mutation = useMutation();
  async function transition(action: string) { if (action === "cancel" && !window.confirm("Cancel this campaign? The backend will validate whether this state transition is allowed.")) return; const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/campaigns/${encodeURIComponent(campaignId)}/${action}`, {}, startupId), "Campaign status updated."); if (result) { campaign.reload(); messages.reload(); } }
  const item = campaign.data || {};
  const allowedActions: Record<string, string[]> = {
    draft: ["submit", "cancel"], pending_approval: ["approve", "cancel"], approved: ["pause", "complete", "cancel"], active: ["pause", "complete", "cancel"], paused: ["resume", "complete", "cancel"],
  };
  const labels: Record<string, string> = { submit: "Submit for approval", approve: "Approve campaign", pause: "Pause", resume: "Resume", complete: "Complete", cancel: "Cancel" };
  return <div className="page-stack"><button className="back-link" onClick={() => navigate("/outreach")}>← Back to campaigns</button>{campaign.loading && <LoadingState/>}{campaign.error && <ErrorState error={campaign.error} retry={campaign.reload}/>}
    {campaign.data && <><PageHeader title={item.name || "Campaign"} description={`Email campaign · created ${formatDate(item.createdAt)}`} action={<StatusBadge value={item.status}/>}/><Notice title="Campaign state is not a sending state">Campaign approval and lifecycle status do not schedule or send messages. Handoff is recorded per message when you request an email-app handoff; delivery is never verified here.</Notice><section className="card panel"><div className="panel-heading"><div><h2>Campaign actions</h2><p>Only state transitions allowed by the backend are available.</p></div></div><div className="button-row">{(allowedActions[item.status] || []).map((action) => <Button key={action} variant={action === "cancel" ? "danger" : action === "approve" ? "primary" : "secondary"} onClick={() => void transition(action)} loading={mutation.pending}>{labels[action]}</Button>)}</div><InlineFeedback error={mutation.error} success={mutation.success}/></section>
      <section className="card panel"><div className="panel-heading"><div><h2>Messages</h2><p>Review each draft and its approval state.</p></div><Button onClick={() => navigate("/outreach/messages")}>Open message workspace</Button></div>{messages.loading && <LoadingState/>}{messages.error && <ErrorState error={messages.error} retry={messages.reload}/>}{messages.data && messages.data.length > 0 ? <DataTable><thead><tr><th>Message</th><th>Step</th><th>Approval</th><th>Status</th><th>Updated</th><th/></tr></thead><tbody>{messages.data.map((message) => <tr key={message.id}><td><b>{message.subject || "Untitled draft"}</b><small className="cell-subtitle">Recipient ID: {message.decisionMakerId}</small></td><td>{message.step}</td><td><StatusBadge value={message.approvalStatus}/></td><td><StatusBadge value={message.status}/></td><td>{formatDate(message.updatedAt)}</td><td><Button variant="ghost" onClick={() => navigate(`/outreach/messages/${encodeURIComponent(message.id)}`)}>Edit / review</Button></td></tr>)}</tbody></DataTable> : !messages.loading && !messages.error ? <EmptyState title="No messages in this campaign" description="Open the message workspace and create a draft with a saved contact." action={<Button onClick={() => navigate("/outreach/messages")}>Create draft</Button>}/> : null}</section></>}
  </div>;
}

function MessagesListPage({ startupId, navigate }: { startupId: string; navigate: (path: string) => void }) {
  const messages = useRemote<RecordValue[]>("/api/v1/messages?limit=100&sort=-createdAt", startupId);
  const campaigns = useRemote<RecordValue[]>("/api/v1/campaigns?limit=100", startupId);
  const prospects = useRemote<RecordValue[]>("/api/v1/prospects?limit=100", startupId);
  const [campaignId, setCampaignId] = useState(""); const [prospectId, setProspectId] = useState(""); const [contactId, setContactId] = useState(""); const [step, setStep] = useState("1"); const [contactOptions, setContactOptions] = useState<RecordValue[]>([]); const [contactLoading, setContactLoading] = useState(false); const [contactError, setContactError] = useState<Error | null>(null);
  const mutation = useMutation();
  useEffect(() => { if (!campaignId && campaigns.data?.[0]?.id) setCampaignId(campaigns.data[0].id); }, [campaigns.data, campaignId]);
  useEffect(() => { if (!prospectId && prospects.data?.length) { const eligible = prospects.data.find((item) => item.status !== "do_not_contact"); if (eligible?.id) setProspectId(eligible.id); } }, [prospects.data, prospectId]);
  useEffect(() => {
    if (!prospectId) { setContactOptions([]); setContactId(""); return; }
    let live = true; setContactLoading(true); setContactError(null); setContactOptions([]); setContactId("");
    api.get<RecordValue[]>(`/api/v1/prospects/${encodeURIComponent(prospectId)}/decision-makers`, startupId).then((response) => { if (live) { setContactOptions(response.data || []); const eligible = (response.data || []).find((candidate: RecordValue) => Boolean(candidate.businessEmail) && candidate.outreachStatus !== "do_not_contact"); setContactId(eligible?.id || ""); } }).catch((error: unknown) => { if (live) setContactError(error instanceof Error ? error : new Error(String(error))); }).finally(() => { if (live) setContactLoading(false); });
    return () => { live = false; };
  }, [prospectId, startupId]);
  async function draft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const result = await mutation.execute(() => api.post<RecordValue>("/api/v1/messages/draft", { campaignId, decisionMakerId: contactId, step: Number(step), regenerate: false }, startupId), "Draft ready for review.");
    if (result) navigate(`/outreach/messages/${encodeURIComponent(result.data.id)}`);
  }
  return <div className="page-stack"><PageHeader title="Message workspace" description="Create, edit, approve, and hand off messages with human review." action={<Button variant="secondary" onClick={() => navigate("/outreach")}>Back to outreach</Button>}/>
    <Notice title="Drafts are not sent automatically">Mock message drafts are fixtures, not verified AI personalization. Review every fact, then get approval before opening your email app.</Notice>
    <section className="card panel"><div className="section-heading"><h2>Create a message draft</h2><p>Choose an existing campaign, prospect, and manually saved contact.</p></div><form className="form-grid" onSubmit={draft}><label className="field"><span>Campaign</span><select required value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">Choose campaign</option>{(campaigns.data || []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label><label className="field"><span>Prospect</span><select required value={prospectId} onChange={(event) => setProspectId(event.target.value)}><option value="">Choose prospect</option>{(prospects.data || []).map((item) => <option key={item.id} value={item.id} disabled={item.status === "do_not_contact"}>{item.name} · {item.status}{item.status === "do_not_contact" ? " · DNC" : ""}</option>)}</select></label><label className="field"><span>Saved contact</span><select required value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">Choose contact</option>{contactOptions.map((item) => <option key={item.id} value={item.id} disabled={item.outreachStatus === "do_not_contact" || !item.businessEmail}>{item.fullName} · {item.businessEmail || "No email"}{item.outreachStatus === "do_not_contact" ? " · DNC" : !item.businessEmail ? " · Email required" : ""}</option>)}</select>{contactLoading && <small className="field-help">Loading saved contacts…</small>}{contactError ? <small className="field-error">{readError(contactError)}</small> : null}{!contactLoading && !contactError && prospectId && contactOptions.length === 0 && <small className="field-help">No saved contacts. Open the prospect and add one manually.</small>}</label><label className="field"><span>Message step</span><select value={step} onChange={(event) => setStep(event.target.value)}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>Step {value}</option>)}</select></label><div className="form-actions form-actions-wide"><Button type="submit" loading={mutation.pending} disabled={!campaignId || !contactId || Boolean(contactOptions.find((c) => c.id === contactId && (c.outreachStatus === "do_not_contact" || !c.businessEmail)))}>Create draft</Button></div><InlineFeedback error={mutation.error} success={mutation.success}/></form></section>
    <section className="card panel"><div className="panel-heading"><div><h2>Saved messages</h2><p>Filter by status from the list in the API response.</p></div><Button variant="secondary" icon="refresh" onClick={messages.reload}>Refresh</Button></div>{messages.loading && <LoadingState/>}{messages.error && <ErrorState error={messages.error} retry={messages.reload}/>}{messages.data && messages.data.length > 0 ? <DataTable><thead><tr><th>Subject</th><th>Step / revision</th><th>Approval</th><th>Status</th><th>Updated</th><th/></tr></thead><tbody>{messages.data.map((item) => <tr key={item.id}><td><b>{item.subject || "Untitled message"}</b><small className="cell-subtitle">Campaign ID: {item.campaignId}</small></td><td>{item.step} / {item.revision}</td><td><StatusBadge value={item.approvalStatus}/></td><td><StatusBadge value={item.status}/></td><td>{formatDate(item.updatedAt)}</td><td><Button variant="ghost" onClick={() => navigate(`/outreach/messages/${encodeURIComponent(item.id)}`)}>Open</Button></td></tr>)}</tbody></DataTable> : !messages.loading && !messages.error ? <EmptyState title="No messages yet" description="Use the form above to create the first draft from a saved contact."/> : null}</section>
  </div>;
}

function MessageEditorPage({ messageId, startupId, navigate }: { messageId: string; startupId: string; navigate: (path: string) => void }) {
  const message = useRemote<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}`, startupId);
  const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [confirmHandoff, setConfirmHandoff] = useState(false); const [handoff, setHandoff] = useState<RecordValue | null>(null); const [mailtoMissingBody, setMailtoMissingBody] = useState(false); const [handoffAttempted, setHandoffAttempted] = useState(false);
  const mutation = useMutation();
  useEffect(() => { if (message.data) { setSubject(message.data.subject || ""); setBody(message.data.body || ""); } }, [message.data]);
  const item = message.data || {};
  const prospectContext = useRemote<RecordValue>(item.prospectId ? `/api/v1/prospects/${encodeURIComponent(item.prospectId)}` : null, startupId);
  const sourceProspect = prospectContext.data?.prospect || {};
  const sourceContact = (prospectContext.data?.contacts || []).find((contact: RecordValue) => contact.id === item.decisionMakerId) || {};
  const dirty = Boolean(message.data && (subject !== (item.subject || "") || body !== (item.body || "")));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const payload: RecordValue = {}; if (subject !== (item.subject || "")) payload.subject = subject; if (body !== (item.body || "")) payload.body = body;
    if (!Object.keys(payload).length) { mutation.setSuccess("No changes to save."); return; }
    const result = await mutation.execute(() => api.patch<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}`, payload, startupId), "Draft saved. Any previous approval may have been reset by the server."); if (result) message.reload();
  }
  async function messageAction(action: string, bodyValue: unknown = {}) {
    const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}/${action}`, bodyValue, startupId), action === "approve" ? "Message approved." : action === "request-revision" ? "Revision requested." : action === "reject" ? "Message rejected." : "Message updated."); if (result) message.reload();
  }
  async function requestHandoff() {
    const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}/handoff`, {}, startupId));
    if (result && result.data?.handoff) { setHandoff(result.data.handoff); setMailtoMissingBody(false); setHandoffAttempted(false); setConfirmHandoff(true); }
  }
  function openMailApp() {
    if (!handoff) return;
    setHandoffAttempted(true);
    const encode = (value: string) => encodeURIComponent(value);
    // Keep the validated address intact in the mailto path; encode only query values.
    const recipient = String(handoff.to || "").trim().replace(/[\r\n?]/g, "");
    const fullUrl = `mailto:${recipient}?subject=${encode(handoff.subject || "")}&body=${encode(String(handoff.body || "").replace(/\r?\n/g, "\r\n"))}`;
    const subjectOnly = `mailto:${recipient}?subject=${encode(handoff.subject || "")}`;
    if (fullUrl.length > 1800) {
      void navigator.clipboard?.writeText(`To: ${handoff.to || ""}\nSubject: ${handoff.subject || ""}\n\n${handoff.body || ""}`).catch(() => undefined);
      setMailtoMissingBody(true); window.location.href = subjectOnly;
    } else window.location.href = fullUrl;
  }
  function closeHandoff() { setConfirmHandoff(false); message.reload(); }
  async function reportSent() { const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}/mark-sent`, {}, startupId), "Marked sent by you. BlueCode cannot verify sending or delivery."); if (result) { setConfirmHandoff(false); message.reload(); } }
  async function copyHandoff() { if (!handoff) return; const text = `To: ${handoff.to || ""}\nSubject: ${handoff.subject || ""}\n\n${handoff.body || ""}`; try { await navigator.clipboard.writeText(text); mutation.setSuccess("Email text copied to clipboard."); } catch { mutation.setSuccess("Clipboard access was blocked. Select and copy the To, subject, and body from your email preview."); } }
  if (message.loading) return <div className="page-stack"><Button variant="ghost" onClick={() => navigate("/outreach/messages")}>← Back to messages</Button><LoadingState/></div>;
  if (message.error) return <div className="page-stack"><Button variant="ghost" onClick={() => navigate("/outreach/messages")}>← Back to messages</Button><ErrorState error={message.error} retry={message.reload}/></div>;
  const canEdit = item.status === "draft" && item.approvalStatus !== "approved";
  const dnc = sourceProspect.status === "do_not_contact" || sourceContact.outreachStatus === "do_not_contact";
  return <div className="page-stack"><button className="back-link" onClick={() => navigate("/outreach/messages")}>← Back to message workspace</button><PageHeader title="Edit message" description={`Step ${item.step ?? "—"} · Revision ${item.revision ?? "—"}`} action={<StatusBadge value={item.status}/>}/>
    <Notice title="Check the facts before approval">A draft is a starting point, not verified AI research. Editing is controlled by the API and may reset approval.</Notice>
    {prospectContext.loading && <Notice title="Checking outreach eligibility">Verifying the current prospect and contact do-not-contact status before allowing email handoff.</Notice>}{prospectContext.error && <Notice tone="danger" title="Cannot verify outreach eligibility">The prospect status could not be checked. Email handoff stays disabled until the current do-not-contact status can be confirmed.</Notice>}{dnc && <Notice tone="danger" title="Outreach is blocked">This message's prospect or contact is marked do-not-contact. Do not hand off this message.</Notice>}
    <div className="editor-grid"><section className="card panel editor-meta"><div className="section-heading"><h2>Message details</h2><p>Backend-owned identifiers and state.</p></div><DefinitionList rows={[["Campaign ID", item.campaignId], ["Prospect ID", item.prospectId], ["Contact ID", item.decisionMakerId], ["Step", item.step], ["Revision", item.revision], ["Approval", item.approvalStatus]]}/><div className="approval-steps"><div className="approval-step"><span className="done"><Icon name="check" size={15}/></span><div><b>Draft</b><small>{formatDateTime(item.createdAt)}</small></div></div><div className="approval-step"><span className={item.approvalStatus === "approved" ? "done" : ""}>{item.approvalStatus === "approved" ? <Icon name="check" size={15}/> : "2"}</span><div><b>Human approval</b><small>{item.approvalStatus === "approved" ? "Approved by a workspace user" : "Required before handoff"}</small></div></div><div className="approval-step"><span className={item.status === "handed_off" || item.status === "user_reported_sent" ? "done" : ""}>3</span><div><b>Email handoff</b><small>Opens your email app only</small></div></div></div></section>
      <form className="card panel editor" onSubmit={save}><div className="editor-top"><div><Badge tone={item.approvalStatus === "approved" ? "green" : "amber"}>{item.approvalStatus === "approved" ? "Approved" : item.approvalStatus || "Pending review"}</Badge><span>{dirty ? "Unsaved changes" : `Updated ${formatDate(item.updatedAt)}`}</span></div></div><Field label="Subject" value={subject} onChange={setSubject} required maxLength={200} placeholder="Email subject"/><TextArea label="Email body" value={body} onChange={setBody} required maxLength={5000} rows={12} placeholder="Review the message text…"/><div className="editor-actions"><Button type="submit" loading={mutation.pending} disabled={!canEdit || !dirty}>Save changes</Button>{item.approvalStatus !== "approved" && <Button variant="secondary" onClick={() => void messageAction("approve")} loading={mutation.pending} disabled={dirty || !subject.trim() || !body.trim() || item.status === "cancelled"}>Approve</Button>}</div><InlineFeedback error={mutation.error} success={mutation.success}/>{item.approvalStatus === "approved" && !["cancelled", "handed_off", "user_reported_sent"].includes(item.status) && <div className="handoff-actions"><Button icon="mail" onClick={() => void requestHandoff()} loading={mutation.pending} disabled={dirty || dnc || prospectContext.loading || Boolean(prospectContext.error) || !prospectContext.data || !item.subject || !item.body}>Open in my email app</Button><span>BlueCode prepares a mailto handoff; it never sends the email.</span></div>}{item.approvalStatus !== "approved" && item.status === "draft" && <div className="editor-secondary-actions"><Button variant="ghost" onClick={() => { const note = window.prompt("What needs to change? (1–500 characters)"); if (note?.trim()) void messageAction("request-revision", { note: note.trim() }); }} disabled={mutation.pending}>Request revision</Button><Button variant="ghost" onClick={() => { const reason = window.prompt("Optional rejection reason"); if (reason !== null) void messageAction("reject", { reason }); }} disabled={mutation.pending}>Reject draft</Button></div>}</form></div>
    {confirmHandoff && handoff && <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><button className="modal-close icon-button" aria-label="Close" onClick={closeHandoff}><Icon name="close"/></button><div className="modal-icon"><Icon name="mail" size={23}/></div><h2 id="handoff-title">Email handoff prepared</h2><p>BlueCode has recorded a handoff request. Use the button below to ask your device to open the email app, or copy the text. The browser cannot verify that an app opened, that you sent the message, or that it was delivered.</p><div className="handoff-preview"><div><small>To</small><b>{handoff.to || "—"}</b></div><div><small>Subject</small><b>{handoff.subject || "—"}</b></div><div><small>Body preview</small><p>{String(handoff.body || "").slice(0, 360)}{String(handoff.body || "").length > 360 ? "…" : ""}</p></div></div>{mailtoMissingBody && <Notice tone="warning">The email was long. Its body was copied where clipboard permission allowed; paste it into your email app.</Notice>}<div className="modal-actions"><Button variant="secondary" onClick={() => void copyHandoff()}>Copy email text</Button><Button onClick={openMailApp}>Open email app</Button></div>{handoffAttempted && <div className="modal-actions"><Button variant="ghost" onClick={closeHandoff}>Close</Button><Button variant="secondary" onClick={() => void reportSent()} loading={mutation.pending}>I sent it</Button></div>}<small className="field-help">“I sent it” records your report only, not email delivery confirmation.</small><InlineFeedback error={mutation.error} success={mutation.success}/></div></div>}
  </div>;
}

function NextActionsPage({ startupId, navigate }: PageContext) {
  const [status, setStatus] = useState("pending"); const actions = useRemote<RecordValue[]>(`/api/v1/next-actions${queryString({ status, sort: "priority" })}`, startupId); const mutation = useMutation();
  async function doAction(id: string, action: string) { const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/next-actions/${encodeURIComponent(id)}/${action}`, {}, startupId), action === "accept" ? "Recommendation accepted." : action === "complete" ? "Recommendation marked complete." : "Recommendation dismissed."); if (result) { actions.reload(); const nextRoute = action === "accept" ? result.next?.route : null; if (typeof nextRoute === "string" && nextRoute.startsWith("/")) navigate(nextRoute); } }
  const rows = actions.data || [];
  return <div className="page-stack"><PageHeader title="Next actions" description="Accept, dismiss, or complete recommendations. No outreach is executed automatically." action={<label className="compact-select"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="completed">Completed</option><option value="dismissed">Dismissed</option><option value="expired">Expired</option></select></label>}/>
    <Notice title="Recommendations are not automation">Accepting an action routes you to a relevant screen; it does not send a follow-up, book a meeting, or contact anyone.</Notice>{actions.loading && <LoadingState/>}{actions.error && <ErrorState error={actions.error} retry={actions.reload}/>}
    {actions.data && rows.length === 0 && <EmptyState title={`No ${status} recommendations`} description="The backend returns recommendations only when supported by recorded activity."/>}
    {actions.data && rows.length > 0 && <div className="action-cards">{rows.map((row) => <section className={`card next-card priority-${row.priority || "medium"}`} key={row.id}><span className="next-icon"><Icon name={row.actionType === "follow_up" ? "clock" : row.actionType === "review_prospect" ? "building" : "check-square"} size={19}/></span><div className="next-main"><div className="next-title"><h2>{row.title || actionLabel(row.actionType)}</h2><Badge tone={row.priority === "high" ? "red" : row.priority === "medium" ? "amber" : "neutral"}>{row.priority || "priority not reported"}</Badge></div><p>{row.reason || "No reason returned by the API."}</p><small>Prospect: {row.prospectId || "not linked"} · Due {formatDate(row.dueAt)}</small></div><div className="next-buttons">{row.status === "pending" && <><Button variant="ghost" onClick={() => void doAction(row.id, "dismiss")} loading={mutation.pending}>Dismiss</Button><Button variant="secondary" onClick={() => void doAction(row.id, "accept")} loading={mutation.pending}>Accept</Button><Button onClick={() => void doAction(row.id, "complete")} loading={mutation.pending}>Mark done</Button></>}{row.status !== "pending" && <StatusBadge value={row.status}/>}</div></section>)}</div>}
    <InlineFeedback error={mutation.error} success={mutation.success}/>
  </div>;
}
function actionLabel(value?: string) { return (value || "Recommendation").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function ActivityPage({ startupId, navigate }: PageContext) {
  const [replyForm, setReplyForm] = useState(false); const [prospectId, setProspectId] = useState(""); const [messageId, setMessageId] = useState(""); const [replyText, setReplyText] = useState(""); const [filterType, setFilterType] = useState(""); const [replyResult, setReplyResult] = useState<RecordValue | null>(null);
  const activities = useRemote<RecordValue[]>(`/api/v1/activities${queryString({ type: filterType || undefined, sort: "-occurredAt" })}`, startupId);
  const prospects = useRemote<RecordValue[]>("/api/v1/prospects?limit=100", startupId); const mutation = useMutation();
  async function logReply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const result = await mutation.execute(() => api.post<RecordValue>("/api/v1/activities/replies", { prospectId, ...(messageId.trim() ? { messageId: messageId.trim() } : {}), text: replyText }, startupId), "Reply was recorded from your pasted text."); if (result) { setReplyResult(result.data); setReplyText(""); setMessageId(""); setReplyForm(false); activities.reload(); } }
  const rows = activities.data || [];
  return <div className="page-stack"><PageHeader title="Activity" description="Review recorded workspace events and log replies you paste manually." action={<Button icon="plus" onClick={() => { setReplyForm((value) => !value); setReplyResult(null); }}>{replyForm ? "Close reply form" : "Log pasted reply"}</Button>}/>
    <Notice title="No inbox synchronization">Activity is based on actions and reply text supplied by a workspace user. BlueCode does not read your inbox or detect replies automatically.</Notice>
    {replyForm && <section className="card panel"><div className="section-heading"><h2>Log a reply</h2><p>The API stores only a sanitized excerpt, not the full pasted reply.</p></div><form className="form-grid" onSubmit={logReply}><label className="field"><span>Prospect</span><select value={prospectId} onChange={(event) => setProspectId(event.target.value)} required><option value="">Choose prospect</option>{(prospects.data || []).map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.name} · {prospect.status}</option>)}</select></label><Field label="Related message ID (optional)" value={messageId} onChange={setMessageId} placeholder="24-character message ID"/><div className="form-field-wide"><TextArea label="Pasted reply text" value={replyText} onChange={setReplyText} required maxLength={5000} rows={5} placeholder="Paste the reply you received in your own email app…" help="1–5,000 characters. Unsubscribe wording triggers deterministic DNC handling."/></div><div className="form-actions form-actions-wide"><Button type="submit" loading={mutation.pending} disabled={!prospectId || !replyText.trim()}>Save reply record</Button><Button variant="secondary" onClick={() => setReplyForm(false)}>Cancel</Button></div><InlineFeedback error={mutation.error} success={mutation.success}/></form></section>}
    {replyResult && <section className="card panel reply-result-panel"><div className="section-heading"><h2>Reply log result</h2><p>The reply record was saved. The full pasted text is not retained in this panel.</p></div>{replyResult.classification ? <Notice tone="success" title="Classification recorded">{replyResult.classification.summary || "The reply was classified by the configured preview classifier."}</Notice> : <Notice tone="warning" title="Reply saved; classification unavailable">The reply was recorded, but the backend did not return a classification for this request.</Notice>}{Array.isArray(replyResult.effects) && replyResult.effects.length > 0 && <div className="reply-effects"><b>Recorded effects</b>{replyResult.effects.map((effect: RecordValue, index: number) => <p key={`${effect.type || "effect"}-${index}`}><Icon name="check" size={15}/>{effect.type === "do_not_contact_set" ? `Do-not-contact protection was applied${typeof effect.cancelledDrafts === "number" ? `; ${effect.cancelledDrafts} unsent draft(s) cancelled` : ""}.` : effect.type === "next_action_created" ? "A recommendation was created from the classified reply." : activityLabel(effect.type)}</p>)}</div>}</section>}
    <section className="card panel"><div className="panel-heading"><div><h2>Workspace timeline</h2><p>Up to 100 recent recorded events.</p></div><label className="compact-select"><span>Event type</span><select value={filterType} onChange={(event) => setFilterType(event.target.value)}><option value="">All events</option>{["prospect_discovered", "contact_added", "contact_enriched", "score_updated", "signal_detected", "message_approved", "handoff_requested", "message_user_reported_sent", "reply_logged", "reply_classified", "status_changed", "integration_error"].map((type) => <option key={type} value={type}>{activityLabel(type)}</option>)}</select></label></div>
      {activities.loading && <LoadingState/>}{activities.error && <ErrorState error={activities.error} retry={activities.reload}/>}{activities.data && rows.length === 0 && <EmptyState title="No activity recorded" description="When users perform actions in this workspace, the API's activity timeline will show them here."/>}{activities.data && rows.length > 0 && <div className="timeline">{rows.map((item) => <div className="timeline-item" key={item.id}><span className="timeline-dot"/><div><b>{activityLabel(item.activityType)}</b><small>{item.summary || "Recorded workspace event"}</small>{item.prospectId && <button className="table-link timeline-prospect" onClick={() => navigate(`/prospects/${encodeURIComponent(item.prospectId)}`)}>Open prospect</button>}</div><time>{formatDateTime(item.occurredAt)}</time></div>)}</div>}
    </section>
  </div>;
}

function UsagePage({ startupId }: PageContext) {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(""); const [provider, setProvider] = useState("");
  const summary = useRemote<RecordValue>("/api/v1/usage/summary", startupId);
  const ledger = useRemote<RecordValue[]>(`/api/v1/usage/records${queryString({ page, limit: 20, status: status || undefined, provider: provider || undefined })}`, startupId);
  const usage = summary.data || {}; const spend = usage.spend || {}; const entitlements = usage.entitlements || {};
  return <div className="page-stack"><PageHeader title="Usage & plan" description="Review counters, cost type, and usage ledger reported by the API."/>
    {summary.loading && <LoadingState label="Loading usage summary…"/>}{summary.error && <ErrorState error={summary.error} retry={summary.reload}/>}
    {summary.data && <><div className="metrics usage-metrics"><MetricCard label="Remaining budget" value={typeof spend.capPaise === "number" && spend.capPaise > 0 ? formatMoneyPaise(spend.remainingPaise, spend.costType) : "Not configured"} detail={typeof spend.capPaise === "number" && spend.capPaise > 0 ? `Cost type: ${spend.costType || "not reported"}` : "Workspace spend cap is not configured"} icon="chart"/><MetricCard label="Committed spend" value={formatMoneyPaise(spend.committedPaise, spend.costType)} detail="API-reported estimate or provider amount" icon="mail"/><MetricCard label="Reserved spend" value={formatMoneyPaise(spend.reservedPaise, spend.costType)} detail="Reserved by current backend records" icon="clock"/><MetricCard label="Trial days left" value={typeof usage.trialDaysLeft === "number" ? usage.trialDaysLeft : "Not reported"} detail={`Plan: ${usage.plan || "not reported"}`} icon="target"/></div>
      <section className="card panel"><div className="section-heading"><h2>Configured entitlements</h2><p>Unset limits remain unconfigured; this interface never assumes a default cap.</p></div><DataTable><thead><tr><th>Resource</th><th>Used</th><th>Limit</th><th>Status</th></tr></thead><tbody>{["prospects", "dmSearches", "emails", "icps"].map((key) => { const row = entitlements[key] || {}; return <tr key={key}><td>{key === "dmSearches" ? "Decision-maker searches" : key[0].toUpperCase() + key.slice(1)}</td><td>{row.used ?? "—"}</td><td>{row.limit == null ? "Not configured" : row.limit}</td><td><Badge tone={row.limit == null ? "amber" : "neutral"}>{row.limit == null ? "No fixed limit" : "Configured"}</Badge></td></tr>; })}</tbody></DataTable></section></>}
    <section className="card panel"><div className="panel-heading"><div><h2>Usage ledger</h2><p>Each record reports cost type and operation.</p></div><div className="filter-inline"><select value={provider} aria-label="Filter provider" onChange={(event) => { setProvider(event.target.value); setPage(1); }}><option value="">All providers</option><option value="apollo">Apollo</option><option value="llm">LLM</option></select><select value={status} aria-label="Filter usage status" onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="success">Success</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select></div></div>
      {ledger.loading && <LoadingState/>}{ledger.error && <ErrorState error={ledger.error} retry={ledger.reload}/>}{ledger.data && ledger.data.length === 0 && <EmptyState title="No usage records" description="The backend has not returned any ledger rows for these filters."/>}{ledger.data && ledger.data.length > 0 && <><DataTable><thead><tr><th>Time</th><th>Provider</th><th>Operation</th><th>Status</th><th>Cost</th><th>Credits</th></tr></thead><tbody>{ledger.data.map((row) => <tr key={row.id}><td>{formatDateTime(row.occurredAt)}</td><td>{row.provider || "—"}</td><td><code>{row.operation || "—"}</code></td><td><StatusBadge value={row.status}/></td><td>{formatMoneyPaise(row.costPaise, row.costType)}</td><td>{row.creditsConsumed ?? "—"}</td></tr>)}</tbody></DataTable><div className="pagination"><span>{ledger.meta?.total ?? ledger.data.length} records · Page {ledger.meta?.page || page}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>Previous</Button><Button variant="secondary" disabled={ledger.data.length < 20} onClick={() => setPage((v) => v + 1)}>Next</Button></div></div></>}
    </section>
  </div>;
}

function SettingsPage({ startup, user, startupId }: PageContext) {
  const current = useRemote<RecordValue>("/api/v1/startups/current", startupId);
  const actual = current.data?.startup || startup;
  const me = actual.me || {};
  const capabilities = actual.capabilities || {};
  return <div className="page-stack"><PageHeader title="Workspace settings" description="Review access, capability flags, and workspace configuration returned by the API."/>
    {current.loading && <LoadingState/>}{current.error && <ErrorState error={current.error} retry={current.reload}/>}{current.data && <><div className="settings-grid"><section className="card panel"><div className="section-heading"><h2>Workspace</h2><p>Read-only details from the current-workspace endpoint.</p></div><DefinitionList rows={[["Workspace name", actual.name], ["Workspace ID", actual.id], ["Plan", actual.plan], ["Status", actual.status], ["Trial ends", formatDate(actual.trialEndsAt)], ["Created", formatDate(actual.createdAt)]]}/><Notice>Workspace settings and member-management write endpoints are not part of the frozen contract, so they are not editable here.</Notice></section><section className="card panel"><div className="section-heading"><h2>Current user access</h2><p>Controls are advisory; server permissions are authoritative.</p></div><DefinitionList rows={[["Signed-in user", user?.name || "—"], ["Email", user?.email || "—"], ["Workspace role", me.role], ["Permissions", Array.isArray(me.permissions) ? me.permissions.join(", ") : "—"]]}/></section></div>
      <section className="card panel"><div className="section-heading"><h2>Provider capabilities</h2><p>Shown exactly as reported by this workspace; no unavailable provider flow is simulated.</p></div><div className="capability-grid">{[["Company discovery", capabilities.searchOrgs, "Apollo organization search"], ["People search", capabilities.searchPeople, "Apollo people search"], ["Contact enrichment", capabilities.enrich, "Apollo contact enrichment"]].map(([label, enabled, description]) => <div className="capability-row" key={String(label)}><span className={`capability-led ${enabled ? "on" : "off"}`}/><div><b>{String(label)}</b><small>{String(description)}</small></div><Badge tone={enabled ? "green" : "amber"}>{enabled ? "Enabled" : "Disabled"}</Badge></div>)}</div></section>
      <section className="card panel"><div className="section-heading"><h2>Safety and product behavior</h2></div><div className="safety-list"><p><Icon name="check" size={16}/> Message approval is human-controlled.</p><p><Icon name="check" size={16}/> Handoff uses your email application; no server-side send.</p><p><Icon name="check" size={16}/> No inbox sync, recipient delivery/open tracking, or scheduled follow-ups.</p><p><Icon name="check" size={16}/> Usage caps and entitlements are read from configuration and not guessed in the browser.</p></div></section></>}
  </div>;
}

export default function App() {
  const { location, navigate } = useBrowserLocation();
  const [user, setUser] = useState<AppUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState(() => sessionStorage.getItem("bc_active_startup") || "");
  const setActiveWorkspace = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    if (id) sessionStorage.setItem("bc_active_startup", id); else sessionStorage.removeItem("bc_active_startup");
  }, []);

  useEffect(() => {
    let active = true;
    api.get<{ user: AppUser; memberships?: RecordValue[] }>("/api/v1/auth/me").then((response) => { if (active) setUser(response.data.user); }).catch((error: unknown) => {
      if (active) {
        setUser(null);
        if (error instanceof ApiRequestError && error.code === "NOT_A_MEMBER") setActiveWorkspace("");
      }
    }).finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, [setActiveWorkspace]);

  useEffect(() => {
    if (sessionLoading) return;
    const path = location.pathname;
    const publicPage = path === "/login" || path === "/register";
    if (!user && !publicPage) navigate("/login", true);
    else if (user && (publicPage || path === "/")) navigate(activeWorkspaceIdState ? "/dashboard" : "/workspaces", true);
    else if (user && path !== "/workspaces" && !activeWorkspaceIdState) navigate("/workspaces", true);
  }, [sessionLoading, user, location.pathname, activeWorkspaceIdState, navigate]);

  async function onAuthenticated(nextUser: AppUser) {
    setUser(nextUser);
    try {
      const response = await api.get<{ startups: RecordValue[] }>("/api/v1/startups");
      const workspaces = response.data.startups || [];
      if (workspaces.length === 1) { const id = getId(workspaces[0]); setActiveWorkspace(id); navigate("/dashboard", true); }
      else { setActiveWorkspace(""); navigate("/workspaces", true); }
    } catch { setActiveWorkspace(""); navigate("/workspaces", true); }
  }

  async function logout() {
    try { await api.logout(); } catch { /* Clear local authenticated view even if the network is down. */ }
    setUser(null); setActiveWorkspace(""); navigate("/login", true);
  }

  if (sessionLoading) return <main className="center-shell"><div className="loading-brand"><Logo/><LoadingState label="Checking your session…"/></div></main>;
  if (!user && (location.pathname === "/login" || location.pathname === "/register")) return <AuthPage onAuthenticated={onAuthenticated} navigate={navigate}/>;
  if (!user) return <main className="center-shell"><div className="loading-brand"><Logo/><LoadingState label="Opening sign in…"/></div></main>;
  if (location.pathname === "/workspaces") return <WorkspacePicker navigate={navigate} setActiveWorkspace={setActiveWorkspace} activeWorkspaceId={activeWorkspaceIdState}/>;
  if (!activeWorkspaceIdState) return <WorkspacePicker navigate={navigate} setActiveWorkspace={setActiveWorkspace} activeWorkspaceId={activeWorkspaceIdState}/>;
  return <AppShell key={activeWorkspaceIdState} user={user} startupId={activeWorkspaceIdState} navigate={navigate} location={location} onLogout={() => void logout()} setActiveWorkspace={setActiveWorkspace}/>;
}
