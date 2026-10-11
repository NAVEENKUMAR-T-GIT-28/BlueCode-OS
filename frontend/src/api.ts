export type ApiEnvelope<T> = {
  data: T;
  meta?: { page?: number; limit?: number; total?: number; [key: string]: unknown };
  // Some documented action responses, such as next-action acceptance, include a top-level route hint.
  next?: { route?: string; [key: string]: unknown };
};

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details: unknown;
  requestId?: string;

  constructor(status: number, payload: unknown) {
    const root = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    super(typeof root.message === "string" ? root.message : `Request failed (${status})`);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = typeof root.code === "string" ? root.code : "UNKNOWN_ERROR";
    this.details = root.details;
    this.requestId = typeof root.requestId === "string" ? root.requestId : undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || "http://localhost:4000").replace(/\/$/, "");

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  startupId?: string,
): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && init.body !== null) headers.set("Content-Type", "application/json");
  if (!(["GET", "HEAD", "OPTIONS"] as string[]).includes(method)) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }
  if (startupId) headers.set("x-startup-id", startupId);

  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      method,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiRequestError(0, { error: { code: "NETWORK_ERROR", message: "Can't reach the API. Check that the backend is running and VITE_API_ORIGIN is correct." } });
  }

  if (response.status === 204) return undefined as T;
  const raw = await response.text();
  let payload: unknown = undefined;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { error: { code: "INVALID_RESPONSE", message: "The API returned a response that was not valid JSON." } };
    }
  }
  if (!response.ok) throw new ApiRequestError(response.status, payload);
  return payload as T;
}

export function readError(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  if (error.status === 0 || error.code === "NETWORK_ERROR") return error.message;
  switch (error.code) {
    case "UNAUTHENTICATED": return "Your session has expired. Sign in again to continue.";
    case "NOT_A_MEMBER": return "This account is no longer a member of the selected workspace. Choose another workspace.";
    case "FORBIDDEN": return "You don't have permission to perform this action in this workspace.";
    case "NOT_FOUND": return "This record is unavailable or no longer exists.";
    case "CAPABILITY_DISABLED": return "This capability is intentionally disabled in the current preview. No provider request was retried.";
    case "VALIDATION_FAILED": return validationMessage(error.details) || error.message;
    case "DO_NOT_CONTACT": return "Outreach is blocked because this prospect or contact is marked do-not-contact.";
    case "APPROVAL_REQUIRED": return "Human approval is required before this action can continue.";
    case "INVALID_STATE": return "This record has changed state. Refresh it and try again if the action is still available.";
    case "TRIAL_EXPIRED": return "The workspace trial has expired. Existing data remains viewable, but this write is blocked.";
    case "BUDGET_EXHAUSTED": return "The workspace's configured usage budget blocks this action.";
    case "PLAN_LIMIT_REACHED": return "The workspace has reached a configured plan limit.";
    case "CONFLICT": return "This change conflicts with the current record. Refresh and review the latest state.";
    case "RATE_LIMITED": return "Too many requests. Wait a moment before trying again.";
    case "PROVIDER_FAILED": return "The provider returned an unusable result. You can continue with the available manual workflow.";
    case "INTERNAL": return `The server could not complete the request${error.requestId ? ` (request ID ${error.requestId})` : ""}.`;
    default: return error.message || "The request could not be completed.";
  }
}

function validationMessage(details: unknown): string | undefined {
  if (!Array.isArray(details) || details.length === 0) return undefined;
  const first = details[0];
  if (!isRecord(first)) return undefined;
  const path = typeof first.path === "string" ? first.path : "";
  const issue = typeof first.issue === "string" ? first.issue : "Check the highlighted fields.";
  return path ? `${path}: ${issue}` : issue;
}

export const api = {
  get: <T,>(path: string, startupId?: string) => apiRequest<ApiEnvelope<T>>(path, {}, startupId),
  post: <T,>(path: string, body: unknown = {}, startupId?: string) =>
    apiRequest<ApiEnvelope<T>>(path, { method: "POST", body: JSON.stringify(body) }, startupId),
  patch: <T,>(path: string, body: unknown, startupId?: string) =>
    apiRequest<ApiEnvelope<T>>(path, { method: "PATCH", body: JSON.stringify(body) }, startupId),
  postNoBody: <T,>(path: string, startupId?: string) =>
    apiRequest<ApiEnvelope<T>>(path, { method: "POST" }, startupId),
  postNoContent: (path: string, startupId?: string) =>
    apiRequest<void>(path, { method: "POST" }, startupId),
  logout: () => apiRequest<void>("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({}) }),
};

export function queryString(values: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatMoneyPaise(value?: number | null, costType?: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not reported";
  const prefix = costType === "estimated" ? "≈ " : "";
  return `${prefix}${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value / 100)}`;
}

export function getId(value: Record<string, any> | null | undefined): string {
  if (!value) return "";
  const raw = value.startupId || value.id || value._id;
  return typeof raw === "string" ? raw : "";
}
