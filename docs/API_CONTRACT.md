# BlueCode OS — API Contract v1.0

**Document:** `API_CONTRACT.md`  
**Depends on:** `BACKEND_ARCHITECTURE.md` v2 (modules, permissions, error registry), `DB_ARCHITECTURE.md` v2.0 (fields, enums)  
**Consumers:** `server/` (validators, controllers, contract tests) and `client/` (API layer, error handling)  
**Base path:** `/api/v1`  
**Status:** Canonical API Specification. All backend Zod validators, controllers, and frontend API client types conform to this contract.

---

## 1. Conventions

### 1.1 Transport
- JSON only (`Content-Type: application/json`). Max request body 100 KB.
- IDs are 24-hex ObjectId **strings**. Dates are ISO-8601 UTC (`2026-10-10T08:30:00.000Z`).
- **Money is integer paise** (INR, where 100 paise = ₹1). Field names end in `Paise`. The UI formats them for display.
- Field names are `camelCase`. Unknown request fields are **strictly rejected** (`422 VALIDATION_FAILED` / `400 VALIDATION_ERROR`).

### 1.2 Required headers

| Header | When | Notes |
|---|---|---|
| `Cookie: bc_session=<jwt>` | All authenticated routes | `httpOnly`, `SameSite=Lax`, set by `/auth/login` |
| `X-Startup-Id: <id>` | All workspace/tenant routes | Tenant context identifier; server verifies caller is an active member |
| `X-Requested-With: XMLHttpRequest` | Every state-modifying request (`POST`, `PATCH`, `DELETE`) | Browser CSRF protection layer; checked by `csrfGuard` |
| `Content-Type: application/json` | Requests with a JSON body | Required on non-empty bodies |

### 1.3 Response envelope

**Success:**
```json
{ "data": { }, "meta": { "page": 1, "limit": 20, "total": 134 } }
```
- `meta` appears on paginated list endpoints.
- `204 No Content` responses have an empty body.

**Error (all errors adhere to this envelope):**
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable error summary",
    "details": [ { "path": "criteria.industries[0]", "issue": "Too long (max 80)" } ],
    "requestId": "7f1c9a2e-4b12-4c32-a5e2-9b2f6d0a7a3b"
  }
}
```
- `details` is present for validation errors, plan limit violations, or specific capability flags.
- `requestId` is included on all responses (tracked via `X-Request-Id` response header).

### 1.4 Pagination, sorting, filtering
- **Pagination:** `?page=1&limit=20` (default `page=1`, default `limit=20`, max `limit=100`).
- **Sorting:** `?sort=field` (ascending) or `?sort=-field` (descending). Allowed sort fields are strictly validated per endpoint.
- **Filtering:** Validated strictly using Zod schemas. Any unrecognised query parameter returns `422 VALIDATION_FAILED`.

### 1.5 Error registry (HTTP ↔ code)

| HTTP | Code | When | Frontend behaviour |
|---|---|---|---|
| 400 | `MALFORMED_REQUEST` | Invalid JSON syntax, malformed 24-hex ObjectId in URL params | Show generic error toast; log |
| 401 | `UNAUTHENTICATED` | Missing, invalid, or expired session cookie; deactivated user | Clear session state; redirect to `/login` |
| 402 | `PLAN_LIMIT_REACHED` | Plan entitlement exhausted (prospects, searches, emails, seats) | Display upgrade banner / seat limit modal |
| 402 | `BUDGET_EXHAUSTED` | Workspace API spend cap would be exceeded | "Usage limit reached" persistent banner; disable paid actions |
| 402 | `TRIAL_EXPIRED` | Trial period ended (15 days); writes and paid calls blocked | Read-only workspace mode + upgrade CTA |
| 403 | `FORBIDDEN` | Caller's role lacks the required permission key | Hide/disable action control; display access denied message |
| 403 | `NOT_A_MEMBER` | Caller is not an active member of the requested `X-Startup-Id` | Redirect to workspace switcher |
| 404 | `NOT_FOUND` | Resource missing **or belongs to another tenant** | Render 404 page / not found toast |
| 409 | `CONFLICT` | Unique constraint violation (e.g. duplicate email in tenant) | Highlight conflicting field with error message |
| 409 | `INVALID_STATE` | Illegal lifecycle state transition | Refresh record state; show state error |
| 409 | `APPROVAL_REQUIRED` | Campaign or message requires approval before action | Prompt reviewer to approve first |
| 409 | `DO_NOT_CONTACT` | Prospect or contact marked Do Not Contact | Show suppression banner; prevent contact outreach |
| 422 | `VALIDATION_FAILED` | Request body or query parameters violate schema constraints | Highlight specific invalid fields using `details` |
| 429 | `RATE_LIMITED` | Exceeded IP rate limit or per-tenant operation limit | Show retry countdown using `Retry-After` header |
| 502 | `PROVIDER_FAILED` | External upstream provider (Apollo, LLM) failed or timed out | Prompt user to retry; log provider error |
| 503 | `CAPABILITY_DISABLED` | Feature capability flag disabled in current deployment | Render fallback UI (e.g. manual entry instead of auto-enrich) |
| 500 | `INTERNAL` | Unhandled server exception | Generic error modal displaying `requestId` for support |

### 1.6 Rate limits

| Scope | Limit | Window | Applies to |
|---|---|---|---|
| Global IP | 300 requests | 15 minutes | All incoming requests |
| Auth Limiter | 10 requests | 15 minutes | `POST /auth/login`, `POST /auth/register` |
| Paid Operations (💰) | 30 requests | 1 minute | Discovery, enrichment, LLM synthesis |

### 1.7 Symbols used below
- 💰 **Paid operation**: Checks and reserves ledger budget; writes a row to `usageRecords`.
- 🔌 **Capability-gated**: Requires upstream provider capability to be active; returns `503 CAPABILITY_DISABLED` if disabled.
- 📈 **Entitlement-checked**: Counter tracked against workspace subscription / trial plan limits.
- **Perm**: The required permission string enforced by `requirePermission(<key>)`.

---

## 2. Resource shapes (DTOs)

```ts
User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'deactivated';
  createdAt: string;
}

Membership {
  startupId: string;
  startupName: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'removed';
}

Startup {
  id: string;
  name: string;
  plan: 'trial' | 'starter' | 'growth' | 'scale';
  status: 'active' | 'suspended';
  trialEndsAt?: string;
  settings: {
    calendarLink?: string;
    senderName?: string;
    senderTitle?: string;
    productSummary?: string;
  };
  spend: {
    capPaise: number;
    committedPaise: number;
    reservedPaise: number;
    remainingPaise: number;
  };
  me?: { role: 'owner' | 'admin' | 'member'; permissions: string[] };
  capabilities?: { searchOrgs: boolean; searchPeople: boolean; enrich: boolean };
  createdAt: string;
}

Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'removed';
}

Icp {
  id: string;
  name: string;
  criteria: IcpCriteria;
  criteriaVersion: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

IcpCriteria {
  industries?: string[];
  countries?: string[];
  regions?: string[];
  employeeRanges?: string[];
  revenueRanges?: string[];
  technologies?: string[];
  companyKeywords?: string[];
  excludedIndustries?: string[];
  excludedCompanies?: string[];
  targetJobTitles?: string[];
  targetSeniority?: string[];
  contactLocations?: string[];
}

Prospect {
  id: string;
  icpId: string;
  name: string;
  domain?: string;
  status: 'discovered' | 'qualified' | 'in_outreach' | 'replied' | 'disqualified' | 'do_not_contact';
  firmographics: {
    industry?: string;
    employeeCount?: number;
    country?: string;
    region?: string;
    revenueRange?: string;
    technologies?: string[];
    keywords?: string[];
  };
  latestScore?: ScoreSummary;
  createdAt: string;
  updatedAt: string;
}

ScoreSummary {
  icpId: string;
  score: number;
  category: 'hot' | 'high' | 'medium' | 'low';
  coverage: number;
  scoredAt: string;
}

LeadScore {
  id: string;
  prospectId: string;
  icpId: string;
  score: number;
  category: 'hot' | 'high' | 'medium' | 'low';
  coverage: number;
  breakdown: Record<string, number>;
  explanation?: string;
  explanationSource?: 'rules' | 'ai';
  scoringVersion: number;
  icpVersion: number;
  scoredAt: string;
}

Signal {
  id: string;
  prospectId: string;
  decisionMakerId?: string;
  signalType: 'hiring' | 'technology' | 'funding' | 'leadership_change' | 'general';
  description: string;
  evidence: Array<{ field: string; value: unknown }>;
  confidence: number;
  status: 'active' | 'stale' | 'dismissed';
  detectedAt: string;
}

Contact {
  id: string;
  prospectId: string;
  fullName: string;
  jobTitle?: string;
  businessEmail?: string;
  linkedinUrl?: string;
  emailVerified?: boolean;
  outreachStatus: 'not_contacted' | 'contacted' | 'replied' | 'bounced' | 'do_not_contact';
  source: 'apollo' | 'manual';
  createdAt: string;
}

Campaign {
  id: string;
  icpId: string;
  name: string;
  channel: 'email';
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused' | 'completed' | 'cancelled';
  stats?: { totalMessages: number; drafts: number; ready: number; handedOff: number; sent: number };
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
}

Message {
  id: string;
  campaignId: string;
  prospectId: string;
  decisionMakerId: string;
  step: number;
  revision: number;
  subject?: string;
  body?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  status: 'draft' | 'ready' | 'handed_off' | 'user_reported_sent' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

Activity {
  id: string;
  prospectId: string;
  campaignId?: string;
  messageId?: string;
  activityType:
    | 'prospect_discovered' | 'contact_added' | 'contact_enriched' | 'score_updated'
    | 'signal_detected' | 'message_approved' | 'handoff_requested'
    | 'message_user_reported_sent' | 'reply_logged' | 'reply_classified'
    | 'status_changed' | 'integration_error';
  summary: string;
  occurredAt: string;
  classification?: { intent: string; confidence: number };
  metadata?: Record<string, unknown>;
}

NextAction {
  id: string;
  prospectId: string;
  decisionMakerId?: string;
  actionType: 'approve_draft' | 'handoff_message' | 'review_reply' | 'enrich_contact' | 'review_prospect';
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'dismissed' | 'completed' | 'expired';
  dueAt?: string;
  expiresAt?: string;
  basedOnActivityIds?: string[];
  createdAt: string;
}

UsageRecord {
  id: string;
  provider: 'apollo' | 'llm';
  operation: string;
  status: 'success' | 'failed' | 'blocked';
  costAmount?: number;
  costType: 'reported' | 'estimated';
  errorCode?: string;
  occurredAt: string;
}
```

---

## 3. Endpoint Index

| # | Area | Method | Path | Auth / Headers | Permission | Description |
|---|---|---|---|---|---|---|
| 0 | Health | `GET` | `/health` | Public | None | Server health and timestamp check |
| 1 | Auth | `POST` | `/api/v1/auth/register` | Public (Rate-limited) | None | Register new user account |
| 2 | Auth | `POST` | `/api/v1/auth/login` | Public (Rate-limited) | None | Login, issues `bc_session` cookie |
| 3 | Auth | `GET` | `/api/v1/auth/me` | `bc_session` | None | Current user info & active memberships |
| 4 | Auth | `POST` | `/api/v1/auth/logout` | `bc_session` | None | Clear session cookie |
| 5 | Workspace | `POST` | `/api/v1/startups` | `bc_session` | Signed-in user | Create new startup workspace (owner) |
| 6 | Workspace | `GET` | `/api/v1/startups` | `bc_session` | Signed-in user | List caller's active workspaces |
| 7 | Workspace | `GET` | `/api/v1/startups/current` | `bc_session`, `x-startup-id` | `workspace:read` | Get active workspace, spend & permissions |
| 8 | Workspace | `PATCH` | `/api/v1/startups/current` | `bc_session`, `x-startup-id` | `workspace:settings` | Update workspace name and settings |
| 9 | Workspace | `GET` | `/api/v1/startups/current/members` | `bc_session`, `x-startup-id` | `workspace:read` | List workspace team members |
| 10 | Workspace | `POST` | `/api/v1/startups/current/members` | `bc_session`, `x-startup-id` | `member:invite` | Invite existing user to workspace |
| 11 | Workspace | `PATCH` | `/api/v1/startups/current/members/:memberId` | `bc_session`, `x-startup-id` | `member:role` | Update member role (`admin`/`member`) |
| 12 | Workspace | `DELETE` | `/api/v1/startups/current/members/:memberId` | `bc_session`, `x-startup-id` | `member:role` | Soft-remove member from workspace |
| 13 | ICP | `POST` | `/api/v1/icps/propose` | `bc_session`, `x-startup-id` | `icp:write` | AI-assisted ICP proposal generation (💰 LLM) |
| 14 | ICP | `POST` | `/api/v1/icps` | `bc_session`, `x-startup-id` | `icp:write` | Create new Ideal Customer Profile (📈) |
| 15 | ICP | `GET` | `/api/v1/icps` | `bc_session`, `x-startup-id` | `workspace:read` | List ICPs with pagination and filters |
| 16 | ICP | `GET` | `/api/v1/icps/:id` | `bc_session`, `x-startup-id` | `workspace:read` | Get ICP details by ID |
| 17 | ICP | `PATCH` | `/api/v1/icps/:id` | `bc_session`, `x-startup-id` | `icp:write` | Update ICP name or criteria (bumps version) |
| 18 | ICP | `POST` | `/api/v1/icps/:id/archive` | `bc_session`, `x-startup-id` | `icp:write` | Soft-archive ICP (`isActive=false`) |
| 19 | Prospects | `POST` | `/api/v1/prospects/search` | `bc_session`, `x-startup-id` | `prospect:search` | Live Apollo organization search (💰 🔌 📈) |
| 20 | Prospects | `GET` | `/api/v1/prospects` | `bc_session`, `x-startup-id` | `workspace:read` | List prospects with score filters & paging |
| 21 | Prospects | `POST` | `/api/v1/prospects/select` | `bc_session`, `x-startup-id` | `prospect:search` | Batch qualify prospects (`discovered` → `qualified`) |
| 22 | Prospects | `GET` | `/api/v1/prospects/:id` | `bc_session`, `x-startup-id` | `workspace:read` | Prospect detail with scores, contacts, signals |
| 23 | Prospects | `POST` | `/api/v1/prospects/:id/disqualify` | `bc_session`, `x-startup-id` | `prospect:search` | Disqualify prospect with optional reason |
| 24 | Prospects | `POST` | `/api/v1/prospects/:id/do-not-contact` | `bc_session`, `x-startup-id` | `prospect:mark_dnc` | Mark prospect & all contacts as DNC |
| 25 | Prospects | `POST` | `/api/v1/prospects/:id/clear-do-not-contact` | `bc_session`, `x-startup-id` | `prospect:clear_dnc` | Clear DNC status (requires reason, admin/owner) |
| 26 | Scoring | `POST` | `/api/v1/prospects/score` | `bc_session`, `x-startup-id` | `prospect:score` | Batch deterministic rule-based lead scoring |
| 27 | Scoring | `GET` | `/api/v1/prospects/:id/scores` | `bc_session`, `x-startup-id` | `workspace:read` | Get latest score breakdown or historical audit |
| 28 | Scoring | `POST` | `/api/v1/prospects/:id/scores/explain` | `bc_session`, `x-startup-id` | `prospect:score` | AI rationale generation for score (💰 LLM) |
| 29 | Signals | `GET` | `/api/v1/prospects/:id/signals` | `bc_session`, `x-startup-id` | `workspace:read` | List signals with 45-day stale evaluation |
| 30 | Signals | `POST` | `/api/v1/prospects/:id/signals/detect` | `bc_session`, `x-startup-id` | `prospect:score` | Deterministic rule-based signal detection |
| 31 | Signals | `POST` | `/api/v1/prospects/:id/signals/interpret` | `bc_session`, `x-startup-id` | `prospect:score` | LLM interpretation of stored evidence (💰 🔌) |
| 32 | Signals | `POST` | `/api/v1/signals/:id/dismiss` | `bc_session`, `x-startup-id` | `prospect:score` | Dismiss signal while preserving evidence |
| 33 | Contacts | `GET` | `/api/v1/prospects/:id/decision-makers` | `bc_session`, `x-startup-id` | `workspace:read` | List decision-maker contacts for prospect |
| 34 | Contacts | `POST` | `/api/v1/prospects/:id/decision-makers/search` | `bc_session`, `x-startup-id` | `contact:enrich` | Apollo people search without emails (💰 🔌 📈) |
| 35 | Contacts | `POST` | `/api/v1/prospects/:id/decision-makers` | `bc_session`, `x-startup-id` | `contact:enrich` | Manually add contact (free fallback) |
| 36 | Contacts | `POST` | `/api/v1/decision-makers/:id/enrich` | `bc_session`, `x-startup-id` | `contact:enrich` | Apollo contact email enrichment (💰 🔌) |
| 37 | Contacts | `POST` | `/api/v1/decision-makers/:id/do-not-contact` | `bc_session`, `x-startup-id` | `prospect:mark_dnc` | Mark individual contact as Do Not Contact |
| 38 | Campaigns | `POST` | `/api/v1/campaigns` | `bc_session`, `x-startup-id` | `message:draft` | Create new email campaign in `draft` status |
| 39 | Campaigns | `GET` | `/api/v1/campaigns` | `bc_session`, `x-startup-id` | `workspace:read` | List campaigns with status filters & pagination |
| 40 | Campaigns | `GET` | `/api/v1/campaigns/:id` | `bc_session`, `x-startup-id` | `workspace:read` | Get campaign by ID with message statistics |
| 41 | Campaigns | `PATCH` | `/api/v1/campaigns/:id` | `bc_session`, `x-startup-id` | `message:draft` | Rename campaign while in `draft` status |
| 42 | Campaigns | `POST` | `/api/v1/campaigns/:id/submit` | `bc_session`, `x-startup-id` | `message:draft` | Transition campaign: `draft` → `pending_approval` |
| 43 | Campaigns | `POST` | `/api/v1/campaigns/:id/approve` | `bc_session`, `x-startup-id` | `campaign:approve` | Transition campaign: `pending_approval` → `approved` |
| 44 | Campaigns | `POST` | `/api/v1/campaigns/:id/pause` | `bc_session`, `x-startup-id` | `campaign:approve` | Pause active campaign: `active` → `paused` |
| 45 | Campaigns | `POST` | `/api/v1/campaigns/:id/resume` | `bc_session`, `x-startup-id` | `campaign:approve` | Resume campaign: `paused` → `active` |
| 46 | Campaigns | `POST` | `/api/v1/campaigns/:id/complete` | `bc_session`, `x-startup-id` | `campaign:approve` | Mark campaign completed: `active`\|`paused` → `completed` |
| 47 | Campaigns | `POST` | `/api/v1/campaigns/:id/cancel` | `bc_session`, `x-startup-id` | `campaign:approve` | Cancel campaign; cascades cancellation to drafts |
| 48 | Messages | `POST` | `/api/v1/messages/draft` | `bc_session`, `x-startup-id` | `message:draft` | Generate/retrieve outreach draft (💰 LLM 📈) |
| 49 | Messages | `GET` | `/api/v1/messages` | `bc_session`, `x-startup-id` | `workspace:read` | List messages with approval & status filters |
| 50 | Messages | `GET` | `/api/v1/messages/:id` | `bc_session`, `x-startup-id` | `workspace:read` | Get message details by ID |
| 51 | Messages | `PATCH` | `/api/v1/messages/:id` | `bc_session`, `x-startup-id` | `message:edit` | Edit subject/body; resets approval to `pending` |
| 52 | Messages | `POST` | `/api/v1/messages/:id/approve` | `bc_session`, `x-startup-id` | `message:approve` | Approve message: `pending` → `approved` (`ready`) |
| 53 | Messages | `POST` | `/api/v1/messages/:id/reject` | `bc_session`, `x-startup-id` | `message:approve` | Reject message draft with optional reason |
| 54 | Messages | `POST` | `/api/v1/messages/:id/request-revision` | `bc_session`, `x-startup-id` | `message:approve` | Request revision with reviewer feedback note |
| 55 | Messages | `POST` | `/api/v1/messages/:id/handoff` | `bc_session`, `x-startup-id` | `message:handoff` | Prepare mailto payload; marks `handed_off` |
| 56 | Messages | `POST` | `/api/v1/messages/:id/mark-sent` | `bc_session`, `x-startup-id` | `message:handoff` | Founder confirms message sent manually in client |
| 57 | Messages | `POST` | `/api/v1/messages/:id/cancel` | `bc_session`, `x-startup-id` | `message:edit` | Cancel unsent message before handoff |
| 58 | Activity | `GET` | `/api/v1/activities` | `bc_session`, `x-startup-id` | `workspace:read` | List audit activities with time & type filters |
| 59 | Activity | `POST` | `/api/v1/activities/replies` | `bc_session`, `x-startup-id` | `activity:log` | Log founder-received reply; AI classify (💰 LLM) |
| 60 | Next Actions | `GET` | `/api/v1/next-actions` | `bc_session`, `x-startup-id` | `workspace:read` | List recommended next best actions by priority |
| 61 | Next Actions | `POST` | `/api/v1/next-actions/:id/accept` | `bc_session`, `x-startup-id` | `nba:act` | Accept recommendation: `pending` → `accepted` |
| 62 | Next Actions | `POST` | `/api/v1/next-actions/:id/dismiss` | `bc_session`, `x-startup-id` | `nba:act` | Dismiss recommendation with optional reason |
| 63 | Next Actions | `POST` | `/api/v1/next-actions/:id/complete` | `bc_session`, `x-startup-id` | `nba:act` | Mark recommendation completed |
| 64 | Usage | `GET` | `/api/v1/usage/summary` | `bc_session`, `x-startup-id` | `workspace:read` | Get workspace spend cap, commitments & counters |
| 65 | Usage | `GET` | `/api/v1/usage/records` | `bc_session`, `x-startup-id` | `workspace:read` | Paginated audit log of usage ledger transactions |
| 66 | Dashboard | `GET` | `/api/v1/dashboard` | `bc_session`, `x-startup-id` | `workspace:read` | Aggregated founder funnel, counts & priority actions |

---

## 4. Health and Auth

### `GET /health`
- **Access:** Public (No authentication, no tenant header, no CSRF check).
- **Description:** Verifies server liveness and service availability.
- **Response `200`:**
```json
{
  "data": {
    "status": "ok",
    "time": "2026-10-11T12:00:00.000Z"
  }
}
```

---

### `POST /api/v1/auth/register`
- **Access:** Public. Rate-limited (10 req / 15 min per IP). CSRF check enforced.
- **Request Body (`application/json`):**
  - `name`: string, 1–80 characters, trimmed.
  - `email`: string, valid email format, max 254 characters, lowercased.
  - `password`: string, 10–128 characters.
  - Strict schema: extraneous fields are rejected.
- **Response `201`:**
```json
{
  "data": {
    "id": "664f9a2e4b124c32a5e29b2f",
    "name": "Alice Founder",
    "email": "alice@example.com",
    "status": "active",
    "createdAt": "2026-10-11T07:00:00.000Z"
  }
}
```
- **Errors:**
  - `400 VALIDATION_ERROR` / `422 VALIDATION_FAILED`: Invalid email, short password, or extra fields.
  - `409 CONFLICT`: Email already registered.
  - `429 RATE_LIMITED`: Exceeded rate limit.

---

### `POST /api/v1/auth/login`
- **Access:** Public. Rate-limited (10 req / 15 min per IP). CSRF check enforced.
- **Request Body (`application/json`):**
  - `email`: string, valid email format.
  - `password`: string, 1–128 characters.
- **Response `200`:**
  - Sets `Set-Cookie: bc_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`.
```json
{
  "data": {
    "user": {
      "id": "664f9a2e4b124c32a5e29b2f",
      "name": "Alice Founder",
      "email": "alice@example.com",
      "status": "active",
      "createdAt": "2026-10-11T07:00:00.000Z"
    },
    "memberships": [
      {
        "startupId": "665a1b2c3d4e5f6a7b8c9d0e",
        "role": "owner",
        "status": "active"
      }
    ]
  }
}
```
- **Errors:**
  - `401 UNAUTHENTICATED`: Invalid email or incorrect password (identical timing-safe error response).
  - `429 RATE_LIMITED`: Rate limit exceeded.

---

### `GET /api/v1/auth/me`
- **Access:** Requires `bc_session` cookie.
- **Response `200`:** Returns currently authenticated user and active memberships.
```json
{
  "data": {
    "user": {
      "id": "664f9a2e4b124c32a5e29b2f",
      "name": "Alice Founder",
      "email": "alice@example.com",
      "status": "active",
      "createdAt": "2026-10-11T07:00:00.000Z"
    },
    "memberships": [
      {
        "startupId": "665a1b2c3d4e5f6a7b8c9d0e",
        "role": "owner",
        "status": "active"
      }
    ]
  }
}
```
- **Errors:**
  - `401 UNAUTHENTICATED`: Missing or invalid session cookie.

---

### `POST /api/v1/auth/logout`
- **Access:** CSRF check enforced.
- **Description:** Clears the `bc_session` cookie (`Max-Age=0`).
- **Response `204`:** No Content.

---

## 5. Workspace & Members

### `POST /api/v1/startups`
- **Access:** Authenticated user (`bc_session`). No `X-Startup-Id` required. CSRF check enforced.
- **Description:** Creates a new startup workspace and automatically binds caller as `owner` in a transaction. Initial plan is `trial` with a 15-day trial period and trial spend cap.
- **Request Body (`application/json`):**
  - `name`: string, 1–80 characters, trimmed.
- **Response `201`:**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "name": "Acme AI",
    "plan": "trial",
    "status": "active",
    "trialEndsAt": "2026-10-26T07:00:00.000Z",
    "settings": {},
    "createdAt": "2026-10-11T07:00:00.000Z"
  }
}
```

---

### `GET /api/v1/startups`
- **Access:** Authenticated user (`bc_session`).
- **Description:** Returns all active startup workspaces where caller holds an active membership.
- **Response `200`:**
```json
{
  "data": [
    {
      "id": "665a1b2c3d4e5f6a7b8c9d0e",
      "name": "Acme AI",
      "plan": "trial",
      "status": "active",
      "role": "owner",
      "createdAt": "2026-10-11T07:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/v1/startups/current`
- **Access:** Authenticated user (`bc_session`), `X-Startup-Id` header. Permission: `workspace:read`.
- **Description:** Returns full details of active workspace, including ledger spend totals, caller role & permissions, and provider capability flags.
- **Response `200`:**
```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "name": "Acme AI",
    "plan": "trial",
    "status": "active",
    "trialEndsAt": "2026-10-26T07:00:00.000Z",
    "settings": {
      "calendarLink": "https://cal.com/acme/demo",
      "senderName": "Alice Founder",
      "senderTitle": "Founder & CEO",
      "productSummary": "AI sales agent for B2B founders"
    },
    "spend": {
      "capPaise": 100000,
      "committedPaise": 0,
      "reservedPaise": 0,
      "remainingPaise": 100000
    },
    "me": {
      "role": "owner",
      "permissions": ["workspace:read", "workspace:settings", "member:invite", "member:role", "icp:write", "prospect:search", "prospect:score", "contact:enrich", "campaign:approve", "message:draft", "message:edit", "message:approve", "message:handoff", "activity:log", "nba:act"]
    },
    "capabilities": {
      "searchOrgs": true,
      "searchPeople": true,
      "enrich": true
    },
    "createdAt": "2026-10-11T07:00:00.000Z"
  }
}
```

---

### `PATCH /api/v1/startups/current`
- **Access:** Authenticated user (`bc_session`), `X-Startup-Id` header. Permission: `workspace:settings` (`owner`, `admin`). CSRF check enforced.
- **Request Body (`application/json`, all optional):**
  - `name`?: string, 1–80 characters.
  - `settings`?: object:
    - `calendarLink`?: string, valid URL format.
    - `senderName`?: string, max 80 characters.
    - `senderTitle`?: string, max 80 characters.
    - `productSummary`?: string, max 1000 characters.
- **Response `200`:** Returns updated `Startup` object.

---

### `GET /api/v1/startups/current/members`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Response `200`:**
```json
{
  "data": [
    {
      "id": "665b2a1b2c3d4e5f6a7b8c9d",
      "userId": "664f9a2e4b124c32a5e29b2f",
      "name": "Alice Founder",
      "email": "alice@example.com",
      "role": "owner",
      "status": "active"
    }
  ]
}
```

---

### `POST /api/v1/startups/current/members`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `member:invite` (`owner`, `admin`). Entitlement: 📈 `maxUsers` (1 on trial plan). CSRF check enforced.
- **Description:** Invites an existing registered user to the workspace.
- **Request Body (`application/json`):**
  - `email`: string, valid email format.
  - `role`: enum (`admin` | `member`).
- **Response `201`:** Returns invited `Member` object with `status: "active"` (or `invited`).
- **Errors:**
  - `402 PLAN_LIMIT_REACHED`: Seat limit reached (e.g. trial has 1 seat limit).
  - `404 NOT_FOUND`: No user account exists with the provided email.
  - `409 CONFLICT`: User is already a member of this workspace.

---

### `PATCH /api/v1/startups/current/members/:memberId`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `member:role` (`owner`, `admin`). CSRF check enforced.
- **Params:** `memberId`: 24-character ObjectId string.
- **Request Body (`application/json`):**
  - `role`: enum (`owner` | `admin` | `member`).
- **Response `200`:** Returns updated `Member` object.
- **Errors:**
  - `409 INVALID_STATE`: Cannot demote the sole remaining owner of the workspace.

---

### `DELETE /api/v1/startups/current/members/:memberId`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `member:role` (`owner`, `admin`). CSRF check enforced.
- **Params:** `memberId`: 24-character ObjectId string.
- **Description:** Soft-removes member (`status="removed"`).
- **Response `204`:** No Content.
- **Errors:**
  - `409 INVALID_STATE`: Cannot remove the sole remaining owner of the workspace.

---

## 6. Ideal Customer Profile (ICP)

### `POST /api/v1/icps/propose`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `icp:write`. 💰 Paid: LLM (`icp_extract`). CSRF check enforced.
- **Description:** Synthesizes structured B2B targeting criteria from free-form company and product descriptions. **Does not save to database**; returns proposed criteria for founder review.
- **Request Body (`application/json`):**
  - `productDescription`: string, 20–2000 characters.
  - `targetGeography`?: string, 1–100 characters.
  - `salesObjective`?: string, 1–200 characters.
  - `notes`?: string, max 1000 characters.
- **Response `200`:**
```json
{
  "data": {
    "criteria": {
      "industries": ["Human Resources", "Information Technology"],
      "countries": ["United Kingdom"],
      "employeeRanges": ["51-200", "201-500"],
      "targetJobTitles": ["VP People", "Head of HR", "Chief People Officer"],
      "targetSeniority": ["director", "vp", "c_level"]
    },
    "rationale": "High-growth UK mid-market tech companies require automated HR compliance."
  }
}
```

---

### `POST /api/v1/icps`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `icp:write`. 📈 Entitlement: `maxIcps` (1 on trial). CSRF check enforced.
- **Request Body (`application/json`):**
  - `name`: string, 1–80 characters, trimmed.
  - `criteria`: `IcpCriteria` object (arrays bounded: max 25 items each, max 80 chars per item).
- **Response `201`:** Returns created `Icp` object with `criteriaVersion: 1` and `isActive: true`.
- **Errors:**
  - `402 PLAN_LIMIT_REACHED`: Workspace already has maximum active ICPs allowed on plan.

---

### `GET /api/v1/icps`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Query Parameters:**
  - `isActive`?: boolean string (`"true"` | `"false"`).
  - `sort`?: enum (`createdAt` | `-createdAt`, default `-createdAt`).
  - `page`?: integer >= 1 (default 1).
  - `limit`?: integer 1–100 (default 20).
- **Response `200`:**
```json
{
  "data": [
    {
      "id": "665c1a2e4b124c32a5e29b2f",
      "name": "UK Mid-Market Tech",
      "criteria": { "industries": ["Information Technology"], "countries": ["United Kingdom"] },
      "criteriaVersion": 1,
      "isActive": true,
      "createdBy": "664f9a2e4b124c32a5e29b2f",
      "createdAt": "2026-10-11T08:00:00.000Z",
      "updatedAt": "2026-10-11T08:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

---

### `GET /api/v1/icps/:id`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Params:** `id`: 24-character ObjectId string.
- **Response `200`:** Returns `Icp` object.

---

### `PATCH /api/v1/icps/:id`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `icp:write`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Request Body (`application/json`):**
  - `name`?: string, 1–80 characters.
  - `criteria`?: `IcpCriteria` (full replacement of criteria).
- **Description:** When `criteria` changes, server automatically increments `criteriaVersion` by 1.
- **Response `200`:** Returns updated `Icp` object.

---

### `POST /api/v1/icps/:id/archive`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `icp:write`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Sets `isActive = false`. Archived ICPs cannot be used for discovery searches.
- **Response `204`:** No Content.

---

## 7. Prospects and Discovery

### `POST /api/v1/prospects/search`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:search`. 💰 Paid: Apollo (`search_orgs`). 🔌 Capability-gated: `search_orgs`. 📈 Entitlement: `prospects`. CSRF check enforced.
- **Request Body (`application/json`):**
  - `icpId`: 24-character ObjectId string.
  - `page`?: integer >= 1 (default 1).
  - `perPage`?: integer 1–25 (default 25).
- **Response `200`:**
```json
{
  "data": {
    "created": 18,
    "existing": 5,
    "alsoMatchesIcp": 2,
    "hasMore": true,
    "items": [
      {
        "id": "665d1a2e4b124c32a5e29b2f",
        "icpId": "665c1a2e4b124c32a5e29b2f",
        "name": "CloudScale Ltd",
        "domain": "cloudscale.co.uk",
        "status": "discovered",
        "firmographics": { "industry": "Information Technology", "employeeCount": 120, "country": "United Kingdom" },
        "latestScore": { "icpId": "665c1a2e4b124c32a5e29b2f", "score": 85, "category": "high", "coverage": 0.85, "scoredAt": "2026-10-11T08:30:00.000Z" },
        "createdAt": "2026-10-11T08:30:00.000Z",
        "updatedAt": "2026-10-11T08:30:00.000Z"
      }
    ],
    "spend": { "remainingPaise": 99000 }
  }
}
```
- **Errors:**
  - `409 INVALID_STATE`: Target ICP is archived.
  - `503 CAPABILITY_DISABLED`: `search_orgs` capability is disabled in deployment.

---

### `GET /api/v1/prospects`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Query Parameters:**
  - `icpId`?: 24-character ObjectId string.
  - `scoredAgainstIcpId`?: 24-character ObjectId string.
  - `status`?: enum (`discovered` | `qualified` | `in_outreach` | `replied` | `disqualified` | `do_not_contact`).
  - `category`?: string (comma-separated list: `hot,high,medium,low`).
  - `minScore`?: integer 0–100.
  - `q`?: string (name / domain search prefix).
  - `includeLow`?: boolean string (`"true"` | `"false"`, default `false` hides `low` category).
  - `sort`?: enum (`score` | `-score` | `createdAt` | `-createdAt` | `name`).
  - `page`?: integer >= 1 (default 1).
  - `limit`?: integer 1–100 (default 20).
- **Response `200`:** Returns `{ data: Prospect[], meta }`.

---

### `POST /api/v1/prospects/select`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:search`. CSRF check enforced.
- **Description:** Batch transitions prospects from `discovered` to `qualified`. Skips records in terminal or DNC states.
- **Request Body (`application/json`):**
  - `prospectIds`: array of 24-character ObjectId strings (1–50 items).
- **Response `200`:**
```json
{
  "data": {
    "updated": 10,
    "skipped": [
      { "id": "665d9...", "reason": "Already in outreach or marked do_not_contact" }
    ]
  }
}
```

---

### `GET /api/v1/prospects/:id`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Params:** `id`: 24-character ObjectId string.
- **Response `200`:** Aggregates prospect detail with lead scores, active signals, decision makers, and recent audit activity.
```json
{
  "data": {
    "prospect": { "id": "665d1...", "name": "CloudScale Ltd", "status": "qualified" },
    "scores": [ { "icpId": "665c1...", "latest": { "score": 85, "category": "high" } } ],
    "signals": [ { "id": "665e1...", "signalType": "technology", "status": "active" } ],
    "contacts": [ { "id": "665f1...", "fullName": "Sarah Connor", "outreachStatus": "not_contacted" } ],
    "recentActivity": [ { "activityType": "prospect_discovered", "summary": "Discovered via Apollo" } ]
  }
}
```

---

### `POST /api/v1/prospects/:id/disqualify`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:search`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Request Body (`application/json`):**
  - `reason`?: string, max 300 characters.
- **Response `200`:** Returns updated `Prospect` with `status: "disqualified"`.

---

### `POST /api/v1/prospects/:id/do-not-contact`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:mark_dnc`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Sets prospect to `do_not_contact` and cascades `outreachStatus="do_not_contact"` to **all** associated decision makers. Cancels pending unsent drafts.
- **Request Body (`application/json`):**
  - `reason`?: string, max 300 characters.
- **Response `200`:** Returns updated `Prospect` with `status: "do_not_contact"`.

---

### `POST /api/v1/prospects/:id/clear-do-not-contact`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:clear_dnc` (`owner`, `admin`). CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Restores prospect to `qualified` and logs an audit activity record. Requires explicit justification.
- **Request Body (`application/json`):**
  - `reason`: string, 5–300 characters (required).
- **Response `200`:** Returns updated `Prospect` with `status: "qualified"`.

---

## 8. Scoring

### `POST /api/v1/prospects/score`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:score`. CSRF check enforced.
- **Description:** Deterministic rules-based lead scoring engine (0–100 scale based on industry, company size, revenue, tech stack, and location). Free of API charge.
- **Request Body (`application/json`):**
  - `prospectIds`: array of 24-character ObjectId strings (1–50 items).
  - `icpId`: 24-character ObjectId string.
- **Response `200`:**
```json
{
  "data": {
    "scored": 5,
    "items": [
      {
        "prospectId": "665d1...",
        "icpId": "665c1...",
        "score": 85,
        "category": "high",
        "coverage": 0.85,
        "scoredAt": "2026-10-11T09:00:00.000Z"
      }
    ]
  }
}
```

---

### `GET /api/v1/prospects/:id/scores`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Params:** `id`: 24-character ObjectId string.
- **Query Parameters:**
  - `icpId`?: 24-character ObjectId string.
  - `history`?: boolean string (`"true"` | `"false"`, default `false`).
- **Response `200`:** Returns latest `LeadScore` object, or paginated array `{ data: LeadScore[], meta }` when `history=true`.

---

### `POST /api/v1/prospects/:id/scores/explain`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:score`. 💰 Paid: LLM. CSRF check enforced.
- **Description:** Generates an AI textual rationale explaining why the prospect scored in its category based strictly on stored criteria match breakdown. **Never alters score or category**.
- **Request Body (`application/json`):**
  - `icpId`: 24-character ObjectId string.
- **Response `200`:** Returns `LeadScore` with `explanation` and `explanationSource: "ai"`.

---

## 9. Signals

### `GET /api/v1/prospects/:id/signals`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Params:** `id`: 24-character ObjectId string.
- **Query Parameters:**
  - `status`?: enum (`active` | `stale` | `dismissed`).
- **Description:** Evaluates 45-day signal staleness at read time. Signals detected >45 days ago are returned with status `stale`.
- **Response `200`:**
```json
{
  "data": [
    {
      "id": "665e1...",
      "prospectId": "665d1...",
      "signalType": "technology",
      "description": "Uses modern cloud infrastructure (Kubernetes, AWS)",
      "evidence": [{ "field": "firmographics.technologies", "value": ["Kubernetes", "AWS"] }],
      "confidence": 0.9,
      "status": "active",
      "detectedAt": "2026-10-11T08:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/v1/prospects/:id/signals/detect`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:score`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Rule-based detection against verified firmographics. Free of charge.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:**
```json
{
  "data": {
    "created": 1,
    "signals": [ { "id": "665e1...", "signalType": "hiring", "status": "active" } ],
    "message": "Signals detected from available firmographics"
  }
}
```

---

### `POST /api/v1/prospects/:id/signals/interpret`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:score`. 💰 Paid: LLM. 🔌 Capability-gated. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Synthesizes stored evidence into actionable outreach hooks. Rejects (`502 PROVIDER_FAILED`) any LLM claims that reference facts absent from stored data.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns synthesized `Signal` or `503 CAPABILITY_DISABLED` if unconfigured.

---

### `POST /api/v1/signals/:id/dismiss`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:score`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Transitions signal to `dismissed` status while preserving evidence for audit history.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Signal` with `status: "dismissed"`.

---

## 10. Contacts (Decision Makers)

### `GET /api/v1/prospects/:id/decision-makers`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Params:** `id`: 24-character ObjectId string.
- **Response `200`:** Returns `{ data: Contact[] }`.

---

### `POST /api/v1/prospects/:id/decision-makers/search`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `contact:enrich`. 💰 Paid: Apollo (`search_people`). 🔌 Capability-gated: `search_people`. 📈 Entitlement: `dmSearches`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Queries Apollo for matching executives based on ICP targeting criteria. Contacts are stored **without email** at this stage.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:**
```json
{
  "data": {
    "created": 2,
    "existing": 1,
    "items": [
      {
        "id": "665f1...",
        "prospectId": "665d1...",
        "fullName": "Sarah Connor",
        "jobTitle": "VP Engineering",
        "outreachStatus": "not_contacted",
        "source": "apollo",
        "createdAt": "2026-10-11T09:15:00.000Z"
      }
    ]
  }
}
```

---

### `POST /api/v1/prospects/:id/decision-makers`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `contact:enrich`. Free of charge (manual fallback). CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Request Body (`application/json`):**
  - `fullName`: string, 1–120 characters, trimmed.
  - `jobTitle`?: string, max 120 characters.
  - `businessEmail`: string, valid email format.
  - `linkedinUrl`?: string, valid URL format.
- **Response `201`:** Returns created `Contact` (`source: "manual"`, `emailVerified: false`).
- **Errors:**
  - `409 CONFLICT`: Email already exists on this prospect.
  - `409 DO_NOT_CONTACT`: Prospect is marked Do Not Contact.

---

### `POST /api/v1/decision-makers/:id/enrich`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `contact:enrich`. 💰 Paid: Apollo (`enrich`). 🔌 Capability-gated: `enrich`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Retrieves verified business email for decision maker from Apollo.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Contact` with `businessEmail` and `emailVerified`.
- **Errors:**
  - `409 INVALID_STATE`: Contact already has a verified email.
  - `409 DO_NOT_CONTACT`: Prospect or contact is suppressed.

---

### `POST /api/v1/decision-makers/:id/do-not-contact`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `prospect:mark_dnc`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Contact` with `outreachStatus: "do_not_contact"`.

---

## 11. Campaigns

### `POST /api/v1/campaigns`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:draft`. CSRF check enforced.
- **Description:** Creates an email outreach campaign container in `draft` status.
- **Request Body (`application/json`):**
  - `icpId`: 24-character ObjectId string.
  - `name`: string, 1–80 characters, trimmed.
  - `channel`: literal `"email"` (other channels return `422`).
- **Response `201`:** Returns created `Campaign` with `status: "draft"`.

---

### `GET /api/v1/campaigns`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Query Parameters:**
  - `status`?: enum (`draft` | `pending_approval` | `approved` | `active` | `paused` | `completed` | `cancelled`).
  - `sort`?: enum (`createdAt` | `-createdAt`, default `-createdAt`).
  - `page`?: integer >= 1 (default 1).
  - `limit`?: integer 1–100 (default 20).
- **Response `200`:** Returns `{ data: Campaign[], meta }`.

---

### `GET /api/v1/campaigns/:id`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Params:** `id`: 24-character ObjectId string.
- **Response `200`:** Returns `Campaign` object with aggregated message counts by status.

---

### `PATCH /api/v1/campaigns/:id`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:draft`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Renames a campaign. Allowed only while campaign is in `draft` status.
- **Request Body (`application/json`):**
  - `name`: string, 1–80 characters (required).
- **Response `200`:** Returns updated `Campaign`.
- **Errors:**
  - `409 INVALID_STATE`: Campaign has already progressed past `draft`.

---

### `POST /api/v1/campaigns/:id/submit`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:draft`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Transitions campaign from `draft` to `pending_approval`.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Campaign` with `status: "pending_approval"`.

---

### `POST /api/v1/campaigns/:id/approve`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `campaign:approve` (`owner`, `admin`). CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Approves campaign: `pending_approval` → `approved`. Sets `approvedBy` and `approvedAt`.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Campaign` with `status: "approved"`.

---

### `POST /api/v1/campaigns/:id/pause`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `campaign:approve`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Pauses active outreach: `active` → `paused`. Blocks new drafts and handoffs.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Campaign` with `status: "paused"`.

---

### `POST /api/v1/campaigns/:id/resume`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `campaign:approve`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Resumes paused campaign: `paused` → `active`.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Campaign` with `status: "active"`.

---

### `POST /api/v1/campaigns/:id/complete`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `campaign:approve`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Marks outreach cycle completed: `active` | `paused` → `completed`. Terminal state.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Campaign` with `status: "completed"`.

---

### `POST /api/v1/campaigns/:id/cancel`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `campaign:approve`. CSRF check enforced.
- **Description:** Cancels campaign from any non-terminal state. Cascades cancellation to all unsent draft messages.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Campaign` with `status: "cancelled"`.

---

## 12. Messages (Draft-First Outreach)

### `POST /api/v1/messages/draft`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:draft`. 💰 Paid: LLM. 📈 Entitlement: `emails`. CSRF check enforced.
- **Description:** Generates an AI outreach draft.
  - **Idempotency:** Repeated requests with identical `(campaignId, decisionMakerId, step)` return the existing draft with `200` and write **no** new ledger row.
  - **Regeneration:** If `regenerate=true`, rewrites the existing draft in-place, increments `revision`, and resets approval to `pending`. Allowed only while `approvalStatus != 'approved'`.
  - **Preconditions:** Campaign not terminal; contact has `businessEmail` (`422`); prospect/contact not DNC (`409 DO_NOT_CONTACT`).
- **Request Body (`application/json`):**
  - `campaignId`: 24-character ObjectId string.
  - `decisionMakerId`: 24-character ObjectId string.
  - `step`?: integer 1–5 (default 1).
  - `regenerate`?: boolean (default false).
- **Response `201` (created) / `200` (idempotent / regenerated):**
```json
{
  "data": {
    "id": "665a9...",
    "campaignId": "665a0...",
    "prospectId": "665d1...",
    "decisionMakerId": "665f1...",
    "step": 1,
    "revision": 1,
    "subject": "Quick question regarding CloudScale's hiring plans",
    "body": "Hi Sarah,\n\nNoticed your recent Kubernetes rollout...",
    "approvalStatus": "pending",
    "status": "draft",
    "createdBy": "664f9...",
    "createdAt": "2026-10-11T10:00:00.000Z",
    "updatedAt": "2026-10-11T10:00:00.000Z"
  }
}
```

---

### `GET /api/v1/messages`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Query Parameters:**
  - `campaignId`?: 24-character ObjectId.
  - `prospectId`?: 24-character ObjectId.
  - `decisionMakerId`?: 24-character ObjectId.
  - `approvalStatus`?: enum (`pending` | `approved` | `rejected` | `revision_requested`).
  - `status`?: enum (`draft` | `ready` | `handed_off` | `user_reported_sent` | `cancelled`).
  - `sort`?: enum (`createdAt` | `-createdAt`, default `-createdAt`).
  - `page`?: integer >= 1 (default 1).
  - `limit`?: integer 1–100 (default 20).
- **Response `200`:** Returns `{ data: Message[], meta }`.

---

### `GET /api/v1/messages/:id`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Params:** `id`: 24-character ObjectId string.
- **Response `200`:** Returns `Message` object.

---

### `PATCH /api/v1/messages/:id`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:edit`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Founder edits subject or body. **Rule:** Any edit automatically resets `approvalStatus = 'pending'`, `status = 'draft'`, and clears `approvedBy/At`. Blocked once `handed_off` or later (`409 INVALID_STATE`).
- **Request Body (`application/json`):**
  - `subject`?: string, 1–200 characters.
  - `body`?: string, 1–5000 characters.
  - At least one of `subject` or `body` must be provided.
- **Response `200`:** Returns updated `Message`.

---

### `POST /api/v1/messages/:id/approve`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:approve` (`owner`, `admin`). CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Sets `approvalStatus = 'approved'` and `status = 'ready'`.
- **Preconditions:** Subject & body non-empty (`422`); campaign `approved` or `active` (`409 INVALID_STATE`); contact not DNC (`409 DO_NOT_CONTACT`).
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Message`.

---

### `POST /api/v1/messages/:id/reject`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:approve`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Request Body (`application/json`):**
  - `reason`?: string, max 300 characters.
- **Response `200`:** Returns updated `Message` with `approvalStatus: "rejected"`.

---

### `POST /api/v1/messages/:id/request-revision`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:approve`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Request Body (`application/json`):**
  - `note`: string, 1–500 characters (required feedback).
- **Response `200`:** Returns updated `Message` with `approvalStatus: "revision_requested"`.

---

### `POST /api/v1/messages/:id/handoff`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:handoff`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Verifies approval and transitions message: `ready` → `handed_off`. Generates mailto payload and logs a `handoff_requested` activity. The client constructs the local email client link. Calling repeatedly on a `handed_off` message is allowed.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:**
```json
{
  "data": {
    "message": { "id": "665a9...", "status": "handed_off" },
    "handoff": {
      "to": "sarah@cloudscale.co.uk",
      "subject": "Quick question regarding CloudScale's hiring plans",
      "body": "Hi Sarah,\n\nNoticed your recent Kubernetes rollout..."
    }
  }
}
```
- **Errors:**
  - `409 APPROVAL_REQUIRED`: Message has not been approved.
  - `409 DO_NOT_CONTACT`: Prospect or contact suppressed.

---

### `POST /api/v1/messages/:id/mark-sent`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:handoff`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Founder confirms they sent the email from their local mail client: `handed_off` → `user_reported_sent`. Sets `sentAt` timestamp.
- **Request Body (`application/json`):**
  - `sentAt`?: string, ISO-8601 date string (not in the future, not prior to handoff).
- **Response `200`:** Returns updated `Message` with `status: "user_reported_sent"`.

---

### `POST /api/v1/messages/:id/cancel`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `message:edit`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Cancels message before handoff: `draft`|`ready` → `cancelled`.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `Message` with `status: "cancelled"`.

---

## 13. Activity & Replies

### `GET /api/v1/activities`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Query Parameters:**
  - `prospectId`?: 24-character ObjectId.
  - `messageId`?: 24-character ObjectId.
  - `type`?: string (comma-separated list of valid `activityType` values).
  - `from`?: ISO-8601 UTC date string.
  - `to`?: ISO-8601 UTC date string (`to >= from`).
  - `sort`?: enum (`-occurredAt` | `occurredAt`, default `-occurredAt`).
- **Description:** Append-only workspace audit trail. Update and delete endpoints do not exist.
- **Response `200`:** Returns `{ data: Activity[] }`.

---

### `POST /api/v1/activities/replies`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `activity:log`. 💰 Paid: LLM (`classify_reply`). CSRF check enforced.
- **Description:** Founder pastes an inbound email reply.
  - **Deterministic Keyword Pre-check:** If text contains unsubscribe keywords (e.g. "unsubscribe", "stop", "remove me"), sets prospect and contact to `do_not_contact` and cancels unsent drafts, even if the LLM call fails.
  - **AI Classification:** Categorizes intent (`meeting_requested`, `info_requested`, `not_interested`, `unsubscribe`, `other`) and confidence score. Creates a recommended next action.
  - **Fallback:** If LLM call times out or fails (`502`), the reply is still saved as `reply_logged` with `classification: null`.
- **Request Body (`application/json`):**
  - `prospectId`: 24-character ObjectId string.
  - `messageId`?: 24-character ObjectId string.
  - `text`: string, 1–5000 characters (pasted reply text).
- **Response `201`:**
```json
{
  "data": {
    "reply": {
      "id": "665e0...",
      "activityType": "reply_logged",
      "summary": "Founder pasted email reply",
      "occurredAt": "2026-10-11T10:30:00.000Z"
    },
    "classification": {
      "id": "665e1...",
      "activityType": "reply_classified",
      "classification": { "intent": "meeting_requested", "confidence": 0.95 }
    },
    "effects": [
      { "type": "next_action_created", "id": "665f9..." }
    ]
  }
}
```

---

## 14. Next Best Actions

### `GET /api/v1/next-actions`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Query Parameters:**
  - `status`?: enum (`pending` | `accepted` | `dismissed` | `completed` | `expired`, default `pending`).
  - `prospectId`?: 24-character ObjectId.
  - `sort`?: literal `priority` (high priority first, then earliest `dueAt`).
- **Description:** Lazily refreshes rule-based recommendations before reading. Stale actions past `expiresAt` return as `expired`. Uses templated fallback text if LLM budget is exhausted; **never fails with `BUDGET_EXHAUSTED`**.
- **Response `200`:**
```json
{
  "data": [
    {
      "id": "665f9...",
      "prospectId": "665d1...",
      "actionType": "handoff_message",
      "title": "Send approved follow-up to Sarah Connor",
      "reason": "Draft was approved 2 hours ago",
      "priority": "high",
      "status": "pending",
      "dueAt": "2026-10-11T12:00:00.000Z",
      "createdAt": "2026-10-11T10:00:00.000Z"
    }
  ],
  "meta": { "total": 1 }
}
```

---

### `POST /api/v1/next-actions/:id/accept`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `nba:act`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Marks action accepted (`pending` → `accepted`). Performs no external action; returns a UI route hint for the founder.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:**
```json
{
  "data": { "id": "665f9...", "status": "accepted" },
  "next": { "route": "/messages/665a9..." }
}
```

---

### `POST /api/v1/next-actions/:id/dismiss`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `nba:act`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Request Body (`application/json`):**
  - `reason`?: string, max 200 characters.
- **Response `200`:** Returns updated `NextAction` with `status: "dismissed"`.

---

### `POST /api/v1/next-actions/:id/complete`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `nba:act`. CSRF check enforced.
- **Params:** `id`: 24-character ObjectId string.
- **Description:** Transitions action from `pending` or `accepted` to `completed`.
- **Request Body (`application/json`):** `{}` (strict empty object).
- **Response `200`:** Returns updated `NextAction` with `status: "completed"`.

---

## 15. Usage Ledger & Dashboard

### `GET /api/v1/usage/summary`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Description:** Returns real-time API budget spend and entitlement usage counters for the active workspace. All monetary amounts are integer paise.
- **Response `200`:**
```json
{
  "data": {
    "plan": "trial",
    "trialEndsAt": "2026-10-26T07:00:00.000Z",
    "trialDaysLeft": 15,
    "spend": {
      "capPaise": 100000,
      "committedPaise": 3600,
      "reservedPaise": 0,
      "remainingPaise": 96400,
      "costType": "estimated"
    },
    "entitlements": {
      "prospects": { "used": 18, "limit": 50 },
      "dmSearches": { "used": 2, "limit": 30 },
      "emails": { "used": 1, "limit": 15 },
      "icps": { "used": 1, "limit": 1 }
    }
  }
}
```

---

### `GET /api/v1/usage/records`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Query Parameters:**
  - `provider`?: enum (`apollo` | `llm`).
  - `operation`?: string, 1–120 characters (e.g. `apollo.org_search`, `llm.draft_message`).
  - `status`?: enum (`success` | `failed` | `blocked`).
  - `from`?: ISO-8601 UTC date string.
  - `to`?: ISO-8601 UTC date string (`to >= from`).
  - `page`?: integer >= 1 (default 1).
  - `limit`?: integer 1–100 (default 20).
- **Description:** Paginated audit ledger. Scoped strictly to the active workspace. Cross-tenant records cannot be accessed.
- **Response `200`:**
```json
{
  "data": [
    {
      "id": "665e7...",
      "provider": "llm",
      "operation": "llm.draft_message",
      "status": "success",
      "costPaise": 120,
      "costType": "estimated",
      "occurredAt": "2026-10-11T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

---

### `GET /api/v1/dashboard`
- **Access:** Authenticated user, `X-Startup-Id`. Permission: `workspace:read`.
- **Description:** Aggregates top-level operational metrics, founder sales funnel counts, and top next actions for dashboard display.
- **Response `200`:**
```json
{
  "data": {
    "today": {
      "prospectsFound": 25,
      "hotAndHigh": 12,
      "draftsPendingApproval": 4,
      "readyForHandoff": 6,
      "followUpsDue": 3
    },
    "funnel": {
      "discovered": 25,
      "qualified": 12,
      "contactsWithEmail": 9,
      "approvedDrafts": 6,
      "handedOff": 5,
      "userReportedSent": 3,
      "repliesLogged": 1
    },
    "topActions": [
      {
        "id": "665f9...",
        "actionType": "handoff_message",
        "title": "Send approved follow-up to Sarah Connor",
        "priority": "high",
        "status": "pending"
      }
    ],
    "usage": {
      "remainingPaise": 96400,
      "trialDaysLeft": 15
    }
  }
}
```

---

## 16. Endpoint-Level Permission and Flag Matrix

| Endpoint | Method | Required Permission | 💰 Paid | 🔌 Capability Flag | 📈 Entitlement | Writes Ledger |
|---|---|---|:---:|:---:|:---:|:---:|
| `/health` | `GET` | None (Public) | — | — | — | — |
| `/auth/register` | `POST` | None (Public) | — | — | — | — |
| `/auth/login` | `POST` | None (Public) | — | — | — | — |
| `/auth/me` | `GET` | Authenticated user | — | — | — | — |
| `/auth/logout` | `POST` | Authenticated user | — | — | — | — |
| `/startups` | `POST` | Signed-in user | — | — | — | — |
| `/startups` | `GET` | Signed-in user | — | — | — | — |
| `/startups/current` | `GET` | `workspace:read` | — | — | — | — |
| `/startups/current` | `PATCH` | `workspace:settings` | — | — | — | — |
| `/startups/current/members` | `GET` | `workspace:read` | — | — | — | — |
| `/startups/current/members` | `POST` | `member:invite` | — | — | `maxUsers` | — |
| `/startups/current/members/:id` | `PATCH` | `member:role` | — | — | — | — |
| `/startups/current/members/:id` | `DELETE` | `member:role` | — | — | — | — |
| `/icps/propose` | `POST` | `icp:write` | LLM | — | — | ✔ |
| `/icps` | `POST` | `icp:write` | — | — | `maxIcps` | — |
| `/icps` | `GET` | `workspace:read` | — | — | — | — |
| `/icps/:id` | `GET` | `workspace:read` | — | — | — | — |
| `/icps/:id` | `PATCH` | `icp:write` | — | — | — | — |
| `/icps/:id/archive` | `POST` | `icp:write` | — | — | — | — |
| `/prospects/search` | `POST` | `prospect:search` | Apollo | `search_orgs` | `prospects` | ✔ |
| `/prospects` | `GET` | `workspace:read` | — | — | — | — |
| `/prospects/select` | `POST` | `prospect:search` | — | — | — | — |
| `/prospects/:id` | `GET` | `workspace:read` | — | — | — | — |
| `/prospects/:id/disqualify` | `POST` | `prospect:search` | — | — | — | — |
| `/prospects/:id/do-not-contact` | `POST` | `prospect:mark_dnc` | — | — | — | — |
| `/prospects/:id/clear-do-not-contact` | `POST` | `prospect:clear_dnc` | — | — | — | — |
| `/prospects/score` | `POST` | `prospect:score` | — | — | — | — |
| `/prospects/:id/scores` | `GET` | `workspace:read` | — | — | — | — |
| `/prospects/:id/scores/explain` | `POST` | `prospect:score` | LLM | — | — | ✔ |
| `/prospects/:id/signals` | `GET` | `workspace:read` | — | — | — | — |
| `/prospects/:id/signals/detect` | `POST` | `prospect:score` | — | — | — | — |
| `/prospects/:id/signals/interpret` | `POST` | `prospect:score` | LLM | — | — | ✔ |
| `/signals/:id/dismiss` | `POST` | `prospect:score` | — | — | — | — |
| `/prospects/:id/decision-makers` | `GET` | `workspace:read` | — | — | — | — |
| `/prospects/:id/decision-makers/search` | `POST` | `contact:enrich` | Apollo | `search_people` | `dmSearches` | ✔ |
| `/prospects/:id/decision-makers` | `POST` | `contact:enrich` | — | — | — | — |
| `/decision-makers/:id/enrich` | `POST` | `contact:enrich` | Apollo | `enrich` | — | ✔ |
| `/decision-makers/:id/do-not-contact` | `POST` | `prospect:mark_dnc` | — | — | — | — |
| `/campaigns` | `POST` | `message:draft` | — | — | — | — |
| `/campaigns` | `GET` | `workspace:read` | — | — | — | — |
| `/campaigns/:id` | `GET` | `workspace:read` | — | — | — | — |
| `/campaigns/:id` | `PATCH` | `message:draft` | — | — | — | — |
| `/campaigns/:id/submit` | `POST` | `message:draft` | — | — | — | — |
| `/campaigns/:id/approve` | `POST` | `campaign:approve` | — | — | — | — |
| `/campaigns/:id/pause` | `POST` | `campaign:approve` | — | — | — | — |
| `/campaigns/:id/resume` | `POST` | `campaign:approve` | — | — | — | — |
| `/campaigns/:id/complete` | `POST` | `campaign:approve` | — | — | — | — |
| `/campaigns/:id/cancel` | `POST` | `campaign:approve` | — | — | — | — |
| `/messages/draft` | `POST` | `message:draft` | LLM | — | `emails` | ✔ |
| `/messages` | `GET` | `workspace:read` | — | — | — | — |
| `/messages/:id` | `GET` | `workspace:read` | — | — | — | — |
| `/messages/:id` | `PATCH` | `message:edit` | — | — | — | — |
| `/messages/:id/approve` | `POST` | `message:approve` | — | — | — | — |
| `/messages/:id/reject` | `POST` | `message:approve` | — | — | — | — |
| `/messages/:id/request-revision` | `POST` | `message:approve` | — | — | — | — |
| `/messages/:id/handoff` | `POST` | `message:handoff` | — | — | — | — |
| `/messages/:id/mark-sent` | `POST` | `message:handoff` | — | — | — | — |
| `/messages/:id/cancel` | `POST` | `message:edit` | — | — | — | — |
| `/activities` | `GET` | `workspace:read` | — | — | — | — |
| `/activities/replies` | `POST` | `activity:log` | LLM | — | — | ✔ |
| `/next-actions` | `GET` | `workspace:read` | best-effort LLM | — | — | — |
| `/next-actions/:id/accept` | `POST` | `nba:act` | — | — | — | — |
| `/next-actions/:id/dismiss` | `POST` | `nba:act` | — | — | — | — |
| `/next-actions/:id/complete` | `POST` | `nba:act` | — | — | — | — |
| `/usage/summary` | `GET` | `workspace:read` | — | — | — | — |
| `/usage/records` | `GET` | `workspace:read` | — | — | — | — |
| `/dashboard` | `GET` | `workspace:read` | — | — | — | — |

---

## 17. Tenant and security rules visible in the contract
- Any path ID belonging to another startup returns `404 NOT_FOUND`, identical to a missing ID.
- Body IDs that reference another startup's records (e.g. `icpId`, `campaignId`, `decisionMakerId`) return `422 VALIDATION_FAILED` with `details.path` (never revealing the other tenant's data).
- Clients cannot send or influence: `startupId`, `role`, `approvalStatus` (except via action endpoints), `approvedBy/At`, `status` (except via action endpoints), spend fields, `criteriaVersion`, `source`, `idempotencyKey`.
- Inactive memberships, disabled users, and expired trials follow `BACKEND_ARCHITECTURE §5.1`.

---

## 18. Frontend integration notes
1. **API Client Wrapper:** Automatically injects `X-Startup-Id` and `X-Requested-With`, unwraps `data`, and throws a typed `ApiError { code, message, details, requestId }`.
2. **Global Error Mapping:** Maps codes per §1.5 (401 → login redirect, `TRIAL_EXPIRED` / `BUDGET_EXHAUSTED` → persistent banner, `CAPABILITY_DISABLED` → fallback UI).
3. **Traceability:** Always display `requestId` on 500 / 502 error toasts to facilitate debugging.
4. **Role Gating:** Disable UI buttons for actions the caller's role cannot perform (while relying on strict server-side authorization).
5. **No Polling:** All endpoints are synchronous request / response; discovery results paginate page-by-page.
6. **Wording Standards:** "Opening your email app" (handoff), "Marked as sent by you" (mark-sent), spend as "approx.", scores as "estimate".

---

## 19. Contract tests (required)
- **Every Endpoint:** Verify success shape, listed error codes, unknown-field rejection (`422`), and malformed ObjectId handling (`400`).
- **Tenant Isolation:** Startup B receives `404` on every `:id` route for Startup A's resources; cross-tenant body references return `422`.
- **RBAC:** Every permission-gated endpoint is tested with `owner`, `admin`, and `member` roles.
- **Capability Gating:** Disabled capability returns `503` without writing a ledger row or reserving budget.
- **Idempotency:** Identical message draft request returns `200` and the existing message ID.
- **Edit After Approve:** Editing an approved message resets status to `pending` / `draft`.
- **Handoff Preconditions:** Blocked when unapproved, DNC, or campaign not approved/active.
- **Pagination Bounds:** Query limit exceeding 100 returns `422`.

---

## 20. Versioning and change policy
- Additive changes (new optional fields, new endpoints) stay in `v1`. Removing or renaming fields, or changing semantics, requires `v2`.
- Clients must ignore unknown response fields.
- Every change updates this file, the Zod validators, and the contract tests in one PR, with a `DECISIONS.md` entry if it changes behaviour.

---

## 21. Open items
1. Freeze the trial spend cap (`TRIAL_SPEND_CAP_PAISE`) before deployment. Numeric values in response examples are illustrative only; config, UI, and tests must use the owner-frozen value.
2. Status code `402` is standard for plan/budget limits.
3. Confirm the invite flow (existing users only) is acceptable for the pilot.
4. After approval: generate `openapi.yaml` from this file and derive Zod validators from it.
5. `AI_SERVICE_DESIGN.md` defines the exact outputs behind `propose`, `draft`, `explain`, `interpret`, and `classify`.