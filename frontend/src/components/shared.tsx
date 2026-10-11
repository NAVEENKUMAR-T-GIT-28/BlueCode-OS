import type { ReactNode } from "react";
import { ApiRequestError, readError } from "../api";

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const icons: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    target: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".7"/></>,
    building: <><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2M9 21v-2h6v2"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    "check-square": <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    chart: <><path d="M4 20V4M4 20h17"/><path d="m7 15 4-4 3 2 5-6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.4-.5a8 8 0 0 1-1.7 1l-.2 1.5h-2.4l-.2-1.5a8 8 0 0 1-1.7-1l-1.4.5-1.2-2.1 1.2-.9a7 7 0 0 1 0-2l-1.2-.9 1.2-2.1 1.4.5a8 8 0 0 1 1.7-1l.2-1.5h2.4l.2 1.5a8 8 0 0 1 1.7 1l1.4-.5 1.2 2.1-1.2.9a7 7 0 0 1 0 2Z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 4.5 4.5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    external: <><path d="M14 3h7v7M10 14 21 3"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2"/></>,
    filter: <><path d="M4 5h16M7 12h10m-7 7h4"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name] || <circle cx="12" cy="12" r="8"/>}</svg>;
}

export function Logo({ light = false }: { light?: boolean }) {
  return <div className={`logo ${light ? "logo-light" : ""}`}><span className="logo-mark">B</span><span>BlueCode <b>OS</b></span></div>;
}

export function Button({ children, variant = "primary", icon, onClick, type = "button", disabled = false, loading = false, className = "", title }: {
  children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: string;
  onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; loading?: boolean; className?: string; title?: string;
}) {
  return <button className={`button button-${variant} ${className}`} onClick={onClick} type={type} disabled={disabled || loading} title={title}>{loading ? <span className="button-spinner"/> : icon ? <Icon name={icon} size={16}/> : null}{children}</button>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "amber" | "red" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>;
}

export function Field({ label, value, onChange, placeholder, type = "text", required = false, help, minLength, maxLength, name, autoComplete }: {
  label: string; value?: string; onChange?: (value: string) => void; placeholder?: string; type?: string; required?: boolean; help?: string; minLength?: number; maxLength?: number; name?: string; autoComplete?: string;
}) {
  return <label className="field"><span>{label}</span><input name={name} autoComplete={autoComplete} type={type} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined}/>{help && <small className="field-help">{help}</small>}</label>;
}

export function TextArea({ label, value, onChange, placeholder, required = false, minLength, maxLength, rows = 4, help }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; minLength?: number; maxLength?: number; rows?: number; help?: string;
}) {
  return <label className="field"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} rows={rows}/>{help && <small className="field-help">{help}</small>}</label>;
}

export function LoadingState({ label = "Loading workspace data…" }: { label?: string }) {
  return <div className="loading-state"><span className="loading-spinner"/><span>{label}</span></div>;
}

export function ErrorState({ error, retry, compact = false }: { error: unknown; retry?: () => void; compact?: boolean }) {
  const message = readError(error);
  const disabled = error instanceof ApiRequestError && error.code === "CAPABILITY_DISABLED";
  return <div className={`state-card ${compact ? "state-card-compact" : ""} ${disabled ? "state-card-warning" : "state-card-error"}`}>
    <span className="state-icon"><Icon name="info" size={20}/></span><div><h2>{disabled ? "Unavailable in this preview" : "Couldn't load this data"}</h2><p>{message}</p>{error instanceof ApiRequestError && error.requestId && <small>Request ID: {error.requestId}</small>}{retry && <div className="state-actions"><Button variant="secondary" icon="refresh" onClick={retry}>Try again</Button></div>}</div>
  </div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="building" size={22}/></span><h2>{title}</h2><p>{description}</p>{action && <div className="empty-action">{action}</div>}</div>;
}

export function Notice({ title, children, tone = "info" }: { title?: string; children: ReactNode; tone?: "info" | "warning" | "success" | "danger" }) {
  return <div className={`notice notice-${tone}`}><span><Icon name="info" size={18}/></span><div>{title && <b>{title}</b>}<p>{children}</p></div></div>;
}

export function InlineFeedback({ error, success }: { error?: unknown; success?: string }) {
  if (error) return <div className="inline-feedback error"><Icon name="info" size={15}/><span>{readError(error)}</span></div>;
  if (success) return <div className="inline-feedback success"><Icon name="check" size={15}/><span>{success}</span></div>;
  return null;
}

export function AppMark({ name }: { name?: string }) {
  const initial = (name || "W").trim().slice(0, 1).toUpperCase();
  return <span className="company-logo">{initial}</span>;
}

export function StatusBadge({ value }: { value?: string }) {
  const status = (value || "unknown").toLowerCase();
  const tone = ["qualified", "active", "approved", "ready", "completed", "user_reported_sent"].includes(status) ? "green"
    : ["pending_approval", "pending", "revision_requested", "paused", "handed_off"].includes(status) ? "amber"
      : ["disqualified", "do_not_contact", "cancelled", "rejected"].includes(status) ? "red" : "neutral";
  const label: Record<string, string> = {
    pending_approval: "Pending approval", pending: "Awaiting approval", revision_requested: "Changes requested", user_reported_sent: "Marked sent by you",
    handed_off: "Handoff recorded", active: "Active", do_not_contact: "Do not contact", draft: "Draft", ready: "Approved · ready to open",
  };
  return <Badge tone={tone}>{label[status] || (value ? status.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Unknown")}</Badge>;
}

export function ScoreBadge({ score, category, coverage }: { score?: number; category?: string; coverage?: number }) {
  const tone = category === "hot" || category === "high" ? "green" : category === "medium" ? "amber" : category === "low" ? "red" : "neutral";
  return <span className="score-pair"><Badge tone={tone}>{typeof score === "number" ? `${score} / 100` : "Not scored"}</Badge>{typeof coverage === "number" && coverage < 0.5 && <Badge tone="amber">Limited data</Badge>}</span>;
}

export function DataTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card table-card ${className}`}><div className="table-scroll"><table>{children}</table></div></div>;
}
