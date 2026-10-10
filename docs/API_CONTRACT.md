# BlueCode OS — API Contract v1.0

**Document:** `API_CONTRACT.md`
**Depends on:** `BACKEND_ARCHITECTURE.md` v2 (modules, permissions, error registry), `DB_ARCHITECTURE.md` + `DB_AMENDMENTS.md` (fields, enums)
**Consumers:** `server/` (validators, controllers, contract tests) and `client/` (API layer, error handling)
**Base path:** `/api/v1`
**Status:** Draft for review. Once approved, backend Zod validators and frontend types are generated from this file; changes here come first.

---

## 1. Conventions

### 1.1 Transport
- JSON only (`Content-Type: application/json`). Max body 100 KB.
- IDs are 24-hex ObjectId **strings**. Dates are ISO-8601 UTC (`2026-10-10T08:30:00.000Z`).
- **Money is integer paise** (INR). Field names end in `Paise`. The UI formats them.
- Field names are `camelCase`. Unknown request fields are **rejected** (`422 VALIDATION_FAILED`).

### 1.2 Required headers

| Header | When | Notes |
|---|---|---|
| `Cookie: bc_session=<jwt>` | All except public routes | httpOnly, set by `/auth/login` |
| `X-Startup-Id: <id>` | All tenant routes | Hint only; server verifies active membership. Not needed for `/auth/*`, `GET /startups`, `POST /startups`, `/health` |
| `X-Requested-With: XMLHttpRequest` | Every non-GET request | CSRF layer; `Origin` must also match the client origin |
| `Content-Type: application/json` | Requests with a body | |

### 1.3 Response envelope

Success:
```json
{ "data": { }, "meta": { "page": 1, "limit": 20, "total": 134 } }
```
`meta` appears only on list endpoints. `204 No Content` has no body.

Error (all errors, no exceptions):
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Human-readable summary",
             "details": [ { "path": "criteria.industries[0]", "issue": "Too long (max 80)" } ],
             "requestId": "7f1c…" } }
```
`details` is present for `VALIDATION_FAILED` and `PLAN_LIMIT_REACHED`; otherwise optional.

### 1.4 Pagination, sorting, filtering
- `?page=1&limit=20` (default 20, max 100). Responses include `meta.total`.
- `?sort=field` ascending, `?sort=-field` descending; allowed sort fields are listed per endpoint.
- Filters are listed per endpoint; an unknown query key returns `422`.

### 1.5 Error registry (HTTP ↔ code)

| HTTP | Code | When | Frontend behaviour |
|---|---|---|---|
| 400 | `MALFORMED_REQUEST` | Bad JSON, malformed ObjectId in path | Show generic error; log |
| 401 | `UNAUTHENTICATED` | No/invalid/expired session; disabled user | Redirect to login |
| 402 | `PLAN_LIMIT_REACHED` | Entitlement exhausted (`details`: metric, used, limit) | Upgrade/limit banner |
| 402 | `BUDGET_EXHAUSTED` | Spend cap would be exceeded | "Usage limit reached" banner; paid actions disabled |
| 402 | `TRIAL_EXPIRED` | Trial over; writes and paid calls blocked | Read-only mode + upgrade prompt |
| 403 | `FORBIDDEN` | Role lacks permission | Hide/disable control; show message |
| 403 | `NOT_A_MEMBER` | No active membership for `X-Startup-Id` | Workspace picker |
| 404 | `NOT_FOUND` | Missing **or in another tenant** | "Not found" page |
| 409 | `CONFLICT` | Duplicate/unique violation | Show message |
| 409 | `INVALID_STATE` | Illegal state transition | Refresh the record, show message |
| 409 | `APPROVAL_REQUIRED` | Message/campaign not approved | Prompt to approve first |
| 409 | `DO_NOT_CONTACT` | Prospect/contact suppressed | Show suppression notice |
| 422 | `VALIDATION_FAILED` | Body/query semantically invalid | Field-level errors from `details` |
| 429 | `RATE_LIMITED` | Request-rate limit (ours or provider's). Has `Retry-After` | Retry after delay |
| 502 | `PROVIDER_FAILED` | Apollo/LLM failed or unusable output | "Try again" with retry |
| 503 | `CAPABILITY_DISABLED` | Provider feature not enabled/verified | Show fallback (e.g. add contact manually) |
| 500 | `INTERNAL` | Unexpected | Generic error with `requestId` |

### 1.6 Rate limits

| Scope | Limit |
|---|---|
| Global per IP | 300 / 15 min |
| `/auth/login`, `/auth/register` | 10 / 15 min per IP |
| Paid endpoints (marked 💰) | 30 / min per startup |

### 1.7 Symbols used below
- 💰 **Paid**: reserves budget and writes a `usageRecords` row (Apollo or LLM). Can return `BUDGET_EXHAUSTED`, `PLAN_LIMIT_REACHED`, `TRIAL_EXPIRED`, `PROVIDER_FAILED`, `RATE_LIMITED`.
- 🔌 **Capability-gated**: returns `503 CAPABILITY_DISABLED` if the Apollo capability is not enabled (checked **before** any budget is reserved).
- 📈 **Entitlement**: counted against plan limits.
- **Perm** = permission key from `BACKEND_ARCHITECTURE §5.2`. All write routes also return `TRIAL_EXPIRED` when the trial is over.

---

## 2. Resource shapes (DTOs)

Responses contain only these fields. `passwordHash`, internal counters, and provider keys are never returned.

```ts
User        { id, name, email, status, createdAt }
Membership  { startupId, startupName, role, status }
Startup     { id, name, plan, status, trialEndsAt?, settings: Settings,
              spend: { capPaise, committedPaise, reservedPaise, remainingPaise },
              createdAt }
Settings    { calendarLink?, senderName?, senderTitle?, productSummary? }
Member      { id, userId, name, email, role, status }

Icp         { id, name, criteria: IcpCriteria, criteriaVersion, isActive,
              createdBy, createdAt, updatedAt }
IcpCriteria { industries?[], countries?[], regions?[], employeeRanges?[], revenueRanges?[],
              technologies?[], companyKeywords?[], excludedIndustries?[], excludedCompanies?[],
              targetJobTitles?[], targetSeniority?[], contactLocations?[] }   // bounded: ≤25 items/array, ≤80 chars/item

Prospect    { id, icpId /*origin ICP, immutable*/, name, domain?, status,
              firmographics: { industry?, employeeCount?, country?, region?, revenueRange?,
                               technologies?[], keywords?[] },
              latestScore?: ScoreSummary,          // for the requested/origin ICP
              createdAt, updatedAt }
ScoreSummary{ icpId, score, category /*hot|high|medium|low*/, coverage /*0–1*/, scoredAt }
LeadScore   { id, prospectId, icpId, score, category, coverage, breakdown: {component: points},
              explanation?, explanationSource /*rules|ai*/, scoringVersion, icpVersion, scoredAt }

Signal      { id, prospectId, decisionMakerId?, signalType, description,
              evidence: [{ field, value }], confidence /*0–1*/, status /*active|stale|dismissed*/,
              detectedAt }
Contact     { id, prospectId, fullName, jobTitle?, businessEmail?, linkedinUrl?,
              emailVerified?, outreachStatus, source /*apollo|manual*/, createdAt }

Campaign    { id, icpId, name, channel /*email*/, status, approvedBy?, approvedAt?, createdBy, createdAt }
Message     { id, campaignId, prospectId, decisionMakerId, step, subject?, body,
              approvalStatus, status, approvedBy?, approvedAt?, sentAt?, createdBy, createdAt, updatedAt }

Activity    { id, prospectId, campaignId?, messageId?, activityType, summary, occurredAt,
              classification?: { intent, confidence }, metadata? }
NextAction  { id, prospectId, decisionMakerId?, actionType, title, reason, priority,
              status, dueAt?, expiresAt?, basedOnActivityIds?[], createdAt }
```

**Enums** are defined in `DB_AMENDMENTS.md §2`. Values marked *(reserved)* there are never returned in the MVP.

---

## 3. Endpoint index

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` |
| Workspace | `POST /startups` · `GET /startups` · `GET /startups/current` · `PATCH /startups/current` · members (4) |
| ICP | `POST /icps/propose` · `POST /icps` · `GET /icps` · `GET /icps/:id` · `PATCH /icps/:id` · `POST /icps/:id/archive` |
| Prospects | `POST /prospects/search` · `GET /prospects` · `GET /prospects/:id` · `POST /prospects/select` · `POST /prospects/:id/disqualify` · DNC (2) |
| Scoring | `POST /prospects/score` · `GET /prospects/:id/scores` · `POST /prospects/:id/scores/explain` |
| Signals | `GET /prospects/:id/signals` · `POST …/signals/detect` · `POST …/signals/interpret` · `POST /signals/:id/dismiss` |
| Contacts | `GET /prospects/:id/decision-makers` · `POST …/search` · `POST …` (manual) · `POST /decision-makers/:id/enrich` · `POST /decision-makers/:id/do-not-contact` |
| Campaigns | `POST /campaigns` · `GET /campaigns` · `GET /campaigns/:id` · `PATCH /campaigns/:id` · state actions (6) |
| Messages | `POST /messages/draft` · `GET /messages` · `GET /messages/:id` · `PATCH /messages/:id` · approval (3) · `handoff` · `mark-sent` · `cancel` |
| Activity | `GET /activities` · `POST /activities/replies` |
| Next actions | `GET /next-actions` · accept / dismiss / complete |
| Usage | `GET /usage/summary` · `GET /usage/records` |
| Dashboard | `GET /dashboard` |

---

## 4. Health and Auth

### `GET /health` — public
`200 { "data": { "status": "ok", "time": "…" } }`

### `POST /auth/register` — public
Request: `{ "name": string(1–80), "email": email, "password": string(10–128) }`
`201 { data: User }` · Errors: `409 CONFLICT` (email exists), `422`, `429`.

### `POST /auth/login` — public
Request: `{ "email", "password" }`
`200 { data: { user: User, memberships: Membership[] } }` and `Set-Cookie: bc_session=…; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`.
Errors: `401 UNAUTHENTICATED` (same response for unknown email and wrong password), `429`.

### `POST /auth/logout`
`204`, clears the cookie.

### `GET /auth/me`
`200 { data: { user: User, memberships: Membership[] } }`. Only `active` memberships are listed.

---

## 5. Workspace

| Method & path | Perm | Notes |
|---|---|---|
| `POST /startups` | any signed-in user | No `X-Startup-Id`. Creates startup + owner membership in a transaction (`plan:trial`, 15-day trial, trial spend cap) |
| `GET /startups` | any signed-in user | My active workspaces |
| `GET /startups/current` | `workspace:read` | Includes `spend` summary |
| `PATCH /startups/current` | `workspace:settings` | Partial update |
| `GET /startups/current/members` | `workspace:read` | |
| `POST /startups/current/members` | `member:invite` | Existing users only (MVP). 📈 `maxUsers` |
| `PATCH /startups/current/members/:memberId` | `member:role` | Cannot demote the last owner (`409 INVALID_STATE`) |
| `DELETE /startups/current/members/:memberId` | `member:role` | Cannot remove the last owner. `204` |

`POST /startups` request: `{ "name": string(1–80) }` → `201 { data: Startup }`
`PATCH /startups/current` request (all optional): `{ "name", "settings": { "calendarLink": url, "senderName", "senderTitle", "productSummary": string(≤1000) } }`
Invite request: `{ "email": email, "role": "admin"|"member" }` → `201 { data: Member }` (`status:'invited'`). A user with no account yet returns `422` ("no account for this email").

---

## 6. ICP

| Method & path | Perm | Flags |
|---|---|---|
| `POST /icps/propose` | `icp:write` | 💰 LLM (`icp_extract`). **Does not save** |
| `POST /icps` | `icp:write` | 📈 `maxIcps`. `criteriaVersion=1` |
| `GET /icps` | `workspace:read` | Filter `isActive`; sort `createdAt` |
| `GET /icps/:id` | `workspace:read` | |
| `PATCH /icps/:id` | `icp:write` | Server increments `criteriaVersion` when `criteria` changes |
| `POST /icps/:id/archive` | `icp:write` | Sets `isActive=false`. `204` |

`POST /icps/propose`
```json
{ "productDescription": "HRMS and payroll software for growing companies", 
  "targetGeography": "United Kingdom", "salesObjective": "10 qualified meetings per month", "notes": "" }
```
`200 { data: { criteria: IcpCriteria, rationale: string } }`. Same entity is never created; the client shows it for editing, then calls `POST /icps`.
Limits: `productDescription` 20–2000 chars.

`POST /icps` → `{ "name": string(1–80), "criteria": IcpCriteria }` → `201 { data: Icp }`
`PATCH /icps/:id` → `{ "name"?, "criteria"? }` (full replacement of `criteria` when present) → `200 { data: Icp }`

---

## 7. Prospects and discovery

| Method & path | Perm | Flags |
|---|---|---|
| `POST /prospects/search` | `prospect:search` | 💰 Apollo · 🔌 `search_orgs` · 📈 `prospects` |
| `GET /prospects` | `workspace:read` | |
| `GET /prospects/:id` | `workspace:read` | |
| `POST /prospects/select` | `prospect:search` | `discovered → qualified`, max 50 ids |
| `POST /prospects/:id/disqualify` | `prospect:search` | |
| `POST /prospects/:id/do-not-contact` | `prospect:mark_dnc` | Also sets all its contacts to DNC |
| `POST /prospects/:id/clear-do-not-contact` | `prospect:clear_dnc` | Reason required; records `status_changed` activity |

### `POST /prospects/search`
```json
{ "icpId": "65f…", "page": 1, "perPage": 25 }
```
`perPage` ≤ 25. One Apollo page per request; the client calls again with `page+1` to load more.
`200`
```json
{ "data": { "created": 18, "existing": 5, "alsoMatchesIcp": 2, "hasMore": true,
            "items": [ Prospect ],
            "spend": { "remainingPaise": 21400 } } }
```
- `created`: new prospects (`icpId` = this ICP, status `discovered`, auto-scored).
- `existing`: already known under the same ICP; firmographics refreshed.
- `alsoMatchesIcp`: already known under a **different** origin ICP; original `icpId` is unchanged and a new score for this ICP was added.
- `items` contains the created and `alsoMatchesIcp` prospects (with `latestScore` for the searched ICP).

Errors: `404` (ICP), `409 INVALID_STATE` (ICP archived), `503 CAPABILITY_DISABLED`, `402`, `502`, `429`.

### `GET /prospects`
Query: `icpId` (origin ICP), `scoredAgainstIcpId`, `status`, `category` (comma list), `minScore`, `q` (name/domain prefix), `includeLow` (default `false`: hides category `low`), `sort` ∈ `score|-score|createdAt|-createdAt|name`, `page`, `limit`.
`score` sorting uses the latest score for `scoredAgainstIcpId` (or origin ICP if omitted).
`200 { data: Prospect[], meta }`

### `GET /prospects/:id`
`200`
```json
{ "data": { "prospect": Prospect,
            "scores": [ { "icpId": "…", "latest": LeadScore } ],
            "signals": [ Signal ],
            "contacts": [ Contact ],
            "recentActivity": [ Activity ] } }
```

### `POST /prospects/select`
`{ "prospectIds": [id…] }` (1–50, duplicates ignored) → `200 { data: { updated: n, skipped: [{ id, reason }] } }`. Each skipped id explains why (e.g. wrong status, `do_not_contact`).

### `POST /prospects/:id/disqualify`  `{ "reason"?: string(≤300) }` → `200 { data: Prospect }`
### `POST /prospects/:id/do-not-contact`  `{ "reason"?: string(≤300) }` → `200 { data: Prospect }`
### `POST /prospects/:id/clear-do-not-contact`  `{ "reason": string(5–300) }` → `200 { data: Prospect }` (returns to `qualified`)

---

## 8. Scoring

| Method & path | Perm | Flags |
|---|---|---|
| `POST /prospects/score` | `prospect:score` | Free (deterministic). Inserts new score rows |
| `GET /prospects/:id/scores` | `workspace:read` | Query `icpId`, `history=true` |
| `POST /prospects/:id/scores/explain` | `prospect:score` | 💰 LLM. Text only; **never changes score/category** |

`POST /prospects/score` → `{ "prospectIds": [..≤50], "icpId": id }` → `200 { data: { scored: n, items: [ScoreSummary + prospectId] } }`
`GET /prospects/:id/scores?icpId=…` → `200 { data: LeadScore }` (latest). With `history=true`: `{ data: LeadScore[], meta }`.
`POST …/scores/explain` → `{ "icpId": id }` → `200 { data: LeadScore }` (same score row with `explanation` and `explanationSource:'ai'`).

**Score semantics (for UI copy):** categories `hot` 90–100, `high` 70–89, `medium` 50–69, `low` <50. If `coverage < 0.5` the UI shows "Limited data" and the category is at most `medium`. Score is a rules-based estimate, not a prediction.

---

## 9. Signals

| Method & path | Perm | Flags |
|---|---|---|
| `GET /prospects/:id/signals` | `workspace:read` | Query `status`. Stale = detected > 45 days ago, returned as `stale` |
| `POST /prospects/:id/signals/detect` | `prospect:score` | Rule-based; free |
| `POST /prospects/:id/signals/interpret` | `prospect:score` | 💰 LLM; interprets existing evidence only |
| `POST /signals/:id/dismiss` | `prospect:score` | Keeps evidence |

`POST …/signals/detect` → `200 { data: { created: n, signals: Signal[], message?: "No signals found in available data" } }`
Every `Signal` has ≥ 1 `evidence` item. `interpret` rejects (`502 PROVIDER_FAILED`) any LLM output referencing evidence not in stored data.

---

## 10. Contacts (decision makers)

| Method & path | Perm | Flags |
|---|---|---|
| `GET /prospects/:id/decision-makers` | `workspace:read` | |
| `POST /prospects/:id/decision-makers/search` | `contact:enrich` | 💰 Apollo · 🔌 `search_people` · 📈 `dmSearches` |
| `POST /prospects/:id/decision-makers` | `contact:enrich` | Manual add; no cost |
| `POST /decision-makers/:id/enrich` | `contact:enrich` | 💰 Apollo · 🔌 `enrich` |
| `POST /decision-makers/:id/do-not-contact` | `prospect:mark_dnc` | |

- **Search** → `200 { data: { created: n, existing: n, items: Contact[] } }`. Saved **without** email.
- **Manual add** → `{ "fullName": string(1–120), "jobTitle"?: string(≤120), "businessEmail": email, "linkedinUrl"?: url }` → `201 { data: Contact }` (`source:'manual'`, `emailVerified:false`). `409 CONFLICT` when the email already exists on this prospect. Blocked for `do_not_contact` prospects (`409 DO_NOT_CONTACT`).
- **Enrich** → `200 { data: Contact }` with `businessEmail`; `emailVerified:true` only when Apollo explicitly reports verification. `409 INVALID_STATE` if already enriched. Prospect must not be DNC.
- If `search_people`/`enrich` are disabled the UI offers manual add (this is the intended fallback).

---

## 11. Campaigns

| Method & path | Perm | Notes |
|---|---|---|
| `POST /campaigns` | `message:draft` | `{ "icpId": id, "name": string(1–80), "channel": "email" }` → `201`. Other channels → `422` |
| `GET /campaigns` | `workspace:read` | Filter `status`; sort `createdAt` |
| `GET /campaigns/:id` | `workspace:read` | Includes message counts by `status` |
| `PATCH /campaigns/:id` | `message:draft` | `{ "name"? }` while `draft` only |
| `POST /campaigns/:id/submit` | `message:draft` | `draft → pending_approval` |
| `POST /campaigns/:id/approve` | `campaign:approve` | `pending_approval → approved`; server sets `approvedBy/At` |
| `POST /campaigns/:id/pause` | `campaign:approve` | `active → paused` |
| `POST /campaigns/:id/resume` | `campaign:approve` | `paused → active` |
| `POST /campaigns/:id/complete` | `campaign:approve` | `active|paused → completed` |
| `POST /campaigns/:id/cancel` | `campaign:approve` | Any non-terminal → `cancelled`; cancels unsent drafts |

All state actions return `200 { data: Campaign }` or `409 INVALID_STATE`.
A campaign becomes `active` automatically the first time one of its messages is handed off.

---

## 12. Messages (draft-first outreach)

| Method & path | Perm | Flags |
|---|---|---|
| `POST /messages/draft` | `message:draft` | 💰 LLM · 📈 `emails` |
| `GET /messages` | `workspace:read` | |
| `GET /messages/:id` | `workspace:read` | |
| `PATCH /messages/:id` | `message:edit` | Resets approval (see below) |
| `POST /messages/:id/approve` | `message:approve` | |
| `POST /messages/:id/reject` | `message:approve` | `{ "reason"?: string(≤300) }` |
| `POST /messages/:id/request-revision` | `message:approve` | `{ "note": string(1–500) }` |
| `POST /messages/:id/handoff` | `message:handoff` | See §12.2 |
| `POST /messages/:id/mark-sent` | `message:handoff` | Founder-reported only |
| `POST /messages/:id/cancel` | `message:edit` | Before handoff only |

### 12.1 Draft, edit, approve

`POST /messages/draft`
```json
{ "campaignId": "…", "decisionMakerId": "…", "step": 1, "regenerate": false }
```
- Preconditions: campaign not terminal; contact belongs to a prospect in this startup; prospect and contact not DNC (`409 DO_NOT_CONTACT`); contact has `businessEmail` (`422`, "add or enrich an email first").
- `201 { data: Message }` for a new draft (`approvalStatus:'pending'`, `status:'draft'`).
- **Idempotent:** the same `(campaignId, decisionMakerId, step)` returns the existing draft with `200`. `regenerate:true` makes a new AI version, only while `approvalStatus != 'approved'`; otherwise `409 INVALID_STATE`.
- The draft never claims facts absent from stored data; if no active signal exists, it does not mention one.

`GET /messages` query: `campaignId`, `prospectId`, `decisionMakerId`, `approvalStatus`, `status`, `sort` ∈ `createdAt|-createdAt`.

`PATCH /messages/:id` → `{ "subject"?: string(1–200), "body"?: string(1–5000) }`
**Rule:** any edit sets `approvalStatus='pending'`, `status='draft'`, and clears `approvedBy/At`. Not allowed once `handed_off` or later (`409 INVALID_STATE`).

`POST /messages/:id/approve` → `200 { data: Message }` with `approvalStatus:'approved'`, `status:'ready'`. Requires subject and body non-empty (`422`), campaign `approved|active` (`409 INVALID_STATE`), prospect/contact not DNC (`409 DO_NOT_CONTACT`).

### 12.2 Handoff and user-reported send

`POST /messages/:id/handoff` — no body.
Re-checks, in order: approved (`409 APPROVAL_REQUIRED`) → status `ready` or `handed_off` (`409 INVALID_STATE`) → campaign `approved|active` (`409 INVALID_STATE`) → prospect/contact not DNC (`409 DO_NOT_CONTACT`) → email present, subject/body non-empty (`422`).
`200`
```json
{ "data": { "message": Message, "handoff": { "to": "sarah@abc.co.uk", "subject": "…", "body": "…" } } }
```
Effect: `ready → handed_off` and a `handoff_requested` activity. **The client builds the `mailto:` link** (falling back to "copy to clipboard" when it exceeds ~2000 chars). The UI says "Opening your email app", never "Sent". Calling it again on a `handed_off` message is allowed and records another activity.

`POST /messages/:id/mark-sent` — optional body `{ "sentAt"?: ISO date (not in future, not before handoff) }`
Only from `handed_off` → `user_reported_sent`; sets `sentAt`; records `message_user_reported_sent` (`metadata.source:'manual'`). The UI labels this "Marked as sent by you". Delivery, opens, and replies are **not** tracked.

---

## 13. Activity and replies

| Method & path | Perm | Flags |
|---|---|---|
| `GET /activities` | `workspace:read` | |
| `POST /activities/replies` | `activity:log` | 💰 LLM (`classify_reply`) |

`GET /activities` query: `prospectId`, `messageId`, `type` (comma list), `from`, `to` (ISO), `sort` ∈ `-occurredAt|occurredAt` (default `-occurredAt`). Append-only; there are no update/delete endpoints.

`POST /activities/replies` — founder pastes a reply they received by email
```json
{ "prospectId": "…", "messageId": "…", "text": "Sounds interesting. Can we talk next Tuesday?" }
```
`messageId` optional; `text` 1–5000 chars. The contact must belong to the prospect.
`201`
```json
{ "data": { "reply": Activity /* reply_logged */,
            "classification": Activity /* reply_classified: classification.intent, confidence */,
            "effects": [ { "type": "next_action_created", "id": "…" } ] } }
```
**Deterministic effects:** `unsubscribe` (also matched by a keyword pre-check, even if the LLM fails) sets prospect and contact to `do_not_contact` and cancels unsent drafts (`effects` includes `{ "type": "do_not_contact_set" }`). Confidence < 0.6 is stored as intent `other` with a `review_prospect` action. If the LLM call fails (`502`), the reply is still stored as `reply_logged` and the response is `201` with `classification: null` and `effects` including any keyword-detected unsubscribe.

---

## 14. Next best actions

| Method & path | Perm | Notes |
|---|---|---|
| `GET /next-actions` | `workspace:read` | Refreshes rule-based actions lazily before reading |
| `POST /next-actions/:id/accept` | `nba:act` | `pending → accepted` |
| `POST /next-actions/:id/dismiss` | `nba:act` | `{ "reason"?: string(≤200) }` |
| `POST /next-actions/:id/complete` | `nba:act` | `accepted|pending → completed` |

`GET /next-actions` query: `status` (default `pending`), `prospectId`, `sort` ∈ `priority` (default: high first, then `dueAt`).
Items past `expiresAt` are returned as `expired`. The refresh uses rules and templated wording only; LLM wording is best-effort and falls back to a template when budget is blocked, so this endpoint never fails with `BUDGET_EXHAUSTED`.
Accepting an action performs **no** outbound operation; it returns `{ data: NextAction, "next": { "route": "/messages/…" } }` as a UI hint only.

---

## 15. Usage and dashboard

### `GET /usage/summary` — `workspace:read`
```json
{ "data": { "plan": "trial", "trialEndsAt": "…", "trialDaysLeft": 11,
            "spend": { "capPaise": 25000, "committedPaise": 3600, "reservedPaise": 0, "remainingPaise": 21400,
                       "costType": "estimated" },
            "entitlements": { "prospects": { "used": 25, "limit": 50 },
                              "dmSearches": { "used": 4, "limit": 30 },
                              "emails": { "used": 3, "limit": 15 },
                              "icps": { "used": 1, "limit": 1 } } } }
```
Costs are estimates unless the provider reports them; the UI labels spend "approx.".

### `GET /usage/records` — `workspace:read`
Query: `provider` (`apollo|llm`), `operation`, `status`, `from`, `to`, `page`, `limit`. `200 { data: UsageRecord[], meta }` where
`UsageRecord { id, provider, operation, status, creditsConsumed?, costPaise?, costType, errorCode?, occurredAt }`.

### `GET /dashboard` — `workspace:read`
```json
{ "data": { "today": { "prospectsFound": 25, "hotAndHigh": 12, "draftsPendingApproval": 4,
                       "readyForHandoff": 6, "followUpsDue": 3 },
            "funnel": { "discovered": 25, "qualified": 12, "contactsWithEmail": 9,
                        "approvedDrafts": 6, "handedOff": 5, "userReportedSent": 3, "repliesLogged": 1 },
            "topActions": [ NextAction ],
            "usage": { "remainingPaise": 21400, "trialDaysLeft": 11 } } }
```
Funnel stages count only events the system actually recorded; there are no delivery/open metrics.

---

## 16. Endpoint-level permission and flag matrix

| Endpoint | Permission | 💰 | 🔌 | 📈 | Writes ledger |
|---|---|:-:|:-:|:-:|:-:|
| `POST /icps/propose` | `icp:write` | LLM | | | ✔ |
| `POST /icps` | `icp:write` | | | icps | |
| `POST /prospects/search` | `prospect:search` | Apollo | `search_orgs` | prospects | ✔ |
| `POST /prospects/score` | `prospect:score` | | | | |
| `POST /prospects/:id/scores/explain` | `prospect:score` | LLM | | | ✔ |
| `POST /prospects/:id/signals/interpret` | `prospect:score` | LLM | | | ✔ |
| `POST /prospects/:id/decision-makers/search` | `contact:enrich` | Apollo | `search_people` | dmSearches | ✔ |
| `POST /decision-makers/:id/enrich` | `contact:enrich` | Apollo | `enrich` | | ✔ |
| `POST /messages/draft` | `message:draft` | LLM | | emails | ✔ |
| `POST /activities/replies` | `activity:log` | LLM | | | ✔ |
| `GET /next-actions` | `workspace:read` | best-effort LLM | | | |
| All other reads | `workspace:read` | | | | |

---

## 17. Tenant and security rules visible in the contract
- Any path ID belonging to another startup returns `404 NOT_FOUND`, identical to a missing ID.
- Body IDs that reference another startup's records (e.g. `icpId`, `campaignId`, `decisionMakerId`) return `422 VALIDATION_FAILED` with `details.path` (never revealing the other tenant's data).
- Clients cannot send or influence: `startupId`, `role`, `approvalStatus` (except via action endpoints), `approvedBy/At`, `status` (except via action endpoints), spend fields, `criteriaVersion`, `source`, `idempotencyKey`.
- Inactive memberships, disabled users, and expired trials follow `BACKEND_ARCHITECTURE §5.1`.

---

## 18. Frontend integration notes
1. One API client wrapper: adds `X-Startup-Id` and `X-Requested-With`, unwraps `data`, and throws a typed `ApiError { code, message, details, requestId }`.
2. A global handler maps codes per §1.5 (401 → login, `TRIAL_EXPIRED`/`BUDGET_EXHAUSTED` → persistent banner, `CAPABILITY_DISABLED` → fallback UI).
3. Always show `requestId` on 500/502 error toasts for support.
4. Disable buttons for actions the user's role cannot perform, but never rely on that for security.
5. Poll nothing: all MVP endpoints are request/response; discovery loads page by page.
6. Wording rules: "Opening your email app" (handoff), "Marked as sent by you" (mark-sent), spend as "approx.", scores as "estimate".

---

## 19. Contract tests (required)
- Every endpoint: success shape, each listed error, unknown-field rejection (`422`), malformed ID (`400`).
- Tenant: Startup B receives `404` on every `:id` route for A's resources; cross-tenant body references return `422`.
- Role: each permission-gated endpoint tested as `owner`, `admin`, `member`.
- Capability: disabled capability returns `503` and writes **no** ledger row and reserves no budget.
- Idempotent draft: same key returns `200` and the same message id.
- Edit-after-approve: message returns to `pending`/`draft`.
- Handoff blocked when unapproved, DNC, or campaign not approved/active.
- Pagination bounds (`limit>100` → `422`).

---

## 20. Versioning and change policy
- Additive changes (new optional fields, new endpoints) stay in `v1`. Removing or renaming fields, or changing semantics, requires `v2`.
- Clients must ignore unknown response fields.
- Every change updates this file, the Zod validators, and the contract tests in one PR, with a `DECISIONS.md` entry if it changes behaviour.

## 21. Open items
1. Confirm status code `402` for plan/budget limits (changing to `429` is a one-line change in §1.5 and the error registry).
2. Confirm the invite flow (existing users only) is acceptable for the pilot.
3. After approval: generate `openapi.yaml` from this file and derive Zod validators from it.
4. `AI_SERVICE_DESIGN.md` must define the exact outputs behind `propose`, `draft`, `explain`, `interpret`, and `classify`.