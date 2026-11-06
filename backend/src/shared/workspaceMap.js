import crypto from "crypto";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const sha = (o) => crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v, n) => (v == null || v === "" ? null : String(v).slice(0, n));
const date = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
const normIntent = (v) => {
  const t = String(v || "").toLowerCase();
  return ["positive", "neutral", "negative"].find((i) => t.startsWith(i)) || "unknown";
};

export const idOf = (row) => row.client_ref ?? row.id;

// ───────── Prospects ─────────
const PKEYS = new Set(["id", "company", "domain", "website", "industry", "location", "size", "description",
  "source", "score", "icpFitScore", "priority", "scoreSource", "icpEvaluated", "fit", "icpEvaluation",
  "status", "whyNow", "trigger", "buyingSignal", "intent", "evidence", "person", "role", "email"]);

export function prospectToDb(p) {
  const score = [p.icpFitScore, p.score].map((x) => (x === null || x === undefined || x === "" ? NaN : Number(x))).find(Number.isFinite);
  const ui = {};
  for (const k of Object.keys(p)) if (!PKEYS.has(k)) ui[k] = p[k];

  const ev = s(p.evidence, 2000);
  const signals = [];
  for (const [type, key] of [["trigger", "trigger"], ["buying_signal", "buyingSignal"], ["intent", "intent"]]) {
    const d = s(p[key], 1000);
    if (d) signals.push({ signal_type: type, description: d, evidence: signals.length === 0 ? ev : null });
  }
  if (!signals.length && ev) ui.evidence = ev;

  const name = s(p.person, 200);
  const dm = name ? {
    name, position: s(p.role, 200),
    email: p.email && EMAIL.test(p.email) ? String(p.email).toLowerCase() : null,
    is_decision_maker: true, is_primary: true, provenance: "workspace"
  } : null;

  const row = {
    company: s(p.company, 200) || "Unknown",
    domain: s(p.domain, 253)?.toLowerCase() ?? null,
    website: s(p.website, 2048), industry: s(p.industry, 200), location: s(p.location, 200),
    company_size: s(p.size, 100), description: s(p.description, 2000),
    source: s(p.source, 100) || "manual",
    icp_fit_score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
    score_source: s(p.scoreSource, 50), icp_evaluated: !!p.icpEvaluated,
    fit_reasons: Array.isArray(p.fit) ? p.fit.slice(0, 20).map((x) => String(x).slice(0, 500)) : [],
    evaluation: p.icpEvaluation && typeof p.icpEvaluation === "object" ? p.icpEvaluation : null,
    pipeline_status: s(p.status, 60) || "Target", why_now: s(p.whyNow, 2000), ui
  };
  return { row, signals, dm };
}

export function prospectToUi(row) {
  const sigs = row.prospect_signals || [];
  const sig = (t) => sigs.find((x) => x.signal_type === t);
  const dms = row.decision_makers || [];
  const prim = dms.find((d) => d.is_primary) || dms[0];
  const evidence = sigs.find((x) => x.evidence)?.evidence ?? row.ui?.evidence ?? "";
  return {
    ...(row.ui || {}),
    id: idOf(row), company: row.company, domain: row.domain ?? "", website: row.website ?? "",
    industry: row.industry ?? "", location: row.location ?? "", size: row.company_size ?? "",
    description: row.description ?? "", source: row.source,
    score: row.icp_fit_score, icpFitScore: row.icp_fit_score, priority: row.priority,
    scoreSource: row.score_source, icpEvaluated: row.icp_evaluated,
    fit: row.fit_reasons || [], icpEvaluation: row.evaluation, status: row.pipeline_status,
    whyNow: row.why_now ?? "",
    trigger: sig("trigger")?.description ?? "", buyingSignal: sig("buying_signal")?.description ?? "",
    intent: sig("intent")?.description ?? "", evidence,
    person: prim?.name ?? "", role: prim?.position ?? "", email: prim?.email ?? ""
  };
}

// ───────── Outreach ─────────
const OKEYS = new Set(["id", "prospectId", "company", "person", "subject", "body", "status", "approvedAt",
  "draftProvider", "draftModel", "draftGeneratedAt", "incomingReply", "responseSubject", "responseBody", "responseDraftSaved"]);

export function outreachToDb(o) {
  const ui = {};
  for (const k of Object.keys(o)) if (!OKEYS.has(k)) ui[k] = o[k];
  const row = {
    subject: s(o.subject, 300) ?? "", body: String(o.body ?? "").slice(0, 10000),
    status: s(o.status, 80) || "draft", approved_at: date(o.approvedAt),
    draft_provider: s(o.draftProvider, 50), draft_model: s(o.draftModel, 100),
    draft_generated_at: date(o.draftGeneratedAt), ui
  };
  const body = s(o.incomingReply, 10000);
  const reply = body ? {
    body, intent: normIntent(o.intent), intent_source: "workspace",
    response_subject: s(o.responseSubject, 300), response_body: s(o.responseBody, 10000),
    response_saved: !!o.responseDraftSaved
  } : null;
  return { row, reply };
}

export function outreachToUi(row, prospect) {
  const reply = [...(row.outreach_replies || [])].sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))[0];
  const out = {
    ...(row.ui || {}),
    id: idOf(row), prospectId: prospect ? idOf(prospect) : row.prospect_id,
    company: prospect?.company ?? "", person: prospect?.person ?? "",
    subject: row.subject, body: row.body, status: row.status
  };
  const opt = {
    approvedAt: row.approved_at, draftProvider: row.draft_provider, draftModel: row.draft_model,
    draftGeneratedAt: row.draft_generated_at, incomingReply: reply?.body,
    responseSubject: reply?.response_subject, responseBody: reply?.response_body,
    responseDraftSaved: reply ? reply.response_saved : undefined
  };
  for (const [k, v] of Object.entries(opt)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

// ───────── Activities ─────────
export function timeLabel(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} hr ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export const activityId = (row) => (row.client_ref && /^\d{1,15}$/.test(row.client_ref) ? Number(row.client_ref) : row.client_ref ?? row.id);
