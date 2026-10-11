# BlueCode OS — API Documentation (Frozen Frontend Contract)

**Document status:** FROZEN FOR MVP-PREVIEW FRONTEND INTEGRATION  
**Version:** 1.0  
**Snapshot date:** 2026-10-11  
**API prefix:** `/api/v1`  
**Architecture:** Express + TypeScript + Zod + MongoDB/Mongoose, multi-tenant modular monolith

> **Contract rule:** Build the frontend against the endpoints and behaviors documented here. This is an *as-built* contract for the MVP-preview backend, not a wish-list. Do not infer endpoints from `API_CONTRACT.md` or architecture documents when they are absent below. Any endpoint, request/response shape, enum, or permission change requires explicit owner approval, an update to this file first, and a version/change note. No collections or features are added by this contract.

## 1. Environments and transport

- Local API origin: `http://localhost:4000` (use the configured deployment origin outside local development).
- All application routes except `GET /health` use the `/api/v1` prefix.
- JSON request and response bodies. JSON body limit is 100 KB.
- Mongo ObjectIds are exposed as 24-character hex strings. Timestamps are ISO-8601 date-time strings.
- Money is integer paise (INR); divide by 100 for rupees when formatting. Do not hard-code a spend cap or entitlement limit.
- Request body/query schemas reject unknown fields when the endpoint uses a strict Zod schema. Send only the fields documented for that operation.

### Required browser behavior

1. Use `credentials: 'include'` (or Axios `withCredentials: true`) so the browser sends the `bc_session` cookie. Never read, construct, or store the session JWT in frontend JavaScript.
2. Tenant-scoped endpoints require `x-startup-id: <active-workspace-id>`. This header selects a workspace; the server validates the authenticated user's active membership and does not trust the header by itself.
3. Every non-GET request, including public auth POSTs, must be sent from the configured `CLIENT_ORIGIN` and include `X-Requested-With: XMLHttpRequest`. The browser supplies the `Origin` header; the frontend must not try to set it manually.
4. Set `Content-Type: application/json` for requests with JSON bodies. GET requests do not require the CSRF marker.

Suggested frontend API client defaults:

```ts
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:4000';

async function apiRequest<T>(path: string, init: RequestInit = {}, startupId?: string): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body != null) headers.set('Content-Type', 'application/json');
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  if (startupId) headers.set('x-startup-id', startupId);

  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });
  const payload = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new ApiRequestError(response.status, payload);
  return payload as T;
}
```

The `ApiRequestError` implementation is frontend-owned. Keep both the HTTP status and `payload.error.code`; do not rely only on the human-readable message.

## 2. Response envelopes

### Success

Single resource/action:

```json
{ "data": { "id": "..." } }
```

Paginated collection:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0 }
}
```

`meta` shape is endpoint-specific. For instance, next actions report `{ "limit": 100, "total": n }`; activity history is capped at 100 rows and does not currently expose pagination metadata. `204 No Content` has no response body.

### Error

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [{ "path": "name", "issue": "Required" }],
    "requestId": "..."
  }
}
```

`details` is optional and may be a list of validation issues or an operation-specific object. Use `requestId` for support/debugging; never display internal logs or secrets.

| HTTP | Error code(s) | Frontend handling |
|---:|---|---|
| 400 | `MALFORMED_REQUEST` | Treat malformed JSON/ID as a request error; refresh IDs from API data. |
| 401 | `UNAUTHENTICATED` | Clear local authenticated view and route to login. |
| 402 | `PLAN_LIMIT_REACHED`, `TRIAL_EXPIRED`, `BUDGET_EXHAUSTED` | Show the corresponding plan, read-only, or usage-limit state; don't retry automatically. |
| 403 | `FORBIDDEN`, `NOT_A_MEMBER` | Show access/workspace selection state; don't infer permissions from UI state. |
| 404 | `NOT_FOUND` | Treat resource as unavailable; a foreign-tenant resource is intentionally indistinguishable from a missing one. |
| 409 | `CONFLICT`, `INVALID_STATE`, `DO_NOT_CONTACT`, `APPROVAL_REQUIRED` | Refresh current resource and explain the state/suppression/approval conflict. |
| 422 | `VALIDATION_FAILED` | Map `details[].path` to fields when details is an array; otherwise show an operation-level error. |
| 429 | `RATE_LIMITED` | Respect `Retry-After` when present. |
| 502 | `PROVIDER_FAILED` | Provider returned an unusable result; offer a manual fallback where available. |
| 503 | `CAPABILITY_DISABLED` | Feature is intentionally unavailable in this preview; do not loop/retry. |
| 500 | `INTERNAL` | Show a generic failure and retain `requestId` for diagnostics. |

## 3. Implemented endpoint index

All endpoints below are implemented in the current preview source. Permissions are enforced server-side; the frontend may use the workspace's returned `me.permissions` to adjust controls, but that is not an authorization substitute.

| Area | Method | Path | Permission / access | Current behavior |
|---|---|---|---|---|
| Health | GET | `/health` | Public | Health status/time. |
| Auth | POST | `/api/v1/auth/register` | Public, rate-limited | Create user; does not automatically create a workspace. |
| Auth | POST | `/api/v1/auth/login` | Public, rate-limited | Sets `bc_session` cookie; returns user and memberships. |
| Auth | GET | `/api/v1/auth/me` | Authenticated | Returns safe user and memberships. |
| Auth | POST | `/api/v1/auth/logout` | Clears cookie | Returns `204`. |
| Workspace | GET | `/api/v1/startups` | Authenticated | List the user's accessible workspaces. |
| Workspace | POST | `/api/v1/startups` | Authenticated; no tenant header | Creates a workspace and owner membership. |
| Workspace | GET | `/api/v1/startups/current` | `workspace:read`, tenant header | Current workspace, permissions, capability flags and spend summary. |
| ICP | POST | `/api/v1/icps/propose` | `icp:write` | Mock-first proposal; never saves an ICP. Live provider use is gated. |
| ICP | POST | `/api/v1/icps` | `icp:write` | Create ICP. |
| ICP | GET | `/api/v1/icps` | `workspace:read` | List ICPs. |
| ICP | GET | `/api/v1/icps/:id` | `workspace:read` | Get one ICP. |
| ICP | PATCH | `/api/v1/icps/:id` | `icp:write` | Update name and/or criteria. |
| ICP | POST | `/api/v1/icps/:id/archive` | `icp:write` | Archive ICP; returns `204`. |
| Prospects | POST | `/api/v1/prospects/search` | `prospect:search` | **Currently disabled:** returns `503 CAPABILITY_DISABLED` for `search_orgs`. |
| Prospects | GET | `/api/v1/prospects` | `workspace:read` | List/filter known prospects. |
| Prospects | POST | `/api/v1/prospects/select` | `prospect:search` | Select/qualify a batch of known prospects. |
| Prospects | GET | `/api/v1/prospects/:id` | `workspace:read` | Prospect detail plus scores, signals, contacts, recent activity. |
| Prospects | POST | `/api/v1/prospects/:id/disqualify` | `prospect:search` | Disqualify prospect. |
| Prospects | POST | `/api/v1/prospects/:id/do-not-contact` | `prospect:mark_dnc` | Mark prospect and its contacts do-not-contact. |
| Prospects | POST | `/api/v1/prospects/:id/clear-do-not-contact` | `prospect:clear_dnc` | Return prospect to `qualified`; contact-level DNC remains in place. |
| Scoring | POST | `/api/v1/prospects/score` | `prospect:score` | Deterministic score for 1–50 prospects against one ICP. |
| Scoring | GET | `/api/v1/prospects/:id/scores` | `workspace:read` | Latest score or score history. |
| Scoring | POST | `/api/v1/prospects/:id/scores/explain` | `prospect:score` | Mock-only explanation for a previously stored score; numeric scoring fields remain unchanged. |
| Contacts | GET | `/api/v1/prospects/:id/decision-makers` | `workspace:read` | List saved contacts. |
| Contacts | POST | `/api/v1/prospects/:id/decision-makers` | `contact:enrich` | Add a contact manually. |
| Contacts | POST | `/api/v1/prospects/:id/decision-makers/search` | `contact:enrich` | **Currently disabled:** returns `503 CAPABILITY_DISABLED` for `search_people`. |
| Contacts | POST | `/api/v1/decision-makers/:id/enrich` | `contact:enrich` | **Currently disabled:** returns `503 CAPABILITY_DISABLED` for `enrich`. |
| Contacts | POST | `/api/v1/decision-makers/:id/do-not-contact` | `prospect:mark_dnc` | Suppress one contact. |
| Signals | GET | `/api/v1/prospects/:id/signals` | `workspace:read` | List evidence-backed signals. |
| Signals | POST | `/api/v1/prospects/:id/signals/detect` | `prospect:score` | Deterministically detect signals from stored data. |
| Signals | POST | `/api/v1/prospects/:id/signals/interpret` | `prospect:score` | **Currently disabled:** returns `503 CAPABILITY_DISABLED` until AI service/configuration is approved. |
| Signals | POST | `/api/v1/signals/:id/dismiss` | `prospect:score` | Dismiss a signal while retaining its evidence. |
| Campaigns | POST | `/api/v1/campaigns` | `message:draft` | Create email campaign. |
| Campaigns | GET | `/api/v1/campaigns` | `workspace:read` | List campaigns. |
| Campaigns | GET | `/api/v1/campaigns/:id` | `workspace:read` | Get campaign and message counts. |
| Campaigns | PATCH | `/api/v1/campaigns/:id` | `message:draft` | Rename a draft campaign. |
| Campaigns | POST | `/api/v1/campaigns/:id/submit` | `message:draft` | Submit campaign for approval. |
| Campaigns | POST | `/api/v1/campaigns/:id/approve` | `campaign:approve` | Approve campaign. |
| Campaigns | POST | `/api/v1/campaigns/:id/pause` | `campaign:approve` | Pause campaign. |
| Campaigns | POST | `/api/v1/campaigns/:id/resume` | `campaign:approve` | Resume campaign. |
| Campaigns | POST | `/api/v1/campaigns/:id/complete` | `campaign:approve` | Complete campaign. |
| Campaigns | POST | `/api/v1/campaigns/:id/cancel` | `campaign:approve` | Cancel campaign. |
| Messages | POST | `/api/v1/messages/draft` | `message:draft` | Create or return an idempotent draft. |
| Messages | GET | `/api/v1/messages` | `workspace:read` | List/filter messages. |
| Messages | GET | `/api/v1/messages/:id` | `workspace:read` | Get one message. |
| Messages | PATCH | `/api/v1/messages/:id` | `message:edit` | Edit subject/body when state permits. |
| Messages | POST | `/api/v1/messages/:id/approve` | `message:approve` | Approve draft. |
| Messages | POST | `/api/v1/messages/:id/reject` | `message:approve` | Reject draft. |
| Messages | POST | `/api/v1/messages/:id/request-revision` | `message:approve` | Return draft for revision. |
| Messages | POST | `/api/v1/messages/:id/handoff` | `message:handoff` | Record handoff request and return email fields for frontend `mailto:`. Does **not** send email. |
| Messages | POST | `/api/v1/messages/:id/mark-sent` | `message:handoff` | Record the founder's report that they sent it. Does **not** verify sending or delivery. |
| Messages | POST | `/api/v1/messages/:id/cancel` | `message:edit` | Cancel a message before handoff. |
| Activity | GET | `/api/v1/activities` | `workspace:read` | List up to 100 activity records with filters. |
| Activity | POST | `/api/v1/activities/replies` | `activity:log` | Log a founder-pasted reply; no inbox sync. |
| Next actions | GET | `/api/v1/next-actions` | `workspace:read` | List next-best actions; lazily refreshes follow-up candidates. |
| Next actions | POST | `/api/v1/next-actions/:id/accept` | `nba:act` | Accept pending action and return a route hint. Does not execute outreach. |
| Next actions | POST | `/api/v1/next-actions/:id/dismiss` | `nba:act` | Dismiss action. Reason is accepted but not persisted. |
| Next actions | POST | `/api/v1/next-actions/:id/complete` | `nba:act` | Mark action complete. |
| Dashboard | GET | `/api/v1/dashboard` | `workspace:read` | Metrics, funnel snapshot, top actions and usage summary. |
| Usage | GET | `/api/v1/usage/summary` | `workspace:read` | Current spend counters and usage counts. |
| Usage | GET | `/api/v1/usage/records` | `workspace:read` | Filtered, paginated usage ledger. |

## 4. Authentication and workspace contracts

### `POST /api/v1/auth/register`

Request:

```json
{ "name": "Founder Name", "email": "founder@example.com", "password": "at-least-10-characters" }
```

- `name`: 1–80 characters.
- `email`: valid email, maximum 254 characters.
- `password`: 10–128 characters.
- Success: `201 { "data": { "id", "name", "email", "status" } }`.
- Duplicate email: `409 CONFLICT`. Registration does not automatically create a workspace.

### `POST /api/v1/auth/login`

Request: `{ "email": "founder@example.com", "password": "..." }`.

Success: `200 { "data": { "user": { "id", "name", "email" }, "memberships": [...] } }` plus the `bc_session` Set-Cookie response header. Incorrect email/password uses `401 UNAUTHENTICATED`.

### `GET /api/v1/auth/me`

Success: `200 { "data": { "user": { "id", "name", "email", "status", "createdAt" }, "memberships": [...] } }`.

### `POST /api/v1/auth/logout`

Success: `204`; the server clears `bc_session`.

### `GET /api/v1/startups`

Success: `{ "data": { "startups": [{ "startupId", "startupName", "role", "status", "plan", "startupStatus" }] } }`.

### `POST /api/v1/startups`

Request: `{ "name": "Workspace name" }`; `name` is 1–80 characters. Success: `201 { "data": { "id", "name", "plan", "status", "trialEndsAt", "createdAt" } }`. Workspace and owner membership are created transactionally; the spend cap is sourced from server configuration.

### `GET /api/v1/startups/current`

Requires `x-startup-id`. Success shape:

```json
{
  "data": {
    "startup": {
      "id": "...", "name": "...", "plan": "trial", "status": "active",
      "trialEndsAt": "...", "settings": {},
      "spend": { "capPaise": 0, "committedPaise": 0, "reservedPaise": 0, "remainingPaise": 0 },
      "me": { "role": "owner", "permissions": [] },
      "capabilities": { "searchOrgs": false, "searchPeople": false, "enrich": false },
      "createdAt": "..."
    }
  }
}
```

The numeric spend values above are shape examples only, **not configured limits**. Current capability flags are false. The active permission list returned by the API is the UI's source for optional control visibility.

## 5. ICP contracts

### Criteria object

Allowed arrays: `industries`, `countries`, `regions`, `employeeRanges`, `revenueRanges`, `technologies`, `companyKeywords`, `excludedIndustries`, `excludedCompanies`, `targetJobTitles`, `targetSeniority`, `contactLocations`. Each array may contain at most 25 unique strings; each string is 1–80 characters. Unknown criteria keys are rejected.

### `POST /api/v1/icps/propose`

Request:

```json
{
  "productDescription": "HRMS and payroll software for growing companies",
  "targetGeography": "United Kingdom",
  "salesObjective": "10 qualified meetings per month",
  "notes": ""
}
```

`productDescription` is required (20–2000 characters); other fields are optional strings. Successful proposal returns `200 { "data": { "criteria": { ... }, "rationale": "..." } }`. An insufficient-data result can fail with `422 VALIDATION_FAILED` and a `missing` list. The proposal is never persisted as an ICP; frontend must allow review/editing and then call `POST /icps` to save. Mock-mode output is a deterministic demo fixture, **not live AI advice**. Live AI is fail-closed until the adapter, country allowlist, and cost estimate are approved.

### `POST /api/v1/icps`

Request: `{ "name": "ICP name", "criteria": { ... } }`. Success: `201 { "data": Icp }`.

### `GET /api/v1/icps`

Query: `isActive=true|false`, `sort=createdAt|-createdAt`, `page` (default 1), `limit` (default 20, maximum 100). Success: `200 { "data": Icp[], "meta": { "page", "limit", "total" } }`.

### `GET /api/v1/icps/:id`

Success: `200 { "data": Icp }`.

### `PATCH /api/v1/icps/:id`

Request must include at least one of:

```json
{ "name": "Updated name" }
```

or

```json
{ "criteria": { "industries": ["Accounting software"] } }
```

If `criteria` is supplied it is the replacement criteria object, not a partial merge. Success: `200 { "data": Icp }`.

### `POST /api/v1/icps/:id/archive`

No body; success `204`. Archived ICPs cannot be used for new scoring/campaign creation.

`Icp` response fields: `id`, `name`, `criteria`, `criteriaVersion`, `isActive`, `createdBy`, `createdAt`, `updatedAt`.

## 6. Prospect and scoring contracts

### `POST /api/v1/prospects/search` — disabled provider capability

Request schema: `{ "icpId": "<ObjectId>", "page": 1, "perPage": 25 }`, with `page` defaulting to 1 and `perPage` 1–25. The route currently returns `503 CAPABILITY_DISABLED` (`search_orgs`) in this preview. The frontend must not present live discovery as available, seed fake provider results into the production UI, or auto-retry this operation. Existing prospects can be listed and reviewed.

### `GET /api/v1/prospects`

Optional query fields:

- `icpId`: origin ICP filter.
- `scoredAgainstIcpId`: choose which ICP's latest score to use for score filters/sorting.
- `status`: `discovered | qualified | disqualified | do_not_contact`.
- `category`: comma-separated values from `hot,high,medium,low`.
- `minScore`: integer 0–100.
- `q`: name/domain prefix query (1–100 characters).
- `includeLow`: `true|false`, default `false`.
- `sort`: `score|-score|createdAt|-createdAt|name`, default `-createdAt`.
- `page`: default 1; `limit`: default 20, maximum 100.

Success: `200 { "data": Prospect[], "meta": { "page", "limit", "total" } }`.

### `POST /api/v1/prospects/select`

Request: `{ "prospectIds": ["<ObjectId>"] }`; 1–50 IDs. Success: `{ "data": { "updated": 1, "skipped": [{ "id": "...", "reason": "already_qualified" }] } }`. Reasons can include `already_qualified`, `do_not_contact`, `invalid_status`, and `state_changed`. Missing/foreign workspace IDs reject the batch rather than partially applying it.

### `GET /api/v1/prospects/:id`

Success: `{ "data": { "prospect": Prospect, "scores": [{ "icpId", "latest": LeadScore }], "signals": Signal[], "contacts": DecisionMaker[], "recentActivity": Activity[] } }`.

`Prospect` fields include `id`, origin `icpId`, `name`, `status`, optional `apolloOrganizationId`, `domain`, `firmographics`, optional `latestScore`, `createdAt`, `updatedAt`. `prospects.icpId` is the origin ICP and must not be overwritten when a prospect is scored against another ICP.

### `POST /api/v1/prospects/:id/disqualify`

Request: `{ "reason"?: "..." }`, optional maximum 300 characters. Success: `{ "data": Prospect }`.

### `POST /api/v1/prospects/:id/do-not-contact`

Same optional `reason` body. Success: `{ "data": Prospect }`. The prospect and its saved contacts are suppressed.

### `POST /api/v1/prospects/:id/clear-do-not-contact`

Request: `{ "reason": "..." }`; reason is required and 5–300 characters. Success: `{ "data": Prospect }`. Prospect returns to `qualified`; contacts previously marked DNC remain suppressed until individually reviewed.

### `POST /api/v1/prospects/score`

Request: `{ "prospectIds": ["<ObjectId>"], "icpId": "<ObjectId>" }`; 1–50 prospect IDs. Success: `200 { "data": { "scored": n, "items": [...] } }`. Score is deterministic; the API does not let AI alter the numeric score/category.

### `GET /api/v1/prospects/:id/scores`

Query: optional `icpId`, `history=true|false` (default `false`), `page` (default 1), `limit` (default 20, maximum 100). Without `history=true`, returns one latest `LeadScore` for the chosen ICP, or the prospect's origin ICP when `icpId` is omitted. With `history=true`, returns `{ "data": LeadScore[], "meta": { "page", "limit", "total" } }`.

`LeadScore` fields include `id`, `prospectId`, `icpId`, `score`, `category`, `coverage`, `breakdown`, optional `explanation`, `explanationSource`, `scoringVersion`, `icpVersion`, `scoredAt`, `createdAt`. Categories: `hot`, `high`, `medium`, `low`. If `coverage < 0.5`, present the score as limited-data; the score remains an estimate, not a prediction.

### `POST /api/v1/prospects/:id/scores/explain`

**Access:** Authenticated session, active `x-startup-id`, permission `prospect:score`, and normal CSRF headers.

Strict request body (unknown fields rejected): `{ "icpId": "<24-character ObjectId>" }`. The path `:id` is the prospect ID. The prospect, ICP, and score row must belong to the selected tenant; a score row must already exist for that prospect/ICP pair. If it does not, score first using `POST /api/v1/prospects/score`.

**Preview response:** `200 { "data": LeadScore & { "explanationMode": "mock" } }`. The stored explanation starts with `MOCK-ONLY`; the frontend must label it a simulated preview explanation, not live AI analysis. `explanationSource` remains `rules`, because no live model is called.

Frozen behavior:

- The endpoint is mock-only in MVP-Preview. Live LLM mode returns `503 CAPABILITY_DISABLED` until a real adapter and owner-approved estimate are configured.
- Only `leadScores.explanation` and `leadScores.explanationSource` are eligible for update. `score`, `category`, `coverage`, `breakdown`, `scoringVersion`, and `icpVersion` must remain unchanged.
- A saved `MOCK-ONLY` explanation is cached. Repeated requests return the same explanation without writing a second usage row.
- The first successful save records one zero-cost `usageRecords` event with operation `llm.explain_score@1`.
- Cross-tenant or missing prospect/ICP/score returns `404 NOT_FOUND`; unknown request fields return `422 VALIDATION_FAILED`.

## 7. Contacts and buying signals

### `GET /api/v1/prospects/:id/decision-makers`

No body. Success: `{ "data": DecisionMaker[] }`.

DecisionMaker fields: `id`, `prospectId`, `fullName`, optional `jobTitle`, `businessEmail`, `linkedinUrl`, optional `emailVerified`, `source` (`manual` or `apollo`), `outreachStatus`, `createdAt`, `updatedAt`.

### `POST /api/v1/prospects/:id/decision-makers`

Manual contact creation request:

```json
{
  "fullName": "Pat Lee",
  "jobTitle": "CTO",
  "businessEmail": "pat@example.com",
  "linkedinUrl": "https://www.linkedin.com/in/pat"
}
```

`fullName` required (1–120 characters), `businessEmail` required and valid; `jobTitle` optional (max 120); `linkedinUrl` optional HTTP(S) URL (max 300). Success: `201 { "data": DecisionMaker }`. Server sets `source="manual"` and `emailVerified=false`. Duplicate email for the same prospect returns `409 CONFLICT`; DNC prospect returns `409 DO_NOT_CONTACT`.

### `POST /api/v1/prospects/:id/decision-makers/search`

No body; currently `503 CAPABILITY_DISABLED` (`search_people`).

### `POST /api/v1/decision-makers/:id/enrich`

No body; currently `503 CAPABILITY_DISABLED` (`enrich`).

### `POST /api/v1/decision-makers/:id/do-not-contact`

No body; success `200 { "data": DecisionMaker }` after setting that contact's outreach status to DNC.

### `GET /api/v1/prospects/:id/signals`

Optional query `status=active|dismissed|stale`. Success: `{ "data": Signal[] }`. An active signal older than 45 days is returned with derived status `stale`; the record need not be updated to display this derived state.

### `POST /api/v1/prospects/:id/signals/detect`

No body. Success: `{ "data": { "created": n, "signals": Signal[], "message"?: "No new evidence-backed signals found in available data" } }`. Current detector uses evidence already stored (notably recorded technology data); it does not invent funding, growth or buyer intent. Repeated identical evidence is deduplicated.

### `POST /api/v1/prospects/:id/signals/interpret`

No body; currently `503 CAPABILITY_DISABLED` (`signal_interpret`).

### `POST /api/v1/signals/:id/dismiss`

No body; success `200 { "data": Signal }`. Evidence is retained.

`Signal` fields include `id`, `prospectId`, optional `decisionMakerId`, `signalType`, `description`, `evidence`, `confidence`, `status`, `detectedAt`, `createdAt`, `updatedAt`.

## 8. Campaigns and messages

### Campaign DTO

Campaign fields: `id`, `icpId`, `name`, `channel` (`email`), `status`, optional `approvedBy`, `approvedAt`, `createdBy`, `createdAt`, `updatedAt`. `GET /campaigns/:id` also returns `messageCounts`.

Campaign statuses accepted by the list filter: `draft`, `pending_approval`, `approved`, `active`, `paused`, `completed`, `cancelled`.

### `POST /api/v1/campaigns`

Request: `{ "icpId": "<ObjectId>", "name": "Campaign name", "channel": "email" }`; name 1–80 characters. Success `201 { "data": Campaign }`. The ICP must belong to this workspace and be active.

### `GET /api/v1/campaigns`

Optional query: `status`, `sort=createdAt|-createdAt` (default `-createdAt`), `page` (default 1), `limit` (default 20, maximum 100). Success: `200 { "data": Campaign[], "meta": { "page", "limit", "total" } }`.

### `GET /api/v1/campaigns/:id`

Success: `200 { "data": CampaignWithMessageCounts }`.

### `PATCH /api/v1/campaigns/:id`

Request: `{ "name": "Updated name" }`; only draft campaigns can be renamed. Success: `{ "data": Campaign }`.

### Campaign state actions

The following endpoints take an empty JSON object `{}` (send it explicitly if your client attaches a body):

- `POST /api/v1/campaigns/:id/submit` → draft to pending approval.
- `POST /api/v1/campaigns/:id/approve` → approve campaign.
- `POST /api/v1/campaigns/:id/pause`.
- `POST /api/v1/campaigns/:id/resume`.
- `POST /api/v1/campaigns/:id/complete`.
- `POST /api/v1/campaigns/:id/cancel`.

Success response for each: `{ "data": Campaign }`. State transitions are validated server-side; refresh the resource after `409 INVALID_STATE`.

### Message DTO

Message fields: `id`, `campaignId`, `prospectId`, `decisionMakerId`, `step`, `revision`, optional `subject`, `body`, `approvalStatus`, optional `approvedBy`, `approvedAt`, `status`, optional `sentAt`, `createdBy`, `createdAt`, `updatedAt`.

Approval status values: `pending`, `approved`, `rejected`, `revision_requested`. Message status values: `draft`, `ready`, `handed_off`, `user_reported_sent`, `cancelled`.

### `POST /api/v1/messages/draft`

Request:

```json
{
  "campaignId": "<ObjectId>",
  "decisionMakerId": "<ObjectId>",
  "step": 1,
  "regenerate": false
}
```

`step` is integer 1–5, default 1; `regenerate` defaults false. Success: `201 { "data": Message }` when a new draft is created, or `200 { "data": Message }` when the idempotent existing draft is returned. The idempotency key is per workspace/campaign/contact/step. Regeneration is allowed only before approval. The mock drafter is a fixture, not live AI output; live LLM use is gated by approved configuration/estimate.

### `GET /api/v1/messages`

Optional query: `campaignId`, `prospectId`, `decisionMakerId`, `approvalStatus`, `status`, `sort=createdAt|-createdAt` (default `-createdAt`), `page` (default 1), `limit` (default 20, maximum 100). Success: `{ "data": Message[], "meta": { "page", "limit", "total" } }`.

### `GET /api/v1/messages/:id`

Success: `{ "data": Message }`.

### `PATCH /api/v1/messages/:id`

Request accepts one or both fields: `subject` (1–200 characters) and `body` (1–5000 characters). At least one must be present. Success: `{ "data": Message }` when editing is valid for the message state.

### Message review actions

- `POST /api/v1/messages/:id/approve` with `{}` → `{ "data": Message }`.
- `POST /api/v1/messages/:id/reject` with `{ "reason"?: "..." }` (optional, maximum 300 characters).
- `POST /api/v1/messages/:id/request-revision` with `{ "note": "..." }` (required, 1–500 characters).
- `POST /api/v1/messages/:id/cancel` with `{}`.

All return `{ "data": Message }` on success. The schema does not persist rejection reasons or revision notes; the input is validated but not stored. Approval and DNC constraints are server-enforced.

### `POST /api/v1/messages/:id/handoff`

Request body: `{}`. Message must be approved, campaign approved/active, contact not suppressed, and recipient/subject/body present. Success:

```json
{
  "data": {
    "message": { "id": "...", "status": "handed_off" },
    "handoff": { "to": "person@example.com", "subject": "...", "body": "..." }
  }
}
```

The backend records `handoff_requested`. The frontend should construct a `mailto:` URL from `handoff.to`, `handoff.subject`, and `handoff.body` and open it from the user's click. The backend does not send an email and cannot confirm that the mail client opened, the user sent it, or delivery occurred.

### `POST /api/v1/messages/:id/mark-sent`

Request: `{ "sentAt"?: "2026-10-11T10:00:00.000Z" }`; if provided it must include a timezone and cannot be in the future or predate handoff. Success `{ "data": Message }`. This stores a founder-reported send event only; it is not delivery telemetry.

## 9. Activity, reply logging and next-best actions

### `GET /api/v1/activities`

Optional query fields: `prospectId`, `messageId`, `type` (comma-separated; accepted values `prospect_discovered`, `contact_added`, `contact_enriched`, `score_updated`, `signal_detected`, `message_approved`, `handoff_requested`, `message_user_reported_sent`, `reply_logged`, `reply_classified`, `status_changed`, `integration_error`), `from`, `to` (ISO date-time with timezone), `sort=occurredAt|-occurredAt` (default `-occurredAt`). Returns `{ "data": Activity[] }`, limited to 100 records; no pagination parameters are part of the current validator.

Activity fields: `id`, `prospectId`, optional `campaignId`, `messageId`, `activityType`, `summary`, optional `classification`, `metadata`, `occurredAt`, `createdAt`.

### `POST /api/v1/activities/replies`

Request:

```json
{ "prospectId": "<ObjectId>", "messageId": "<ObjectId, optional>", "text": "Founder-pasted reply text" }
```

`text` is required, 1–5000 characters. Success: `201 { "data": { "reply": Activity, "classification": Activity | null, "effects": [] } }`.

Important limits:
- The text is manually supplied by the founder. There is no inbox synchronization or automatic reply detection.
- Only a sanitized excerpt (maximum 500 characters) is persisted in the activity summary; the full submitted reply text is not retained in the current schema.
- In mock mode, classification is a deterministic keyword fixture. With live configuration unavailable, `classification` may be `null` while the reply is still recorded.
- Unsubscribe wording triggers deterministic DNC handling independent of classifier availability and may cancel unsent messages.

### `GET /api/v1/next-actions`

Query: `status=pending|accepted|dismissed|completed|expired` (default `pending`), optional `prospectId`, `sort=priority` (only supported sort). Success: `200 { "data": NextAction[], "meta": { "limit": 100, "total": n } }`. The route accepts no page/limit parameters.

NextAction fields include `id`, `prospectId`, optional `decisionMakerId`, `actionType`, `title`, `reason`, `priority`, `status`, optional `dueAt`, `expiresAt`, `basedOnActivityIds`, `createdAt`, `updatedAt`. Action types: `follow_up`, `send_reply`, `share_information`, `book_meeting`, `nurture`, `stop_outreach`, `review_prospect`; priority: `low|medium|high`.

Listing next actions may lazily generate a follow-up recommendation when an explicit handoff or founder-reported send older than three days is recorded and no later reply exists. It does not schedule, send or automate the follow-up.

- `POST /api/v1/next-actions/:id/accept` with `{}` → `{ "data": NextAction, "next": { "route": "..." } }`.
- `POST /api/v1/next-actions/:id/dismiss` with `{ "reason"?: "..." }` (maximum 200 characters) → `{ "data": NextAction }`.
- `POST /api/v1/next-actions/:id/complete` with `{}` → `{ "data": NextAction }`.

The dismissal `reason` is currently validated but not persisted because the frozen collection has no reason/note field. Accepting an action does not itself execute the recommended action.

## 10. Dashboard and usage

### `GET /api/v1/dashboard`

No query parameters or body. Success: `{ "data": { "today": {...}, "funnel": {...}, "topActions": NextAction[], "usage": { "remainingPaise", "trialDaysLeft" } } }`.

`today` reports `prospectsFound`, `hotAndHigh`, `draftsPendingApproval`, `readyForHandoff`, and `followUpsDue`. `funnel` reports `discovered`, `qualified`, `contactsWithEmail`, `approvedDrafts`, `handedOff`, `userReportedSent`, and `repliesLogged`. Metrics describe recorded backend data only; they do not mean email delivery/open/reply was externally verified.

### `GET /api/v1/usage/summary`

No query parameters or body. Success:

```json
{
  "data": {
    "plan": "trial",
    "trialEndsAt": "...",
    "trialDaysLeft": 0,
    "spend": {
      "capPaise": 0,
      "committedPaise": 0,
      "reservedPaise": 0,
      "remainingPaise": 0,
      "costType": "estimated"
    },
    "entitlements": {
      "prospects": { "used": 0, "limit": null },
      "dmSearches": { "used": 0, "limit": null },
      "emails": { "used": 0, "limit": null },
      "icps": { "used": 0, "limit": null }
    }
  }
}
```

The numbers above are shape placeholders only. The cap comes from the workspace's stored configuration and owner-frozen setting; do not use placeholder numbers as limits. Entitlement limits are currently `null` because the owner has not frozen numeric limits. `trialDaysLeft` may also be `null` for a non-trial plan.

### `GET /api/v1/usage/records`

Optional query fields: `provider=apollo|llm`, `operation` (1–120 characters), `status=success|failed|blocked`, `from`, `to` (date/time values), `page` (default 1), `limit` (default 20, max 100). `from` must be earlier than or equal to `to`.

Success: `200 { "data": UsageRecord[], "meta": { "page", "limit", "total" } }`. Record fields include `id`, `provider`, `operation`, `status`, optional `creditsConsumed`, optional `costPaise`, `costType`, optional `errorCode`, `occurredAt`. Cost is estimated or provider-reported; render according to `costType`, not as a verified invoice amount.

## 11. Deliberately absent or gated capabilities

These are not frontend promises and must not be implemented as if operational in this preview:

- Live Apollo organization discovery (`search_orgs`), people search (`search_people`) and contact enrichment (`enrich`) are disabled until capability and commercial terms are verified.
- Live LLM use, including ICP proposal, message drafting and signal interpretation, remains gated where adapters/approved cost estimates are absent. Mock responses must be visibly treated as demo fixtures, not production AI analysis.
- No server-side email sending, Apollo sequences, delivery/open tracking, inbox synchronization, calendar booking, cron jobs, or automatic follow-up sending.
- No CRUD endpoints for raw activity or next-action creation; these are generated/recorded through implemented workflows.

## 12. Frontend acceptance checklist

- [ ] Central API client uses `credentials: 'include'`, includes `x-startup-id` on tenant routes, and includes `X-Requested-With: XMLHttpRequest` on every non-GET request.
- [ ] Login/logout state is derived from API responses; frontend never handles JWTs directly.
- [ ] On workspace switch, update `x-startup-id` for subsequent tenant requests and reload tenant-scoped data.
- [ ] All list screens use the documented query names and honor each endpoint's actual `meta` shape.
- [ ] Error handling branches on status and `error.code`, particularly `NOT_A_MEMBER`, `INVALID_STATE`, `APPROVAL_REQUIRED`, `DO_NOT_CONTACT`, `PLAN_LIMIT_REACHED`, `TRIAL_EXPIRED`, and `CAPABILITY_DISABLED`.
- [ ] Disabled provider actions show an intentional unavailable state; no optimistic fake Apollo/LLM results are added by the frontend.
- [ ] The email handoff is a user-initiated `mailto:` operation; UI never labels handoff as sent or delivered. `mark-sent` means founder-reported only.
- [ ] No new API calls are introduced without updating and approving this frozen document first.
- [ ] The score-explanation action shows a mock/demo label, handles 404 and 503 safely, and confirms numeric scores/categories remain unchanged.

## 13. Change log

- **v1.0 — 2026-10-11:** Frozen frontend integration reference for the M1–M7 MVP-preview implementation. Records only the implemented route surface and the provider/schema limitations that affect frontend behavior.
