# BlueCode OS — Backend Architecture (LLD) v2.0

**Document:** `BACKEND_ARCHITECTURE.md`
**Depends on:** `DB_ARCHITECTURE.md` + `DB_AMENDMENTS.md` (approved schema = both together)
**Feeds:** `API_CONTRACT.md`, `AI_SERVICE_DESIGN.md`
**Related:** `APOLLO_INTEGRATION.md` (capability matrix), `DECISIONS.md`
**Runtime:** Node.js 20 LTS · Express · Mongoose · Zod · MongoDB (single-node replica set minimum)
**Style:** modular monolith, one deployable, **no scheduled jobs in the MVP**

## 0. What changed from v1

| Review finding | Resolution in v2 |
|---|---|
| P0 sending model contradicts MVP | MVP is **draft-first with `mailto:` handoff**. Sequence creation, enrollment, activity sync, and send reconciliation are removed from the MVP and listed in §18 as deferred |
| P0 Apollo capabilities unverified | Every Apollo operation sits behind a capability flag, **default off until verified** in `APOLLO_INTEGRATION.md` |
| P0 DB/backend mismatch | Schema changes moved to `DB_AMENDMENTS.md` with Adopt/Defer per item. Backend code must match that file, not this one |
| P1 prospect-to-ICP ambiguity | §7.4 defines `prospects.icpId` as the **origin ICP**; scores are per-ICP |
| Repository guardrails | §5.3 rewritten (allowlisted updates, non-overridable `startupId`, ID de-dup) |
| Budget under-specified | §10 rewritten with reserve/commit/release/timeout/crash/reconcile |
| Idempotency/unknown outcomes | Removed with the send path; draft idempotency only |
| Jobs conflict with scope | All four jobs removed. Expiry/staleness computed lazily at read time |
| State machines too broad | §11 uses only states the MVP can observe |
| AI score adjustment | Removed. Score is deterministic. AI only writes the explanation |
| API/error inconsistency | `/api/v1` base path and one error registry (§6.1) |

---

## 1. Scope and MVP execution model

**Execution model: draft-first.**

```
ICP → Apollo discovery → deterministic score → (founder selects)
    → contact find/enrich (capability-gated) → AI draft → founder approval
    → mailto: handoff from the founder's own email client
    → founder logs what happened (sent / reply) → classification → next best action
```

What the backend can and cannot know:

| Event | Observable by backend? | How it is recorded |
|---|---|---|
| Draft created / edited / approved | Yes | Direct |
| Founder clicked "Open in email app" | Yes (request only) | `handoff_requested` activity. Not proof of sending |
| Founder says "I sent it" | Only as a claim | `message_user_reported_sent`, `metadata.source='manual'` |
| Delivery, open, reply | **No** | Never inferred. Founder may paste a reply (`reply_logged`) |

Out of scope here (see §18): Apollo sequences, automatic activity sync, reply retrieval, send reconciliation, calendar integration.

---

## 2. Decisions

| ID | Decision | Status |
|---|---|---|
| D1 | Apollo access for pilot: one server-side key behind a `credentialProvider`. Licensing/commercial use **must be confirmed with Apollo** before any customer-facing launch | Proposed, risk open |
| D2 | **Outbound = `mailto:` handoff only.** No server-side sending | Accepted in v2 (confirm) |
| D3 | No job queue and **no cron jobs**. Time-based rules evaluated lazily | Accepted |
| D4 | Money is integer paise (INR) everywhere | Accepted |
| D5 | Trial cap from config `TRIAL_SPEND_CAP_PAISE`; amount pending owner freeze | Pending owner freeze |
| D6 | Score is deterministic; LLM writes explanation only | Accepted |
| D7 | JWT in httpOnly cookie; membership and user status checked every request | Accepted |
| D8 | MongoDB runs as a **replica set** (single-node is fine) so transactions work | Accepted |
| D9 | API base path `/api/v1`; one error registry | Accepted |
| D10 | One prospect per company per startup; `icpId` = origin ICP | Accepted |

---

## 3. Layering rules

```
Route → Validator → Controller → Service → Repository → Model
                                   └──→ Provider (ApolloClient / AiService)
```

| Layer | Allowed | Forbidden |
|---|---|---|
| Route | Wire path, middleware, controller | Logic |
| Validator (Zod, `.strict()`) | Shape/bounds of body, query, params | DB access |
| Controller | Read validated input and `req.ctx`; call one service; shape response | Business rules, Mongoose |
| Service | Rules, transitions, orchestration, provider calls | `req`/`res`, direct model access |
| Repository | All Mongoose access | Business rules |
| Provider | Apollo / LLM I/O, mapping, sanitizing | DB access, tenant logic |

Rules: modules call other modules **only via their service**; **only repositories import models** (enforced by an ESLint `no-restricted-imports` rule); only `providers/*` talk to Apollo/LLM; services take `ctx = { startupId, userId, role, requestId }` as first argument; never trust `startupId`, `role`, `approvalStatus`, `approvedBy`, or spend fields from clients.

---

## 4. Folder structure

```
server/
├── package.json
├── .env.example
├── scripts/
│   └── reconcileUsage.js          # manual ledger vs counter check (§10.6)
└── src/
    ├── server.js                  # connect DB, boot recovery (§10.5), listen
    ├── app.js                     # express app, middleware, route mounting
    ├── config/
    │   ├── env.js                 # Zod-validated, fails fast
    │   ├── plans.js               # plan → limits
    │   ├── permissions.js         # action → allowed roles (§5.2)
    │   ├── statuses.js            # membership/startup status semantics (§5.1)
    │   └── constants.js           # all enums, single source of truth
    ├── models/                    # 13 schemas
    ├── common/
    │   ├── errors/  middleware/  utils/  logger.js
    │   └── repositories/TenantRepository.js
    ├── modules/
    │   ├── auth/  workspace/  icp/  discovery/  scoring/
    │   ├── signals/  outreach/  activity/  nba/  usage/  dashboard/
    │   └── (each: routes, validators, controller, service, repository, rules)
    ├── providers/
    │   ├── apollo/  ApolloClient.js  apollo.mapper.js  apollo.errors.js  ApolloMock.js  capabilities.js
    │   └── ai/      AiService.js  llmClient.js  tasks/  prompts/  schemas/
    └── tests/  unit/  integration/  tenant-isolation/  concurrency/  fixtures/
```

---

## 5. Request pipeline, tenancy, and permissions

### 5.1 Pipeline (fixed order)

```
1 requestId → 2 helmet+CORS(client origin only) → 3 json limit 100kb → 4 pino-http
5 globalRateLimit → 6 authenticate → 7 resolveTenant → 8 requirePermission(action)
9 validate(Zod) → 10 usageGuard(op)* → 11 controller → 12 errorHandler
```
*only on routes that cost money or consume entitlements.

**Status definitions (single source in `config/statuses.js`)**

| Entity | Status | Allows access? |
|---|---|---|
| `users` | `active` | Yes |
| | `pending_verification`, `disabled` | No (`UNAUTHENTICATED`) |
| `startupMembers` | `active` | Yes |
| | `invited`, `removed` | No (`NOT_A_MEMBER`) |
| `startups` | `active` | Full |
| | `trial_expired` | **Read-only**: GET allowed, anything that writes or costs money returns `TRIAL_EXPIRED` |
| | `suspended` | No access (`FORBIDDEN`) |

Trial expiry is evaluated at `resolveTenant`: if `plan='trial'` and `now > trialEndsAt`, treat as `trial_expired` (and persist the status lazily). No job needed.

**Authentication details**
- JWT HS256, secret ≥ 32 bytes; `JWT_SECRETS` is an ordered list (first signs, all verify) to allow key rotation; `kid` header identifies the key.
- Expiry 24 h; logout clears the cookie. Cookie: httpOnly, Secure, SameSite=Lax.
- CSRF: SameSite=Lax **plus** `Origin` check on all non-GET requests **plus** required `X-Requested-With` header.
- `X-Startup-Id` is a hint; `resolveTenant` must find an `active` membership or fail.

### 5.2 Permission matrix (explicit, not role ordering)

`requirePermission('message:approve')` looks up `config/permissions.js`:

| Permission | owner | admin | member |
|---|:-:|:-:|:-:|
| `workspace:read` | ✔ | ✔ | ✔ |
| `workspace:settings` , `member:invite`, `member:role` | ✔ | ✔ | |
| `workspace:plan`, `workspace:delete` | ✔ | | |
| `icp:write`, `prospect:search`, `prospect:score`, `contact:enrich` | ✔ | ✔ | ✔ |
| `message:draft`, `message:edit` | ✔ | ✔ | ✔ |
| `message:approve`, `campaign:approve` | ✔ | ✔ | |
| `message:handoff` | ✔ | ✔ | |
| `activity:log`, `nba:act` | ✔ | ✔ | ✔ |
| `prospect:mark_dnc` | ✔ | ✔ | ✔ |
| `prospect:clear_dnc` | ✔ | ✔ | |

Roles are data in a table, so a future role is a new column, not a code change. Pilot: one user per startup (the owner), but tests cover all roles.

### 5.3 TenantRepository guardrails

```js
class TenantRepository {
  constructor(model, { updatable, creatable }) { ... }  // field allowlists per repository

  _scope(startupId, q = {}) {
    assertPlainObject(q); assertNoOperatorsOrPaths(q);       // rejects keys starting with $ or containing '.'
    return { ...q, startupId };                              // startupId LAST: caller cannot override it
  }
  findById(startupId, id)          { return Model.findOne(this._scope(startupId, { _id: id })); }
  list(startupId, filter, page)    { /* _scope + pagination */ }
  create(startupId, data)          { return Model.create({ ...pick(data, creatable), startupId }); }
  update(startupId, id, patch)     { return Model.findOneAndUpdate(this._scope(startupId,{_id:id}), { $set: pick(patch, updatable) }, { new:true }); }
  transition(startupId, id, from, patch) { /* findOneAndUpdate with { status: from } in the filter; null → INVALID_STATE */ }
  async existsAll(startupId, ids) {
    const unique = [...new Set(ids.map(String))];
    const n = await Model.countDocuments(this._scope(startupId, { _id: { $in: unique } }));
    return n === unique.length;                              // duplicates in input cannot cause false results
  }
}
```

Rules:
- **Never updatable through generic CRUD:** `startupId`, `_id`, external IDs, `createdBy`, `approvedBy/At`, `approvalStatus`, `status` (use `transition`), `spendCommitted/spendReserved`, `criteriaVersion` (service-managed).
- Aggregations go through repository methods that put `{ $match: { startupId } }` as the **first** stage, before any `$lookup`; the `$lookup` target is also matched on `startupId`.
- `populate()` is not allowed on tenant-owned refs. Load related docs through their own repositories.
- A tenant-isolation test exists **for every repository method and every route that accepts an ID** (§15).

---

## 6. Cross-cutting design

### 6.1 Error registry (single source: `common/errors/codes.js`)

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `MALFORMED_REQUEST` | Bad JSON, malformed ObjectId |
| 401 | `UNAUTHENTICATED` | Missing/invalid token, disabled user |
| 402 | `PLAN_LIMIT_REACHED`, `BUDGET_EXHAUSTED`, `TRIAL_EXPIRED` | Plan/budget exhausted (intentional payment-required semantics) |
| 403 | `FORBIDDEN`, `NOT_A_MEMBER` | Authenticated, not permitted |
| 404 | `NOT_FOUND` | Missing **or in another tenant** (never distinguish) |
| 409 | `CONFLICT`, `INVALID_STATE`, `APPROVAL_REQUIRED`, `DO_NOT_CONTACT` | State/duplicate conflicts |
| 422 | `VALIDATION_FAILED` | Well-formed but semantically invalid (Zod failures, bad cross-references) |
| 429 | `RATE_LIMITED` | **Request-rate** limit only (ours or provider's) |
| 502 | `PROVIDER_FAILED` | Apollo/LLM failed after retries or returned unusable output |
| 503 | `CAPABILITY_DISABLED` | Provider feature not enabled/verified for this deployment |
| 500 | `INTERNAL` | Unexpected; details in logs only |

Envelope: `{ "error": { "code", "message", "details?", "requestId" } }`. Success: `{ "data": ..., "meta?": { page, limit, total } }`.

### 6.2 Validation, logging, time
- Zod `.strict()` on every body; unknown keys rejected, preventing mass assignment. Pagination `?page&limit` (limit ≤ 100).
- pino JSON logs with `requestId/userId/startupId`; redact `authorization`, `cookie`, `password*`, any `*token*`, `*key*`. Provider errors logged as `{status, code, shortMessage}` only.
- Inject a `clock` util; all expiry, staleness, and due-date logic uses it.

### 6.3 Idempotency (MVP scope)
- Drafts: `idempotencyKey = draft:{campaignId}:{decisionMakerId}:{step}`, unique per startup. A repeated draft request returns the existing draft (HTTP 200) unless the client passes `regenerate:true`, which is allowed only while `approvalStatus != 'approved'`.
- No server-side send operation exists, so no send idempotency or reconciliation is needed. Provider-side idempotency is a §18 concern, and it must be verified against Apollo's real semantics, not assumed from a local key.

---

## 7. Modules

Each lists collections, service functions, and rules. Payloads go in `API_CONTRACT.md`. All routes are under `/api/v1`.

### 7.1 `auth` — `users` — `/auth`
`register`, `login` (same error for unknown email/bad password, constant-time compare, argon2id), `logout`, `getMe` (user + active memberships). Strict auth rate limit (10 per 15 min per IP).

### 7.2 `workspace` — `startups`, `startupMembers` — `/startups`
- `createStartup`: **transaction**: startup (`plan:'trial'`, `trialEndsAt=now+15d`, `apiSpendCap=TRIAL_SPEND_CAP_PAISE`, counters 0) + owner membership.
- `listMyStartups`, `getStartup`, `updateSettings` (calendar link, sender name/title, product summary).
- `inviteMember` (existing users only in MVP; enforce `maxUsers`), `changeMemberRole`, `removeMember` (cannot remove/demote last owner).
- `assertMember(startupId, userId)` used by other services to validate `createdBy` / `approvedBy`.

### 7.3 `icp` — `icps` — `/icps`
- `proposeFromText` → `AiService.run('icp_extract')`; returns a proposal, **never saves**.
- `create` (enforces `maxIcps`; `criteriaVersion=1`), `update` (service increments `criteriaVersion` when criteria changed), `archive` (`isActive=false`), `list`, `get`.
- Criteria validated against the bounded Zod shape from `DB_ARCHITECTURE.md §4.4`.

### 7.4 `discovery` — `prospects`, `decisionMakers` — `/prospects`, `/decision-makers`

**ICP ownership model (D10):** one prospect per company per startup. `prospects.icpId` is the **origin ICP** (the ICP that first discovered it) and is never overwritten. Scores are per-ICP via `leadScores.icpId`.

`searchProspects(ctx,{icpId,page,perPage≤25})`:
1. Require capability `search_orgs`, else `CAPABILITY_DISABLED`.
2. Load active ICP; `checkEntitlement('prospects')`; reserve budget (`withUsage`, 0 credits but ledgered).
3. `toApolloFilters(criteria)` (drop unsupported filters; apply `excluded*` after fetch).
4. `ApolloClient.searchOrganizations`; normalize domain; map via `apollo.mapper` (missing fields stay absent).
5. Dedupe per item: match `{startupId, apolloOrganizationId}`, else `{startupId, domain}`.
   - **New:** insert with `icpId = this ICP`, `status='discovered'`, record `prospect_discovered`.
   - **Existing, same ICP:** refresh firmographics only.
   - **Existing, different ICP:** do **not** change `icpId`; count as `alsoMatchesIcp`; score it against this ICP (inserts a `leadScores` row with this `icpId`). The founder sees it as "already in your list".
6. `scoring.scoreMany` (deterministic). Return `{ created, existing, alsoMatchesIcp }`.

Other functions: `listProspects` (filters: `status`, `icpId` = origin, `scoredAgainstIcpId`, category), `getProspect` (+ latest score per ICP, active signals, contacts, recent activity), `selectProspects(ids)` (`discovered → qualified`, bounded batch), `disqualify`, `markDoNotContact`, `clearDoNotContact` (permission-gated, writes `status_changed` activity).

Contacts:
- `findDecisionMakers(prospectId)` — capability `search_people`; saves contacts **without** email; `source='apollo'`.
- `enrichDecisionMaker(dmId)` — capability `enrich`; paid; `withUsage`; sets `businessEmail`; `emailVerified` **only** if Apollo explicitly reports verified.
- `addContactManually(prospectId,{fullName,jobTitle,businessEmail})` — `source='manual'`, `emailVerified=false`. This is the fallback when enrichment is disabled or over budget, and it keeps the `mailto:` flow usable.

### 7.5 `scoring` — `leadScores` — `/prospects/:id/scores`

Deterministic only (D6). Pure function `scoreDeterministic(prospect, icp)`:

| Component | Weight | Input |
|---|--:|---|
| Industry | 25 | `firmographics.industry` vs `criteria.industries` |
| Employee range | 20 | `employeeCount` vs `employeeRanges` |
| Geography | 15 | country/region |
| Technology | 10 | only if Apollo returned tech |
| Keywords | 10 | company keywords |
| Contact availability | 10 | has a contact with a target title |
| Evidence-backed signal | 10 | count of active signals (capped) |

**Intentional missing-data rule:** `available = sum(weights of components whose input exists)`; `score = round(100 × earned / available)`; `coverage = available / 100`. Both are stored. **Guard:** if `coverage < 0.5`, category is capped at `medium` and the UI shows "limited data". Tests must cover: identical evidence on shared fields with different missing fields produces different `coverage`, never silently the same confidence.

Categories: `hot` 90–100, `high` 70–89, `medium` 50–69, `low` <50.

Functions: `scoreMany`, `rescore(prospectId, icpId)` (always inserts a new row), `getLatest(prospectId, icpId?)`, `getHistory`, `explain(prospectId, icpId)` — optional LLM text for **selected** prospects; stored in `explanation` with `explanationSource='ai'`; **cannot change score or category**. Default explanation is rules-generated text from the breakdown (free).

### 7.6 `signals` — `buyingSignals` — `/prospects/:id/signals`
- `detectFromApolloData`: rule-based only, from fields actually present (e.g., job postings, funding fields). Each signal stores `evidence:[{field,value}]`.
- `interpretWithAi` (optional): may describe/assign confidence to **existing** evidence; the backend rejects any item whose `evidenceRefs` are not fields in the stored data.
- `dismiss`. Staleness is **lazy**: a signal with `detectedAt` older than `SIGNAL_STALE_DAYS` (default 45) is returned as `stale` and excluded from scoring; no job rewrites it.
- No evidence → no signal; UI says "No signals found in available data".

### 7.7 `outreach` — `outreachCampaigns`, `outreachMessages` — `/campaigns`, `/messages`

Campaign = a container with approval state (`channel='email'`; `apolloSequenceId` unused in MVP).

| Function | Rules |
|---|---|
| `createCampaign` | `draft` |
| `submitForApproval`, `approveCampaign`, `cancelCampaign`, `pause`, `complete` | Per §11.3; approval permission-gated, `approvedBy/At` set server-side |
| `draftMessage({campaignId,decisionMakerId,step})` | DM belongs to prospect and campaign's startup; neither prospect nor DM is `do_not_contact`; DM has `businessEmail`; AI draft from company + contact + active signals (if none, the prompt forbids mentioning one) + startup settings; `approvalStatus='pending'`, `status='draft'` |
| `editMessage` | Any edit **resets** `approvalStatus='pending'` and `status='draft'`, clears `approvedBy/At` |
| `approveMessage`, `rejectMessage`, `requestRevision` | Approve → `approvalStatus='approved'`, `status='ready'`. Requires campaign `approved|active` |
| `requestHandoff(messageId)` | See §12 |
| `markUserReportedSent(messageId)` | See §12 |
| `cancelMessage` | Pre-handoff only |

### 7.8 `activity` — `salesActivities` — `/activities`
- `record(ctx, event)` is the **only** write path; append-only; allowlisted `metadata` keys per activity type, size-bounded.
- `logReply(ctx,{messageId|prospectId, text})` — founder pastes a reply. Stores `reply_logged`, then classifies.
- `classifyReply` → `AiService.run('classify_reply')` → `reply_classified` activity with `classification{intent,confidence}`.
- `listTimeline(prospectId)`.

**Deterministic side effects of a classified reply** (code decides, not the LLM):

| Intent | Effect |
|---|---|
| `interested`, `buying_interest` | NBA `book_meeting` / `send_reply` (high) |
| `not_now` | NBA `nurture` with `dueAt` |
| `wrong_person`, `referral` | NBA `review_prospect` |
| `objection` | NBA `send_reply` |
| `out_of_office` | NBA `follow_up` (due after return date if given) |
| `unsubscribe` | Prospect and contact → `do_not_contact`; cancel unsent drafts. **Always**, also triggered by a regex pre-check so it never depends on LLM output |
| confidence < 0.6 | Treated as `other`; NBA `review_prospect` |

### 7.9 `nba` — `nextBestActions` — `/next-actions`
- `generateForProspect` runs **rules first**; LLM only phrases `title`/`reason`. No second `pending` action of the same type per prospect.
- Rule triggers: classified reply (table above); handoff or user-reported-sent with no logged reply after `FOLLOWUP_DAYS` (default 3) → `follow_up`; prospect `qualified` with no draft after N days → `review_prospect`.
- **Generation is lazy:** `GET /next-actions` and `GET /dashboard` call `refreshForStartup(ctx)` (bounded, cheap, rules only) before reading. Actions past `expiresAt` are returned as `expired`.
- `accept` / `dismiss` / `complete`. Accepting never performs an outbound action; it only routes the user to the approval-gated flow.

### 7.10 `usage` — `usageRecords` + counters — `/usage`
`reserve`, `commit`, `release`, `checkEntitlement`, `getSummary`, `withUsage(ctx, op, estimate, fn)`. Full spec in §10.

### 7.11 `dashboard` — read-only — `/dashboard`
One endpoint: today strip (prospects found, hot/high leads, drafts pending approval, approved ready for handoff, follow-ups due), top NBAs, funnel counts, usage summary. First `$match` is always `startupId`.

---

## 8. Apollo provider layer

### 8.1 Interface
```ts
interface SalesDataProvider {
  searchOrganizations(filters, page, perPage): Promise<{ items: OrgDTO[], pagination }>
  searchPeople(filters, page, perPage):        Promise<{ items: PersonDTO[], pagination }>
  enrichPerson(ref):                           Promise<EnrichedPersonDTO>
}
// Future (disabled, §18): createSequence, addContactToSequence, fetchActivity
```

### 8.2 Behaviour
- Key in request header only; never logged; `credentialProvider` abstraction (D1).
- Timeout 15 s; GET-style searches retry ≤2 with jittered backoff on 429/5xx; concurrency limit 3; token bucket from verified Apollo limits.
- `apollo.mapper.js` is the only file knowing Apollo field names; absent fields stay absent.
- **Capability flags** in `capabilities.js` from `APOLLO_CAPABILITIES` (e.g. `search_orgs,search_people,enrich`). **Default: none enabled.** A capability is turned on only after its row in `APOLLO_INTEGRATION.md` is marked VERIFIED with test evidence. Calling a disabled capability throws `CAPABILITY_DISABLED` (503) before any budget is reserved.
- `APOLLO_MODE=mock|live`; `ApolloMock` serves fixtures with the same interface, used in dev, CI, and demos.

---

## 9. AI provider layer

`AiService.run(task, input, {ctx})`: load task → `usage.withUsage` → LLM JSON call → Zod validate → one repair retry → return. Second failure → `PROVIDER_FAILED`, nothing saved.

| Task | Used by | Output |
|---|---|---|
| `icp_extract` | icp | criteria proposal |
| `explain_score` | scoring | `{ explanation }` (no numeric change) |
| `signal_interpret` | signals | `[{signalType, description, confidence, evidenceRefs}]` |
| `draft_message` | outreach | `{subject, body}` |
| `classify_reply` | activity | `{intent, confidence, returnDate?}` |
| `nba_wording` | nba | `{title, reason}` |

Safety: prospect and reply text are untrusted data (delimited, never obeyed); LLM output never chooses actions; drafts may not assert facts absent from supplied data; links limited to the startup's calendar link; length-bounded outputs. Prompts and schemas belong in `AI_SERVICE_DESIGN.md`.

---

## 10. Usage, budget, and entitlements

### 10.1 Two different limits
| | Spend cap | Entitlements (prospects, DM searches, ICPs, drafts) |
|---|---|---|
| Nature | Money, **hard** limit | Counts, **soft** limit (may overshoot by in-flight requests, bounded by rate limits) |
| Enforcement | Atomic reservation (§10.2) | `checkEntitlement` counts ledger/entities before the operation |

### 10.2 Atomic reservation
Counters on `startups`: `apiSpendCap`, `spendCommitted`, `spendReserved` (integer paise).

```js
// reserve(estimate) — ONE atomic conditional update; no read-then-write
const s = await Startup.findOneAndUpdate(
  { _id: startupId, status: 'active',
    $expr: { $lte: [ { $add: ['$spendCommitted','$spendReserved', estimate] }, '$apiSpendCap' ] } },
  { $inc: { spendReserved: estimate } }, { new: true });
if (!s) { /* write a 'blocked' ledger row */ throw BUDGET_EXHAUSTED; }
registry.set(reservationId, { startupId, estimate, createdAt });
```

Invariant: `spendCommitted + spendReserved ≤ apiSpendCap` at all times (except documented overrun below).

### 10.3 Reservation lifecycle
| Step | Operation |
|---|---|
| **Identify** | `reservationId = uuid` per `withUsage` call; held in an in-process `ReservationRegistry` (single instance, D3). One reservation ↔ one provider call |
| **Commit** (success) | Remove from registry (claims it; a second commit finds nothing and is a no-op → idempotent). In one **transaction**: `$inc {spendReserved:-estimate, spendCommitted:actual}` + insert ledger row (`status:'success'`, `costType`) |
| **Release** (definite failure, e.g. 4xx, validation, our own error before the call) | Remove from registry; `$inc {spendReserved:-estimate}`; ledger row `failed`/`blocked`, cost 0 |
| **Timeout / unknown outcome** | Provider may have charged. **Commit the estimate** (conservative); ledger `failed`, `errorCode:'PROVIDER_TIMEOUT'`, `costType:'estimated'` |
| **Overrun** (`actual > estimate`) | Commit `actual`; log warning. Bounded because LLM calls set `max_tokens` and Apollo credits per call are known upper bounds |

### 10.4 Estimates
`config/plans.js` holds per-task estimates (paise) and per-credit Apollo estimate. Ledger `costType` is `estimated` unless the provider reports cost. UI labels spend as approximate.

### 10.5 Crash recovery
In-flight reservations live in memory, so after a crash the registry is empty. On boot (single instance): `Startup.updateMany({}, { $set: { spendReserved: 0 } })` and log the count of startups that had `spendReserved > 0`. **Residual risk:** a call in flight at the moment of the crash may have been charged but not committed. Maximum exposure is `concurrency limit × largest estimate` per startup, accepted for the pilot and visible in logs.

### 10.6 Reconciliation
`npm run reconcile:usage` (manual, weekly during pilot): for each startup, compare `spendCommitted` with the sum of ledger `costAmount` where `status in (success, failed)`. Report drift; `--fix` sets the counter from the ledger. A nonzero drift is a bug to investigate.

### 10.7 Tests (required)
- 50 parallel `reserve` calls of a size that fits 10 times: exactly 10 succeed; invariant holds.
- Commit twice with the same `reservationId`: counters change once.
- Timeout path commits the estimate.
- Boot recovery zeroes `spendReserved`.
- Ledger vs counter reconciliation reports zero drift after a mixed run.

---

## 11. State machines (MVP-observable only)

Transition tables live in `*.rules.js`; services use `repository.transition(from → to)`, which filters on the current status so concurrent changes fail with `INVALID_STATE`.

The DB enums stay a superset; **values not listed here are reserved and never written by MVP code** (e.g. `in_sequence`, `replied`, `meeting`, `sent`, `delivered`, `queued`, `bounced`).

### 11.1 Prospect qualification
```
discovered → qualified → disqualified
any → do_not_contact   (leaving DNC needs prospect:clear_dnc + status_changed activity)
disqualified → qualified (re-open allowed)
```
### 11.2 Contact `outreachStatus`
`not_contacted → drafted → approved`; any → `do_not_contact`. (`approved` means an approved draft exists; it says nothing about delivery.)

### 11.3 Campaign
```
draft → pending_approval → approved → active ⇄ paused → completed
 any non-terminal → cancelled
```
### 11.4 Message — two independent fields
`approvalStatus`: `pending → approved | rejected | revision_requested`; `revision_requested → pending` after edit; **edit after approval → pending**.

`status`: `draft → ready → handed_off → user_reported_sent`; `draft|ready → cancelled`.
`ready` requires `approvalStatus='approved'`. `handed_off` means "the founder requested the email-client handoff", **not** that anything was sent. Provider-confirmed states are reserved for §18.

**Separation of concerns:** prospect state never depends on email events; message state never represents a provider enrollment.

---

## 12. Handoff flow

`requestHandoff(ctx, messageId)` (permission `message:handoff`):
1. Load message by `{_id, startupId}`; load campaign, prospect, contact via their repositories.
2. Re-check in order, failing with the named error: `approvalStatus==='approved'` (`APPROVAL_REQUIRED`) → message `status==='ready'` or `handed_off` (`INVALID_STATE`) → campaign `approved|active` (`INVALID_STATE`) → prospect and contact not `do_not_contact` (`DO_NOT_CONTACT`) → `businessEmail` present → subject and body non-empty.
3. Transition `ready → handed_off` (re-handoff of an already `handed_off` message is allowed and just records another activity).
4. Record `handoff_requested` activity (metadata: `{source:'mailto'}`).
5. Return `{ to, subject, body }`. The **client** builds `mailto:` (and falls back to copy-to-clipboard when the URL is too long). The UI must say "Opening your email app" and never "Sent".

`markUserReportedSent(ctx, messageId)`: only from `handed_off`; sets `status='user_reported_sent'`, `sentAt=now`; records `message_user_reported_sent` with `metadata.source='manual'`; sets contact `outreachStatus` unchanged. The UI labels these "marked as sent by you".

Never inferred: delivery, open, reply, bounce.

---

## 13. Scheduled work: none in the MVP

| v1 job | v2 approach |
|---|---|
| Trial expiry | Evaluated in `resolveTenant` |
| Stale signals / expired NBAs | Computed at read time |
| Daily NBA | `refreshForStartup` on NBA/dashboard read |
| Activity sync, send reconciliation | Deferred (§18) |
| Orphan reservations | Boot recovery (§10.5) |

If scheduled work is added later, define distributed locking or durable scheduling before running more than one process.

---

## 14. Security checklist
- argon2id hashes, `select:false` on `passwordHash`; JWT rotation list; CSRF layers (§5.1).
- `NOT_FOUND` for cross-tenant IDs; no `populate()` on tenant refs; allowlisted updates (§5.3).
- Secrets via env only; `env.js` refuses to boot if missing.
- Zod `.strict()` bodies; Mongo operator/path rejection in query builders.
- Rate limits: global, auth, per-startup on paid endpoints.
- Provider/LLM errors sanitized; prompt-injection handling (§9).
- Dependency audit in CI.

---

## 15. Testing plan

| Suite | Must include |
|---|---|
| Unit | State tables, `categoryFor`, scoring incl. coverage cap, filter mapping, domain normalizer, permission matrix, `existsAll` with duplicate IDs |
| Tenant isolation | Generated from the route table: Startup B gets `404` on A's IDs; list endpoints return no A rows; **cross-tenant references rejected on every create/update**; every repository method scoped; aggregation first stage is `startupId`; inactive/invited/removed members blocked |
| Auth | Expired token, rotated key, disabled user, cookie cleared on logout, missing `Origin`/`X-Requested-With` rejected |
| Budget | §10.7 |
| Safety | Unapproved message cannot hand off; DNC prospect/contact blocked; **edit after approval resets approval and `ready` status**; unsubscribe reply → DNC even when LLM fails; do-not-contact clearing needs permission |
| Discovery | Re-running the same search creates no duplicates; same company under a second ICP keeps original `icpId` and adds a second-ICP score |
| Provider | Mapper tests with recorded payloads; disabled capability returns 503 **before** reserving budget; malformed LLM output rejected |

Definition of done per module: routes, validators, service rules, repository with allowlists, unit + integration + tenant tests, entry in `API_CONTRACT.md`.

---

## 16. Schema reference

All schema changes live in **`DB_AMENDMENTS.md`** (Adopt/Defer per item). This document does not define fields. If code needs a field not approved there, the amendment is made first.

---

## 17. Build order

| M | Deliverable | Exit check |
|--:|---|---|
| M1 | Foundation: env, models, auth, workspace, pipeline, permissions, tenant repo, logging | Tenant-isolation suite scaffold and auth tests green |
| M2 | ICP + usage controls: ICP CRUD/versioning, `proposeFromText`, reservation/commit/release, entitlements | §10.7 tests green |
| M3 | Apollo discovery (mock first; live only for VERIFIED capabilities): search, mapping, dedupe, ledger | Re-run creates no duplicates; multi-ICP rule tested |
| M4 | Qualification: deterministic scoring, contacts (find/enrich/manual), signals | Scored list with breakdown and coverage; enrichment blocked at cap |
| M5 | Draft-first outreach: campaigns, drafts, edit-resets-approval, approval, DNC checks, handoff, user-reported-sent | Safety suite green |
| M6 | Activity, reply logging/classification, lazy NBA, dashboard | Unsubscribe → DNC; positive reply → `book_meeting` |
| M7 | Hardening: concurrency, cross-tenant negative tests, redaction, timeout handling, audit §14 | All checklists done |

Frontend can begin after M2 against `ApolloMock`.

---

## 18. Deferred: future execution design (separate doc, after verification)

Not built in the MVP; requires verified Apollo permissions and commercial approval: Apollo sequence creation and enrollment; automatic activity/reply retrieval; message states `queued/sent/delivered/replied/bounced`; send reconciliation and `send_unknown`; provider-side idempotency design (based on Apollo's real semantics); campaign step settings; background scheduling and locking; customer OAuth with an `integrations` collection; calendar integration.

---

## 19. Open items
1. Confirm D2 (mailto-only MVP). Note the tech spec lists Apollo sequences and auto-scheduling as Phase 1, so this narrows scope.
2. Complete the capability matrix in `APOLLO_INTEGRATION.md` and get Apollo's written answer on commercial use (D1).
3. Approve `DB_AMENDMENTS.md`.
4. Then write `API_CONTRACT.md` using §6.1 and `/api/v1`.