# BlueCode OS — Backend Architecture (LLD)

**Document:** `BACKEND_ARCHITECTURE.md`
**Depends on:** `DB_ARCHITECTURE.md` (13 collections)
**Feeds:** `API_CONTRACT.md`, `AI_SERVICE_DESIGN.md`, `APOLLO_INTEGRATION.md`
**Runtime:** Node.js 20 LTS · Express · Mongoose · Zod
**Style:** modular monolith, one deployable, no microservices

---

## 1. Scope

This document defines how the Express backend is organized: folder structure, layering rules, middleware pipeline, each module and its service functions, provider layers (Apollo, LLM), state machines, budget enforcement, outbound safety, background work, error handling, and testing.

Out of scope here (own docs): exact request/response bodies (`API_CONTRACT.md`), prompt text and AI JSON schemas (`AI_SERVICE_DESIGN.md`), Apollo field mapping (`APOLLO_INTEGRATION.md`).

---

## 2. Decisions this LLD assumes

These close the open items from the HLD. Change any of them in `DECISIONS.md` and update this doc.

| ID | Decision | Reason | Revisit when |
|---|---|---|---|
| D1 | **Apollo auth for pilot: one server-side key behind `ApolloClient`.** No `integrations` collection yet. The client class takes a `credentialProvider` so OAuth per startup can be added without touching modules. | Fastest path for 15–20 pilot startups. | Before any customer-facing launch. Apollo requires a custom contract to expose its data to non-Apollo users. Confirm terms first. |
| D2 | **Sending = add approved contact to an Apollo sequence.** `mailto:` is a manual fallback and is recorded as `draft_opened`, never `sent`. | Matches DB doc §7.3. | Apollo access lacks sequence permissions. |
| D3 | **No job queue in MVP.** Discovery is synchronous and bounded (one Apollo page, max 25 per request). Activity sync runs on `node-cron` inside the single process. | Avoids Redis/BullMQ and a job collection. | More than one server instance, or syncs exceed a few minutes. |
| D4 | **Money is stored as integer paise (INR).** `apiSpendCap`, spend counters, and `costAmount` are all paise. | Avoids float errors in cap checks. | Multi-currency billing (Stripe phase). |
| D5 | **Trial cap is one value from config** (`TRIAL_SPEND_CAP_PAISE`). Default 25000 (₹250, per the latest plan). | Tech spec says ₹1,000, later plans say ₹250. Config makes it one-line to change. | After pilot cost data. |
| D6 | **Scoring is hybrid:** deterministic firmographic score for every prospect (free), LLM only for explanation, signals, and borderline cases on selected prospects. | Keeps LLM cost inside the cap. | Never; this is a cost principle. |
| D7 | **Auth = JWT in httpOnly cookie** (24 h), no refresh-token table. Revocation works because membership and user status are checked on every request. | No extra collection. | Mobile client or SSO. |
| D8 | **Active startup is sent in header `X-Startup-Id`**, treated as a hint and always verified against an active `startupMembers` record. | Users can belong to many startups. | n/a |

---

## 3. Layering rules

```
Route → Validator → Controller → Service → Repository → Model
                                   └──→ Provider (ApolloClient / AiService)
```

| Layer | Allowed | Forbidden |
|---|---|---|
| **Route** | Wire path, middleware, controller | Logic |
| **Validator** (Zod) | Shape, type, bounds of `body/query/params` | DB access |
| **Controller** | Read validated input and `req.ctx`; call one service; shape the response | Business rules, Mongoose calls |
| **Service** | Business rules, state transitions, orchestration, calling providers and other services | `req`/`res` objects, raw Mongoose queries |
| **Repository** | All Mongoose queries; **always** takes `startupId` | Business rules |
| **Provider** | Talk to Apollo / LLM; map and sanitize output | DB access, tenant logic |

Extra rules:
1. A module may call another module **only through its service** (never its repository or model).
2. Only `providers/*` may import the Apollo or LLM SDK/HTTP client.
3. Services receive an explicit `ctx = { startupId, userId, role, requestId }` as first argument. Never read globals.
4. Controllers never trust `startupId`, `role`, `approvalStatus`, `approvedBy` from `req.body`.

---

## 4. Folder structure

```
server/
├── package.json
├── .env.example
└── src/
    ├── server.js                  # bootstrap: connect DB, start HTTP, start cron
    ├── app.js                     # express app, middleware, route mounting
    │
    ├── config/
    │   ├── env.js                 # Zod-validated env, fails fast on boot
    │   ├── plans.js               # plan → limits table (see §10)
    │   └── constants.js           # all enums (single source of truth)
    │
    ├── models/                    # 13 Mongoose schemas, one file each
    │   ├── User.js  Startup.js  StartupMember.js  Icp.js  Prospect.js
    │   ├── DecisionMaker.js  LeadScore.js  BuyingSignal.js
    │   ├── OutreachCampaign.js  OutreachMessage.js  SalesActivity.js
    │   └── NextBestAction.js  UsageRecord.js
    │
    ├── common/
    │   ├── errors/                # AppError + subclasses, error codes
    │   ├── middleware/            # authenticate, resolveTenant, requireRole,
    │   │                          # validate, usageGuard, rateLimit, errorHandler
    │   ├── repositories/
    │   │   └── TenantRepository.js  # base class that forces startupId
    │   ├── utils/                 # pagination, domain normalizer, ids, clock, hash
    │   └── logger.js              # pino with secret redaction
    │
    ├── modules/
    │   ├── auth/                  # *.routes.js, *.controller.js, *.service.js,
    │   ├── workspace/             # *.validators.js, *.repository.js
    │   ├── icp/
    │   ├── discovery/             # prospects + decision makers
    │   ├── scoring/               # lead scores
    │   ├── signals/               # buying signals
    │   ├── outreach/              # campaigns + messages + send
    │   ├── activity/              # salesActivities + sync + reply handling
    │   ├── nba/                   # next best actions
    │   ├── usage/                 # budget + ledger
    │   └── dashboard/             # read-only aggregations
    │
    ├── providers/
    │   ├── apollo/
    │   │   ├── ApolloClient.js    # HTTP, retries, timeouts, error mapping
    │   │   ├── apollo.mapper.js   # Apollo payload → internal shape
    │   │   ├── apollo.errors.js
    │   │   └── ApolloMock.js      # fixtures for dev/tests (§8.3)
    │   └── ai/
    │       ├── AiService.js       # run(taskName, input) → validated JSON
    │       ├── llmClient.js       # thin wrapper over chosen LLM SDK
    │       ├── tasks/             # one file per task (see §9)
    │       ├── prompts/
    │       └── schemas/           # Zod schema per task output
    │
    ├── jobs/
    │   ├── activitySync.job.js
    │   ├── reconcileUnknownSends.job.js
    │   └── expiry.job.js          # trial expiry, stale signals, stale NBAs
    │
    └── tests/
        ├── unit/  integration/  tenant-isolation/  fixtures/
```

**Module file convention:** `x.routes.js`, `x.validators.js`, `x.controller.js`, `x.service.js`, `x.repository.js`, optional `x.rules.js` (pure functions such as state-transition tables, easy to unit-test).

---

## 5. Request pipeline

Order is fixed. Every protected route uses all steps up to `validate`.

```
1  requestId          assign UUID, attach to logs and response header
2  helmet + cors      CORS limited to the client origin
3  json body limit    100kb
4  pino-http          structured logging, secrets redacted
5  globalRateLimit    per IP
6  authenticate       verify JWT cookie → req.auth.userId; load user; reject if status != active
7  resolveTenant      read X-Startup-Id; find active StartupMember {startupId,userId};
                      load startup; reject if startup.status is suspended/expired
                      → req.ctx = { startupId, userId, role, plan, requestId }
8  requireRole(...)   only on privileged routes
9  validate(schema)   Zod parse; replaces req.body/query/params with parsed values
10 usageGuard(op)     only on routes that cost money (see §10)
11 controller         → service
12 errorHandler       maps AppError → { error: { code, message, details?, requestId } }
```

Public routes (`/auth/register`, `/auth/login`, `/health`) skip steps 6–10 but keep rate limits (stricter on auth).

### 5.1 TenantRepository (enforcing isolation in code)

All repositories extend this class. There is no method that accepts a query without `startupId`.

```js
class TenantRepository {
  constructor(model) { this.model = model; }
  findById(startupId, id)            { return this.model.findOne({ _id: id, startupId }); }
  findOne(startupId, filter)         { return this.model.findOne({ ...filter, startupId }); }
  list(startupId, filter, page)      { /* adds startupId, applies pagination */ }
  create(startupId, data)            { return this.model.create({ ...data, startupId }); }
  updateById(startupId, id, patch)   { return this.model.findOneAndUpdate({ _id: id, startupId }, patch, { new: true }); }
  existsAll(startupId, ids)          { /* count({ _id: {$in: ids}, startupId }) === ids.length */ }
}
```

`existsAll` is the building block for the "same-tenant reference" rule. Services call it (via the owning module's service) before saving any document that references another.

---

## 6. Cross-cutting design

### 6.1 Errors

`AppError(code, httpStatus, message, details?)`. Services throw; only `errorHandler` writes responses.

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Zod failed |
| `UNAUTHENTICATED` | 401 | Missing/invalid JWT |
| `FORBIDDEN_ROLE` | 403 | Role not allowed |
| `NOT_A_MEMBER` | 403 | No active membership for startup |
| `NOT_FOUND` | 404 | Not found **or belongs to another tenant** (never reveal which) |
| `CONFLICT` | 409 | Duplicate / idempotency clash |
| `INVALID_STATE` | 409 | Illegal state transition |
| `DO_NOT_CONTACT` | 409 | Outbound blocked |
| `APPROVAL_REQUIRED` | 409 | Message/campaign not approved |
| `PLAN_LIMIT_REACHED` | 402 | Entitlement exhausted |
| `BUDGET_EXHAUSTED` | 402 | Spend cap would be exceeded |
| `TRIAL_EXPIRED` | 402 | Trial ended |
| `PROVIDER_UNAVAILABLE` | 502 | Apollo/LLM failed after retries |
| `PROVIDER_RATE_LIMITED` | 429 | Provider throttled us |
| `OUTCOME_UNCERTAIN` | 202 | Provider call timed out; reconciliation pending |
| `INTERNAL` | 500 | Unexpected (details only in logs) |

### 6.2 Validation
- Zod schemas live next to the module. Enums come from `config/constants.js`.
- ObjectId params validated with a shared `objectId()` schema.
- Pagination: `?page=1&limit=20` (max 100), response `{ data, page, limit, total }`.

### 6.3 Logging
- `pino`, JSON, one line per request with `requestId`, `userId`, `startupId`.
- Redact: `authorization`, `cookie`, `password*`, `apiKey`, any header or field named `token`.
- Provider errors are logged sanitized (status, code, short message; never headers or bodies containing keys).

### 6.4 Idempotency
- Message sends use `outreachMessages.idempotencyKey` (generated server-side at draft creation: `msg:{campaignId}:{decisionMakerId}:{step}`), unique per startup.
- Mutating endpoints that are safe to retry accept an optional `Idempotency-Key` header; stored in-memory only for 5 minutes for double-click protection, durable idempotency only for sends.

### 6.5 Time
- Inject a `clock` utility so tests can control "now" (expiry, staleness, follow-up delays).

---

## 7. Modules

Each section lists: responsibility, collections, service functions, rules, and route prefix. Exact payloads go in `API_CONTRACT.md`.

### 7.1 `auth`
**Collections:** `users`  **Prefix:** `/api/auth`

| Function | Notes |
|---|---|
| `register({name,email,password})` | Lowercase email; hash with argon2id (or bcrypt cost ≥ 12); status `active` (email verification deferred) |
| `login({email,password})` | Constant-time compare; same error for unknown email and bad password; sets httpOnly, Secure, SameSite=Lax cookie |
| `logout()` | Clears cookie |
| `getMe(ctx)` | User + list of active memberships |

Rules: strict rate limit on login/register (e.g. 10/15 min/IP). CSRF: SameSite=Lax plus require `X-Requested-With` header on mutating requests.

### 7.2 `workspace`
**Collections:** `startups`, `startupMembers`  **Prefix:** `/api/startups`

| Function | Notes |
|---|---|
| `createStartup(userId,{name,...})` | **One transaction:** create startup (`plan:'trial'`, `trialEndsAt = now+15d`, `apiSpendCap = TRIAL_SPEND_CAP_PAISE`) + owner membership. Keeps owner and membership consistent. |
| `listMyStartups(userId)` | Active memberships only |
| `getStartup(ctx)` / `updateSettings(ctx,patch)` | Settings: name, calendar link, sender profile. Role ≥ admin |
| `inviteMember(ctx,{email,role})` | Creates `invited` membership (user must exist in MVP). Role ≥ admin. Enforces plan `maxUsers` |
| `changeMemberRole` / `removeMember` | Cannot demote or remove the last owner |
| `getMembership(userId,startupId)` | Used by `resolveTenant` |
| `assertMember(startupId,userId)` | Used by other services to validate `createdBy`/`approvedBy` |

Roles: `owner > admin > member`. Capability table:

| Action | member | admin | owner |
|---|:-:|:-:|:-:|
| Read workspace data | ✔ | ✔ | ✔ |
| Create ICP, search, score, draft | ✔ | ✔ | ✔ |
| Approve messages / campaigns | ✘ | ✔ | ✔ |
| Manage members, settings | ✘ | ✔ | ✔ |
| Change plan / delete workspace | ✘ | ✘ | ✔ |

(Pilot has 1 user per startup, but code the table now so tests exist.)

### 7.3 `icp`
**Collections:** `icps`  **Prefix:** `/api/icps`

| Function | Notes |
|---|---|
| `extractFromText(ctx,{productDescription,...})` | Calls `AiService.run('icp_extract')`, returns **a proposed** criteria object. Not saved. Usage-recorded |
| `createIcp(ctx,{name,criteria})` | Enforces plan `maxIcps`; validates criteria via Zod (bounded arrays, string lengths); `criteriaVersion=1` |
| `updateIcp(ctx,id,patch)` | If criteria changed: `criteriaVersion += 1` |
| `archiveIcp(ctx,id)` | `isActive=false` (no hard delete) |
| `listIcps` / `getIcp` | |
| `toApolloFilters(icp)` | Pure function, lives in `discovery`, but tested against ICP fixtures |

Rule: the LLM proposes, the founder confirms. The extract endpoint never writes to `icps`.

### 7.4 `discovery` (prospects + decision makers)
**Collections:** `prospects`, `decisionMakers`, (writes `usageRecords`, `salesActivities`, calls `scoring`)
**Prefix:** `/api/prospects`, `/api/decision-makers`

| Function | Notes |
|---|---|
| `searchProspects(ctx,{icpId,page,perPage})` | See flow below |
| `listProspects(ctx,filters)` | Filter by `icpId`, `status`, score category; sort by latest score |
| `getProspect(ctx,id)` | Prospect + latest score + active signals + contacts + recent activity |
| `findDecisionMakers(ctx,prospectId)` | Apollo people search by ICP titles/seniority. Free in Apollo terms but still ledgered; results saved **without** email (not enriched yet) |
| `enrichDecisionMaker(ctx,dmId)` | Paid. Budget reserve → Apollo enrich → update email fields → commit usage |
| `updateProspectStatus(ctx,id,status)` | Via state machine (§11.1). Manual `do_not_contact` allowed for any role |
| `selectProspects(ctx,ids)` | Marks founder's chosen prospects (`qualified`) to gate enrichment and drafting |

**`searchProspects` flow**
1. Load ICP (`icp.getIcp`), verify `isActive`.
2. `usageGuard('apollo.org_search')`: trial not expired, plan limit `aiProspects` not exceeded.
3. `toApolloFilters(icp.criteria)`; drop filters unsupported by the configured Apollo access.
4. `ApolloClient.searchOrganizations(filters, page, perPage≤25)`.
5. Normalize: lowercase domain, strip protocol/path.
6. Dedupe: `bulkWrite` upserts keyed on `{startupId, apolloOrganizationId}`; fallback match on `{startupId, domain}`. Existing records are not duplicated, only refreshed (`updatedAt`, firmographics).
7. For **new** prospects: `status='discovered'`, record `prospect_discovered` activity.
8. `scoring.scoreMany(ctx, newProspectIds)` (deterministic, free).
9. Write `usageRecord`. Return created + skipped counts.

Excluded companies/industries from the ICP are filtered after Apollo returns (Apollo may not support all exclusions).

### 7.5 `scoring`
**Collections:** `leadScores`  **Prefix:** `/api/prospects/:id/scores` (read), score actions under `/api/prospects/score`

| Function | Notes |
|---|---|
| `scoreDeterministic(prospect, icp)` | Pure. Returns `{score, breakdown}` (see below) |
| `scoreMany(ctx, prospectIds)` | Loads prospect+ICP, scores, inserts `leadScores` (never updates old rows) |
| `explainAndRefine(ctx, prospectId)` | LLM on **selected** prospects only: reads firmographics + signals; may adjust score within ±10 and writes `explanation`. Paid, budget-gated |
| `getLatest(ctx, prospectId)` / `getHistory(ctx, prospectId)` | |
| `categoryFor(score)` | Pure; thresholds from tech spec |

**Deterministic score (0–100)**

| Component | Max | Source |
|---|--:|---|
| Industry match | 25 | `prospect.firmographics.industry` vs ICP |
| Employee range match | 20 | employeeCount vs `employeeRanges` |
| Geography match | 15 | country/region vs ICP |
| Technology overlap | 10 | only if Apollo returned tech data, else 0 and **redistributed proportionally** |
| Keyword match | 10 | company keywords |
| Decision-maker availability | 10 | at least one DM with target title exists |
| Active buying signal | 10 | count of active evidence-backed signals (cap) |

Missing data lowers confidence, not the score unfairly: unavailable components are excluded and the total is rescaled. The `breakdown` is stored inside `explanation` text and returned to the UI.

**Categories** (tech spec): `hot` 90–100, `high` 70–89, `medium` 50–69, `low` <50. Prospects `<50` are hidden by default in lists but not deleted.

### 7.6 `signals`
**Collections:** `buyingSignals`  **Prefix:** `/api/prospects/:id/signals`

| Function | Notes |
|---|---|
| `detectFromApolloData(ctx, prospectId)` | **Rule-based first**: e.g. job postings count > 0, headcount growth fields, recent funding fields, only if present in the Apollo payload. Each emits `evidence: [{field,value}]` |
| `analyzeWithAi(ctx, prospectId)` | LLM may *interpret* existing evidence into a description and confidence; it may **not** invent evidence. Backend rejects any signal whose evidence fields are not in the stored Apollo data |
| `dismiss(ctx, signalId)` | `status='dismissed'`, keeps evidence |
| `markStale` (job) | Signals older than N days (default 45) become `stale` |

Hard rule: if no supported evidence exists, store nothing and say so in the UI ("No signals found in available data").

### 7.7 `outreach`
**Collections:** `outreachCampaigns`, `outreachMessages`  **Prefix:** `/api/campaigns`, `/api/messages`

**Campaign functions**

| Function | Notes |
|---|---|
| `createCampaign(ctx,{icpId,name})` | `channel='email'` only; status `draft` |
| `submitForApproval` → `approveCampaign` / `cancelCampaign` | `approve` needs role ≥ admin; sets `approvedBy`, `approvedAt` server-side |
| `linkApolloSequence(ctx,campaignId)` | Creates sequence via Apollo (steps from campaign settings) and stores `apolloSequenceId`. Only after campaign approved |
| `pauseCampaign` / `completeCampaign` | |

**Message functions**

| Function | Notes |
|---|---|
| `draftMessage(ctx,{campaignId,decisionMakerId,step})` | Checks DM belongs to prospect and campaign; blocks `do_not_contact`; requires DM to have an enriched email; AI draft with company + contact + active signal + startup context; saves `approvalStatus='pending'`, `status='draft'` |
| `editMessage(ctx,id,{subject,body})` | Any edit after approval resets `approvalStatus='pending'` |
| `approveMessage` / `rejectMessage` / `requestRevision` | Role ≥ admin. Sets `approvedBy/At` server-side |
| `sendApproved(ctx,messageId)` | See §12. The only function that causes outbound action |
| `listMessages(ctx,filters)` | |

Multi-step sequences (initial + follow-up #1 + follow-up #2): one `outreachMessages` row per step, `step` field (see §16 A6), each approved individually in MVP; the Apollo sequence is created with those step templates.

### 7.8 `activity`
**Collections:** `salesActivities`  **Prefix:** `/api/activities`

| Function | Notes |
|---|---|
| `record(ctx,{type,prospectId,summary,...})` | Append-only. Called by other services via this single function |
| `syncFromApollo(startupId)` | Pulls available sequence/email activity; dedupes on `externalActivityId`; only stores what Apollo returned |
| `handleReply(ctx, activity)` | Runs `AiService.run('classify_reply')` → stores classification on the activity; applies deterministic side effects (below) |
| `listTimeline(ctx,{prospectId,page})` | |

**Reply side effects (deterministic, not LLM-decided):**

| Classification | Effect |
|---|---|
| `interested` / `buying_interest` | Prospect → `replied`; trigger NBA `book_meeting` / `send_reply` |
| `not_now` | Prospect stays; NBA `nurture` with `dueAt` |
| `wrong_person` / `referral` | NBA `review_prospect` |
| `unsubscribe` | Prospect and DM → `do_not_contact`; cancel pending messages. **Always**, regardless of LLM confidence rules |
| `out_of_office` | No status change; NBA `follow_up` after return date if present |
| `objection` | NBA `send_reply` |

If classification confidence is below 0.6, record as `other` and create NBA `review_prospect` (human decides). Unsubscribe keywords are also caught by a regex pre-check so the safety rule does not depend on the LLM.

### 7.9 `nba` (next best actions)
**Collections:** `nextBestActions`  **Prefix:** `/api/next-actions`

| Function | Notes |
|---|---|
| `generateForProspect(ctx,prospectId)` | Rules first (table below); LLM only writes `title` and `reason` wording. Dedupes: no second `pending` action of same type per prospect |
| `generateDaily(startupId)` (job) | No reply after N days → `follow_up`; active new signal on a silent prospect → `review_prospect` |
| `listActions(ctx,{status})` | Sorted by priority then `dueAt` |
| `accept` / `dismiss` / `complete` | Accepting **never** sends anything. It navigates the user to the relevant approval-gated flow |

| Trigger | Action | Priority |
|---|---|---|
| Positive reply | `book_meeting` | high |
| Pricing/info request | `send_reply` | high |
| No reply 3 days after step 1 | `follow_up` | medium |
| No reply after all steps | `nurture` or `stop_outreach` (new signal → review) | low |
| Wrong person / referral | `review_prospect` | medium |

### 7.10 `usage`
**Collections:** `usageRecords` (+ counters on `startups`, see §10)  **Prefix:** `/api/usage`

| Function | Notes |
|---|---|
| `reserve(ctx,{operation,estimatedPaise})` | Atomic; returns `reservationId` or throws `BUDGET_EXHAUSTED` |
| `commit(reservation,{actualPaise?,credits?,status,costType})` | Releases the unused part, writes ledger row |
| `release(reservation,{status,errorCode})` | On failure/blocked |
| `checkEntitlement(ctx,metric)` | Plan limits (prospects, DM searches, emails, ICPs) via aggregation on ledger |
| `getSummary(ctx)` | Spend, remaining cap, entitlement usage, trial days left |
| `withUsage(ctx, op, estimate, fn)` | Helper wrapper that does reserve → run `fn` → commit/release. **All paid calls go through it** |

### 7.11 `dashboard`
Read-only aggregations. **Prefix:** `/api/dashboard`. Single endpoint returning the "Today" strip (prospects found, hot leads, messages ready, follow-ups due, meetings flagged), top 3 NBAs, funnel counts, trial usage. Uses indexed queries with `startupId`; cache for 30 s in memory if slow.

---

## 8. Apollo provider layer

### 8.1 Interface (what modules may call)

```ts
interface SalesDataProvider {
  searchOrganizations(filters, page, perPage): Promise<{ items: OrgDTO[], pagination }>
  searchPeople(filters, page, perPage):        Promise<{ items: PersonDTO[], pagination }>
  enrichPerson({ apolloPersonId | name+domain }): Promise<EnrichedPersonDTO>
  createSequence({ name, steps, schedule }):   Promise<{ sequenceId }>
  addContactToSequence({ sequenceId, contact, idempotencyKey }): Promise<{ ok, externalRef? }>
  listSequenceContacts({ sequenceId, page }):  Promise<ContactStatusDTO[]>   // reconciliation
  fetchActivity({ since, sequenceIds }):       Promise<ActivityDTO[]>
}
```

Modules depend on this interface, not on Apollo naming. That is what makes a second provider possible later.

### 8.2 Behaviour
- Base URL, key via `env`. Key only ever in a request header, never logged.
- Timeout 15 s. Retries: max 2, exponential backoff with jitter, **only** for GET-like searches and 429/5xx. Never auto-retry `addContactToSequence` or `createSequence` (see §12).
- Maps errors to `PROVIDER_RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, or a `ProviderTimeout` that triggers `OUTCOME_UNCERTAIN`.
- Concurrency limiter (e.g. 3 in flight) plus a token bucket matching Apollo's documented limits.
- `apollo.mapper.js` is the only file that knows Apollo's field names. Missing fields map to `undefined`, never to guesses.
- Capability flags in config (`APOLLO_CAPABILITIES=search,enrich,sequences,activity`) let the app degrade gracefully when the account lacks a permission: the feature returns a clear "not available on this Apollo plan" error instead of failing midway.

### 8.3 Mock
`ApolloMock` implements the same interface with fixtures (UK/India HR-software scenario). `APOLLO_MODE=mock|live` env switch. Used for local dev, CI, and demos, and it costs nothing.

---

## 9. AI provider layer

`AiService.run(taskName, input, { ctx })` is the only entry point.

Pipeline per call:
1. Load task definition (`providers/ai/tasks/<task>.js`): prompt template, Zod output schema, model tier, max tokens, estimated cost.
2. `usage.withUsage(...)` reserves budget.
3. Call LLM with JSON output mode / tool schema; temperature low for classification and scoring.
4. Parse and validate against Zod. On failure: one repair retry (send the validation error back). Second failure → `PROVIDER_UNAVAILABLE`-class error, no partial save.
5. Return typed result. Record actual tokens → estimated paise (`costType:'estimated'`).

| Task | Used by | Model tier | Output |
|---|---|---|---|
| `icp_extract` | icp | small | criteria object (matches ICP shape) |
| `score_explain` | scoring | small | `{ adjustment(-10..10), explanation }` |
| `signal_interpret` | signals | small | `[{ signalType, description, confidence, evidenceRefs }]` |
| `draft_message` | outreach | mid | `{ subject, body }` |
| `classify_reply` | activity | small | `{ intent, confidence, returnDate? }` |
| `nba_wording` | nba | small | `{ title, reason }` |

Safety rules:
- Prompts treat prospect/reply text as **untrusted data** (delimited, with instruction not to follow it). Reply text can contain prompt injection.
- LLM output never selects tools or triggers actions; code does.
- Draft prompts forbid claiming facts not in the supplied data. No signal supplied → the draft must not mention one.
- Outputs are length-limited and stripped of URLs not in an allow-list (calendar link from startup settings).
- Prompt text, versions, and full schemas are specified in `AI_SERVICE_DESIGN.md`. Each task has a `version` string stored in `leadScores.scoringVersion` where relevant.

---

## 10. Usage, budget, and plan limits

### 10.1 Atomic spend reservation

Needs two counters on `startups` (see §16 A1): `spendCommitted` and `spendReserved` (integer paise).

```js
// reserve
const res = await Startup.findOneAndUpdate(
  { _id: startupId,
    $expr: { $lte: [ { $add: ['$spendCommitted','$spendReserved', estimate] }, '$apiSpendCap' ] } },
  { $inc: { spendReserved: estimate } },
  { new: true }
);
if (!res) throw new AppError('BUDGET_EXHAUSTED', 402, ...);   // write a 'blocked' usageRecord

// commit(actual)  : $inc { spendReserved: -estimate, spendCommitted: actual }
// release         : $inc { spendReserved: -estimate }
```

Single-document atomic update means concurrent requests cannot jointly exceed the cap. A cleanup job releases reservations older than 10 min (crash safety) by recomputing `spendReserved` from in-flight state; in the single-process MVP, hold in-flight reservations in an in-memory map for this purpose.

### 10.2 Cost estimates
Constants in `config/plans.js` (paise): per-LLM-task estimate, Apollo enrichment estimate per credit. Ledger rows say `costType: 'estimated' | 'reported'`. Never present estimates as exact (UI says "approx.").

### 10.3 Plan table (`config/plans.js`)

| Plan | Cap (paise) | Users | ICPs | Prospects | DM searches | Emails |
|---|--:|--:|--:|--:|--:|--:|
| `trial` | `TRIAL_SPEND_CAP_PAISE` | 1 | 1 | 50 | 30 | 15 |
| `starter` | 100000 | 1 | 1 | 100 | 50 | 100 |
| `growth` | 200000 | 3 | 3 | 500 | 250 | — |
| `pro` | 500000 | 10 | 10 | 2000 | 1000 | — |

Trial numbers follow the ₹250 pilot funnel (50 researched, ~15 messaged). Adjust after pilot data.

### 10.4 `usageGuard(operation)` middleware
Cheap pre-check before the controller: trial not expired, entitlement not exhausted. The authoritative atomic reservation still happens inside the service via `withUsage`. The guard exists only to fail fast with a friendly error.

---

## 11. State machines

Implemented as pure transition tables in `x.rules.js` with `canTransition(from,to)` and unit tests. Services call `assertTransition` and update with a filter on the **current** status (`findOneAndUpdate({_id,startupId,status:from})`) so concurrent changes fail cleanly.

### 11.1 Prospect

```
discovered → qualified → enriched → in_sequence → replied → meeting
     │            │          │           │           │
     └────────────┴──────────┴───────────┴───────────┴──→ disqualified
any state ──→ do_not_contact          (terminal; leaving it needs explicit owner/admin override + activity record)
```

### 11.2 Decision maker `outreachStatus`
`not_contacted → drafted → approved → in_sequence → replied`; any → `do_not_contact` (terminal).

### 11.3 Campaign
```
draft → pending_approval → approved → active ⇄ paused → completed
   └──────────┴──────────────┴────────┴────────────────→ cancelled
```

### 11.4 Message
`approvalStatus`: `pending → approved | rejected | revision_requested`; `revision_requested → pending` after edit.
`status`: `draft → ready → queued → sent → delivered → replied`; `queued → failed | send_unknown`; `send_unknown → queued(sent confirmed) | failed` via reconciliation; `bounced` from sync; any pre-sent → `cancelled`.
`ready` requires `approvalStatus='approved'`.

---

## 12. Outbound send flow (the critical path)

`outreach.sendApproved(ctx, messageId)`:

1. **Authorize:** role ≥ admin (or the approver themselves).
2. **Load** message by `{_id, startupId}`; load campaign, prospect, decision maker (all same startup).
3. **Re-check, in this order, failing with the matching error:**
   - `message.approvalStatus === 'approved'` → else `APPROVAL_REQUIRED`
   - `campaign.status` in `approved|active` and campaign approved → else `INVALID_STATE`
   - prospect and DM not `do_not_contact` → else `DO_NOT_CONTACT`
   - DM has `businessEmail`; email not marked invalid
   - subject non-empty, body non-empty
   - entitlement (emails) and trial not expired
4. **Claim:** `findOneAndUpdate({ _id, startupId, status:'ready' }, { status:'queued' })`. If no document matched, another request already claimed it → return `CONFLICT`.
5. **Ensure sequence:** campaign has `apolloSequenceId` (else `linkApolloSequence`).
6. **Call** `addContactToSequence({ sequenceId, contact, idempotencyKey })` inside `usage.withUsage`.
7. **Outcomes:**
   - Success → record `sequence_added` activity; message stays `queued`; DM/prospect → `in_sequence`. `sent` is set **only** when activity sync confirms Apollo sent it.
   - Definite failure (4xx validation) → `failed`, sanitized `lastError`, release budget.
   - **Timeout / unknown** → `send_unknown`, return `OUTCOME_UNCERTAIN`. **No automatic retry.**
8. **Reconciliation job** (`reconcileUnknownSends`, every 10 min): for each `send_unknown`, `listSequenceContacts` and look for the contact. Found → `queued`, record activity. Not found after 30 min → `failed` and allow the user to retry manually.

`mailto:` fallback: if sequences are unavailable, the UI opens the mail client; the backend records only `draft_opened` (a `status_changed`-type activity with metadata). Status never becomes `sent` without provider confirmation, or an explicit user action "I sent this" recorded as `message_sent` with `metadata.source='manual'`.

---

## 13. Background jobs (node-cron, single instance)

| Job | Schedule | Action |
|---|---|---|
| `activitySync` | every 15 min | For each startup with active campaigns: `activity.syncFromApollo`, then `handleReply` on new replies |
| `reconcileUnknownSends` | every 10 min | See §12 |
| `expiry` | hourly | Mark expired trials (`status='expired'`), mark stale signals, expire old NBAs, release orphan reservations |
| `nbaDaily` | daily 08:00 UTC | `nba.generateDaily` per active startup |

Jobs call services with a synthetic `ctx = { startupId, userId: null, role: 'system' }`. Each job loops startups sequentially and catches per-startup errors so one tenant cannot break the run. Guard against overlap with an in-process "running" flag. **Constraint:** run exactly one server instance until a lock or queue is added (D3).

---

## 14. Security checklist (backend)

- Passwords: argon2id/bcrypt; never returned (`select:false` on `passwordHash`).
- Cookies: httpOnly, Secure, SameSite=Lax.
- `NOT_FOUND` for cross-tenant IDs (no information leak).
- Secrets only via env; `env.js` refuses to boot if missing.
- Zod `.strict()` on request bodies to drop unknown keys (prevents mass assignment of `startupId`, `approvedBy`, etc.).
- Mongo operator injection: strip keys starting with `$` or containing `.` from input (use `express-mongo-sanitize` or Zod strictness).
- Rate limits: global, auth, and per-startup limits on paid endpoints.
- Provider and LLM errors sanitized before storing or returning.
- Reply/prospect text passed to LLM as untrusted data (§9).
- Dependency audit in CI.

---

## 15. Testing plan (backend)

| Type | What | Tool |
|---|---|---|
| Unit | State machines, `categoryFor`, scoring, filter mapping, domain normalizer, budget math | Jest/Vitest |
| Integration | Each module against `mongodb-memory-server` with `ApolloMock` and a fake `AiService` | Supertest |
| **Tenant isolation** | For **every** route that takes an ID: Startup B's user gets `404` for Startup A's resource; list endpoints never return A's rows; cross-tenant references on create/update are rejected | Dedicated suite, generated from the route table |
| Concurrency | 20 parallel `reserve` calls cannot exceed cap; two parallel `sendApproved` calls produce one Apollo call | Integration |
| Safety | Unsent/unapproved message cannot be sent; `do_not_contact` blocked; unsubscribe reply sets DNC even if LLM fails; edit-after-approve resets approval | Integration |
| Provider contract | Mapper tests with recorded Apollo payload samples; AI schema tests with malformed LLM outputs | Unit |

**Definition of done for any module:** routes + validators + service rules + repository with `startupId`, unit tests, integration tests, tenant-isolation tests, entry in `API_CONTRACT.md`.

---

## 16. Required amendments to `DB_ARCHITECTURE.md`

The backend needs these. They are small and keep the 13-collection baseline.

| # | Collection | Change | Why |
|---|---|---|---|
| A1 | `startups` | Add `spendCommitted: number`, `spendReserved: number` (integer paise, default 0). Define `apiSpendCap` as integer paise. Add `settings: { calendarLink?, senderName?, senderTitle?, productSummary? }` | Atomic budget (D4, §10); personalization; meeting links |
| A2 | `leadScores` | Add `hot` to `category` enum | Tech spec has four bands |
| A3 | `salesActivities` | Add `metadata?: object` (bounded) and `classification?: { intent, confidence }` | Reply intent, `source:'manual'`, `draft_opened` |
| A4 | `nextBestActions` | Add `reason: string`, `decisionMakerId?`, `dueAt?`, `expiresAt?` | Explainability; follow-up timing; expiry job |
| A5 | `prospects` | Add `firmographics: { industry?, employeeCount?, country?, region?, revenueRange?, technologies?[], keywords?[] }`, `researchSummary?`, `researchedAt?` | Scoring inputs; survey's top-rated "research" feature |
| A6 | `outreachMessages` | Add `step: number` (default 1), `lastError?: { code, at }`; add `send_unknown` to `status` enum | Multi-step sequences; ambiguous-timeout handling |
| A7 | `usageRecords` | Add `costType: 'estimated'|'reported'`, `errorCode?`, `requestId?`, `entityRef?: { kind, id }` | Distinguish estimates; debugging |
| A8 | `outreachCampaigns` | Add `settings: { steps: [{ dayOffset, templateKind }] }` | Sequence structure |
| A9 | `salesActivities` / enums | Add activity types `draft_opened`, `reply_classified`, `message_queued` | Cover §7.8 and §12 |
| A10 | `prospects` | Add index `{ startupId: 1, status: 1, updatedAt: -1 }` | Dashboard and list queries |

Deferred (unchanged from DB doc): `integrations` (needed when D1 moves to OAuth), `jobs`, `auditLogs`, `replies`.

---

## 17. Build order and milestones

| M | Deliverable | Modules | Exit check |
|--:|---|---|---|
| M1 | Foundation | `config`, `common`, `models`, `auth`, `workspace`, middleware pipeline | Tenant-isolation suite scaffold passes; Startup A/B tests green |
| M2 | ICP | `icp`, `AiService` skeleton, `usage` (reserve/commit) | Text → ICP → saved; budget math tests green |
| M3 | Discovery | `ApolloClient` + `ApolloMock`, `discovery`, dedupe | 25 prospects ingested twice with no duplicates |
| M4 | Qualification | `scoring`, `signals`, DM find + enrich | Scored list with explanations; enrichment blocked at cap |
| M5 | Outreach | `outreach` drafts, approval, campaigns | Draft → approve → ready; edit resets approval |
| M6 | Send + sync | `sendApproved`, reconciliation, `activity` sync | Parallel send test = one Apollo call; unknown outcome handled |
| M7 | Replies + NBA | `handleReply`, `nba`, jobs | Unsubscribe → DNC test; positive reply → `book_meeting` |
| M8 | Dashboard + hardening | `dashboard`, rate limits, logging, audit of checklists | All §14 and §15 items checked |

Frontend work can start after M2 using `ApolloMock` and the API contract.

---

## 18. Open items for the next documents

1. **`API_CONTRACT.md`:** finalize every route above with request/response/error examples. Use one shared envelope and the error codes in §6.1.
2. **`AI_SERVICE_DESIGN.md`:** prompts, schemas, model choice, cost-per-task measurements.
3. **`APOLLO_INTEGRATION.md`:** confirm which endpoints and fields the pilot Apollo account actually exposes (sequence creation, activity retrieval, reply content). §7.8 and §12 depend on this. If reply bodies are not available through the API, reply classification needs an email-inbox integration (Gmail/Outlook) or a manual "paste reply" input for the pilot.
4. **D1 sign-off:** confirm the pilot runs on a single Apollo key and record the licensing risk in `DECISIONS.md`.