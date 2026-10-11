# BlueCode OS — Security and Testing Plan

**Document:** `SECURITY_AND_TESTING.md`
**Version:** 1.0 (draft for review)
**Depends on:** `DB_ARCHITECTURE.md`, `BACKEND_ARCHITECTURE.md`, `API_CONTRACT.md`, `AI_SERVICE_DESIGN.md`, `FRONTEND_ARCHITECTURE.md`
**Purpose:** one place that states what must be protected, how it is protected, and which tests prove it. Every item has an ID so it can be tracked as an issue and checked at release.
**Not legal advice.** Privacy and email-compliance items below are engineering checklists; get your own legal review for the countries you target.

---

## 1. What we protect

| Asset | Why it matters |
|---|---|
| Tenant data: ICPs, prospects, contacts (names, business emails, LinkedIn URLs), scores, drafts, pasted replies, activity | Customers' sales pipeline and third-party personal data. A cross-tenant leak is the worst failure. |
| User credentials and sessions | Account takeover exposes the above. |
| Provider keys (Apollo, LLM) | Theft means unbounded cost and a license breach. |
| Spend cap integrity | The cap is the product's cost control. |
| Approval integrity | Human approval before any handoff is a core promise. |
| Honest records | The product must never claim a send, delivery, or reply it did not observe. |

### 1.1 Trust boundaries
Browser ↔ API (untrusted client) · API ↔ MongoDB · API ↔ Apollo · API ↔ LLM provider. **Untrusted input:** all request data; Apollo-returned text; prospect/company text; pasted replies; LLM output.

---

## 2. Threat register

| ID | Threat | Impact | Mitigation (where defined) | Tests |
|---|---|---|---|---|
| TH-01 | Cross-tenant read/write by guessing IDs | Critical | `startupId` on every query, `TenantRepository`, `404` for foreign IDs (Backend §5.3) | TI-* |
| TH-02 | Spoofed `X-Startup-Id` | Critical | Header is a hint; active membership verified every request (Backend §5.1) | TI-20..24 |
| TH-03 | Cross-tenant references in request bodies | High | Same-tenant validation via `existsAll`; `422` (API §17) | TI-30..39 |
| TH-04 | Mass assignment (`startupId`, `status`, `approvedBy`, spend fields) | Critical | Zod `.strict()`, repository allowlists (Backend §5.3) | SC-10..14 |
| TH-05 | NoSQL operator injection | High | Reject `$`/`.` keys; typed validators (DB §3.2) | SC-01..05 |
| TH-06 | Credential stuffing / brute force | High | Strict auth rate limit; uniform errors (Backend §7.1) | AU-10..14 |
| TH-07 | Session theft / CSRF | High | httpOnly Secure SameSite=Lax cookie, Origin check, `X-Requested-With` (Backend §5.1) | AU-20..26 |
| TH-08 | JWT forgery / algorithm confusion | Critical | Fixed HS256, key list, strict verify options | AU-01..07 |
| TH-09 | Spend-cap bypass by concurrency | High | Atomic conditional reservation (Backend §10) | BG-* |
| TH-10 | Duplicate paid calls by double-click/retry | Medium | Single-flight, idempotency keys, disabled buttons | DR-*, FE-20 |
| TH-11 | Sending without approval / to DNC contact | Critical | Re-checks at handoff; edit resets approval (Backend §12) | ST-* |
| TH-12 | Prompt injection via company text or reply | High | Untrusted-data delimiters, schema and fact validation, code-decided actions (AI §5, §6) | AI-* |
| TH-13 | LLM invents facts in drafts or signals | High | Fact-id and number checks; evidence allowlist (AI §6.3–6.4) | AI-10..19 |
| TH-14 | Secrets leaked in logs, errors, responses | Critical | Redaction, sanitized errors, `select:false` | SC-20..27 |
| TH-15 | Stored XSS from third-party text | High | Plain-text rendering only, CSP, lint ban on `dangerouslySetInnerHTML` | FE-01..06 |
| TH-16 | Apollo key abuse / license breach | High | Server-only key; capability flags; commercial gate (APOLLO doc §4) | REL-03 |
| TH-17 | Personal-data over-collection and retention | Medium | Minimized storage and LLM inputs; retention checklist (§8) | PR-* |
| TH-18 | Dependency / supply-chain compromise | Medium | Lockfile, audit in CI, pinned versions (§9) | CI-* |
| TH-19 | Database exposed to the internet | Critical | Bind to private interface, auth enabled, firewall (Deployment doc) | REL-05 |
| TH-20 | Misleading UI claims ("sent", "delivered") | Medium (trust/legal) | Wording map and lint (Frontend §11) | FE-10..13 |
| TH-21 | Unsubscribe not honored | High | Keyword pre-check overrides LLM; DNC enforced everywhere | ST-30..35 |
| TH-22 | SSRF via user-supplied URLs | Medium | `linkedinUrl` and `calendarLink` are stored and displayed, **never fetched** by the server | SC-30 |

---

## 3. Security controls checklist

Mark each when implemented and tested.

### 3.1 Authentication and sessions
- [ ] Password hashing: argon2id (or bcrypt cost ≥ 12); minimum password length 10, maximum 128
- [ ] Same response and similar timing for unknown email vs wrong password
- [ ] JWT HS256 only; `JWT_SECRETS` list (≥ 32 bytes each); verify with `algorithms: ['HS256']`
- [ ] Cookie: httpOnly, Secure, SameSite=Lax, 24 h; cleared on logout
- [ ] Every request re-checks user `active` and membership `active`
- [ ] CSRF: `Origin` match + `X-Requested-With` on all non-GET
- [ ] Rate limits: global, auth, per-startup paid

### 3.2 Authorization and tenancy
- [ ] Permission matrix in one config file; `requirePermission` on every write route
- [ ] Tenant-scoped repositories only; models imported only by repositories (ESLint rule)
- [ ] Test-environment Mongoose plugin that **throws if a query on a tenant-owned model lacks `startupId`** (§5.2)
- [ ] Aggregations start with `$match: { startupId }`
- [ ] `populate()` banned on tenant-owned references (lint rule)
- [ ] Last-owner protection; owner/membership consistency

### 3.3 Input handling
- [ ] Zod `.strict()` on body, query, and params; unknown keys → `422`
- [ ] ObjectId format check before queries (`400`)
- [ ] Body limit 100 KB; pagination `limit ≤ 100`
- [ ] Reject keys starting with `$` or containing `.`; reject `__proto__`, `constructor`, `prototype`
- [ ] Email and domain normalization (lowercase, trim, strip protocol/path)
- [ ] Regexes reviewed for catastrophic backtracking (reply keyword matching, domain normalizer)

### 3.4 Secrets and configuration
- [ ] `env.js` validates all required variables at boot and refuses to start otherwise
- [ ] `LLM_MODE=mock` and `APOLLO_MODE=mock` refuse to boot when `NODE_ENV=production`
- [ ] No secrets in repo, Docker images, client bundles, logs, or error responses
- [ ] `.env` permissions restricted on the server; separate keys per environment

### 3.5 Provider and AI safety
- [ ] Apollo key only in a server header, never logged
- [ ] Capability flags default off; a disabled capability returns `503` before reserving budget
- [ ] No automatic retries of paid calls; no retry after a timeout (Backend §10.3)
- [ ] LLM inputs minimized (no emails, LinkedIn URLs, IDs); prompts and outputs not logged at normal levels
- [ ] Prompt-injection controls and output validators active (AI §5–6)
- [ ] Unsubscribe pre-check always runs, even if the LLM fails

### 3.6 Logging and errors
- [ ] pino redaction for `authorization`, `cookie`, `password*`, `*token*`, `*key*`
- [ ] Production errors return `{ error: { code, message, requestId } }` only; no stack traces, no query text
- [ ] Logs contain no message bodies, reply text, or contact emails
- [ ] Security events logged: failed logins, forbidden attempts, cross-tenant `404`s (rate-limited), budget blocks

### 3.7 Frontend
- [ ] No tokens in JS-accessible storage
- [ ] All third-party text rendered as plain text; `dangerouslySetInnerHTML` banned by lint
- [ ] External links `rel="noopener noreferrer"`
- [ ] CSP set at the hosting layer; no inline scripts
- [ ] No contact emails or message text in URLs, console logs, or analytics

---

## 4. Test strategy

### 4.1 Pyramid
| Layer | Tooling | Runs | Share |
|---|---|---|---|
| Unit (pure functions, rules, validators) | Vitest/Jest | Every commit | Largest |
| Integration (API + in-memory Mongo replica set + mocks) | Supertest, `mongodb-memory-server` (replica set mode) | Every commit | Core of the safety tests |
| Contract (responses match `API_CONTRACT.md`) | Zod schemas from the contract | Every commit | Every endpoint |
| Frontend component and API-layer | Vitest, RTL, MSW | Every commit | |
| E2E | Playwright against mock-mode backend | Pre-merge to main and nightly | Key journeys |
| Golden AI evaluation | Live LLM, small budget | Manual, on prompt change | See AI §9.2 |
| Manual security review | Checklist + optional external pen test | Before first non-founder customer | |

### 4.2 Rules for all tests
- Apollo and LLM are always mocked in CI. Live provider tests are manual and budget-capped.
- Use an injectable `clock` for expiry, staleness, and follow-up timing.
- Each test creates its own tenants (A and B, with users of each role); no shared mutable fixtures.
- A bug fix requires a regression test with the bug's ID.

---

## 5. Tenant isolation test matrix (release blocker)

### 5.1 Setup
Two startups **A** and **B**. Users: `A.owner`, `A.admin`, `A.member`, `B.owner`, plus `A.removed` (removed member), `A.invited`. A has one of every resource type.

### 5.2 Structural guard (catches future mistakes)
In the **test environment only**, register a global Mongoose plugin on the 11 tenant-owned models that inspects every query and aggregate, and **throws if the filter has no `startupId`** (or, for aggregates, if the first stage is not `$match` with `startupId`). Any test that touches the database then fails loudly if a repository forgets tenant scope. The plugin itself has tests (positive and negative).

### 5.3 Generated route tests
The route table is the single source. For every route with `:id` params or body references, the harness generates:

| ID | Case | Expected |
|---|---|---|
| TI-01 | `B.owner` calls `GET /…/:id` with an A resource id | `404 NOT_FOUND` (identical body shape to a missing id) |
| TI-02 | `B.owner` calls every mutating action on an A resource id | `404`, and the A resource is unchanged |
| TI-03 | `B.owner` calls list endpoints | Result contains zero A records; `meta.total` counts only B |
| TI-04 | Detail endpoints return no A-owned nested records (e.g. prospect detail includes only same-startup contacts/signals/activity) | Verified by seeding B with the same domain names and checking ids |
| TI-05 | Aggregates (`/dashboard`, `/usage/*`) | Totals equal B's own data only |

### 5.4 Membership and header cases
| ID | Case | Expected |
|---|---|---|
| TI-20 | `X-Startup-Id` of A sent by `B.owner` | `403 NOT_A_MEMBER` |
| TI-21 | Missing `X-Startup-Id` on a tenant route | `400`/`403` per contract (never defaults to a tenant) |
| TI-22 | `A.removed` and `A.invited` call tenant routes | `403 NOT_A_MEMBER` |
| TI-23 | A user disabled mid-session | Next request `401` |
| TI-24 | Suspended startup | `403`; `trial_expired` startup allows reads, rejects writes with `402 TRIAL_EXPIRED` |

### 5.5 Cross-tenant reference cases (body and query)
For each field below, `A.owner` submits an id from **B**; expected `422 VALIDATION_FAILED` and **no write**:

| ID | Field |
|---|---|
| TI-30 | `POST /prospects/search` → `icpId` |
| TI-31 | `POST /prospects/select`, `/prospects/score` → `prospectIds[]`, `icpId` |
| TI-32 | `POST /campaigns` → `icpId` |
| TI-33 | `POST /messages/draft` → `campaignId`, `decisionMakerId` |
| TI-34 | `POST /activities/replies` → `prospectId`, `messageId` |
| TI-35 | Query filters `icpId`, `prospectId`, `campaignId` on list endpoints | Empty result, not B's data |
| TI-36 | Mixed: one valid id plus one foreign id in `prospectIds[]` | Whole request rejected, nothing written |
| TI-37 | Duplicate ids in an array (`[x, x]`) | Treated as one (the `existsAll` de-dup test) |
| TI-38 | Within A: contact from prospect P1 used with prospect P2 | `422` |
| TI-39 | `nextBestActions.basedOnActivityIds` containing a B activity | Rejected at creation (service-level test) |

### 5.6 Repository unit tests
For every `TenantRepository` method: a test that startup A's filter cannot be overridden by caller input (`{ startupId: B }` passed as a filter is ignored or rejected), and that updates cannot change `startupId`.

---

## 6. Core safety suites (release blockers named in the audit)

### 6.1 Authentication and session (AU)
| ID | Test |
|---|---|
| AU-01 | Token with `alg: none` rejected |
| AU-02 | Token signed with another secret rejected; tampered payload rejected |
| AU-03 | Expired token rejected |
| AU-04 | Key rotation: token signed with the previous key still valid; unknown key rejected |
| AU-05 | Token for a user later set `disabled` rejected |
| AU-06 | Logout clears the cookie; replaying the old cookie is only valid until its expiry (documented behavior) |
| AU-10 | 11th login attempt within the window → `429` |
| AU-11 | Unknown email and wrong password produce identical status and body |
| AU-12 | Registration with an existing email → `409` without revealing more |
| AU-20 | POST without `X-Requested-With` → rejected |
| AU-21 | POST with a foreign `Origin` → rejected |
| AU-22 | Cookie attributes: httpOnly, Secure, SameSite=Lax |

### 6.2 Input hardening (SC)
| ID | Test |
|---|---|
| SC-01 | `{"email": {"$gt": ""}}` at login → `422`, not a successful query |
| SC-02 | `?status[$ne]=x` on list endpoints → `422` |
| SC-03 | Body keys containing `.` or starting with `$` → `422` |
| SC-04 | `__proto__` / `constructor` keys in bodies do not pollute `Object.prototype` |
| SC-05 | Oversized body (> 100 KB) → `413`/`400`; oversized arrays/strings beyond bounds → `422` |
| SC-10 | Create/update with `startupId`, `createdBy`, `approvedBy`, `approvedAt`, `status`, `approvalStatus`, `spendCommitted`, `spendReserved`, `apiSpendCap`, `criteriaVersion`, `source`, `idempotencyKey`, `icpId` (on prospect update) → `422` and no change |
| SC-11 | `PATCH /icps/:id` cannot change `startupId` or `createdBy` |
| SC-12 | `PATCH /messages/:id` cannot set `approvalStatus`, `status`, or `revision` |
| SC-13 | `prospects.icpId` immutable (no endpoint or repository path updates it) |
| SC-14 | Client cannot set `emailVerified` on manual contacts |
| SC-20 | `passwordHash` never present in any API response or log line |
| SC-21 | Sample secrets (fake API key strings) injected into config never appear in logs, errors, or responses under forced error conditions |
| SC-22 | Production error responses contain no stack traces or Mongo error text |
| SC-23 | Provider error with a key in its text is sanitized before storage or return |
| SC-24 | Redaction config covers `authorization`, `cookie`, `password`, `token`, `key` fields (unit) |
| SC-30 | Server never fetches `linkedinUrl` or `calendarLink` (assert no outbound HTTP to user-supplied hosts) |

### 6.3 Budget and usage (BG)
| ID | Test |
|---|---|
| BG-01 | Cap fits exactly N reservations; 50 parallel `reserve` calls → exactly N succeed; `spendCommitted + spendReserved ≤ cap` always |
| BG-02 | `commit` twice with the same reservation id changes counters once |
| BG-03 | `release` restores `spendReserved`; a ledger row with `status='failed'/'blocked'` and zero cost exists |
| BG-04 | Provider timeout commits the estimate with `costType='estimated'` and `errorCode='PROVIDER_TIMEOUT'`; no retry |
| BG-05 | Overrun (`actual > estimate`) commits actual and logs a warning |
| BG-06 | Boot recovery sets `spendReserved=0` and logs affected startups |
| BG-07 | Reconciliation script reports zero drift after a mixed run; reports drift when a counter is tampered |
| BG-08 | Disabled capability returns `503` and creates **no** reservation and **no** ledger row |
| BG-09 | `BUDGET_EXHAUSTED` writes a `blocked` ledger row and returns `402` |
| BG-10 | Entitlements: limits enforced (`PLAN_LIMIT_REACHED` with metric/used/limit in `details`); documented soft-limit overshoot bounded by rate limits |
| BG-11 | Counters are not writable through generic updates (SC-10) |
| BG-12 | Commit and ledger insert are atomic (transaction): a forced failure between them leaves neither |
| BG-13 | Trial expiry: after `trialEndsAt`, writes and paid calls → `402 TRIAL_EXPIRED`; reads still work |

### 6.4 Drafts, approval, and handoff (DR, ST)
| ID | Test |
|---|---|
| DR-01 | Same `(campaign, contact, step)` returns the same message id with `200` |
| DR-02 | 20 parallel identical draft requests → one row, one LLM call |
| DR-03 | Duplicate-key backstop: simulated race resolves to the existing row |
| DR-04 | `regenerate` rewrites the same row, `revision += 1`, approval reset |
| DR-05 | `regenerate` after approval → `409 INVALID_STATE` |
| DR-06 | Draft requires `businessEmail`; DNC prospect/contact → `409 DO_NOT_CONTACT` |
| ST-01 | Approve then edit subject or body → `pending`/`draft`, `approvedBy/At` cleared |
| ST-02 | Handoff on unapproved message → `409 APPROVAL_REQUIRED` |
| ST-03 | Handoff when campaign is `draft`/`paused`/`cancelled` → `409 INVALID_STATE` |
| ST-04 | Handoff when prospect or contact is `do_not_contact` → `409 DO_NOT_CONTACT` |
| ST-05 | Handoff sets `handed_off`, records `handoff_requested`, campaign becomes `active` |
| ST-06 | Second handoff on the same message allowed; second activity recorded |
| ST-07 | `mark-sent` only from `handed_off`; sets `user_reported_sent` and `sentAt`; records activity with `metadata.source='manual'` |
| ST-08 | `mark-sent` with future or pre-handoff `sentAt` → `422` |
| ST-09 | `member` role cannot approve or hand off (`403 FORBIDDEN`) |
| ST-10 | Concurrent approve and edit: final state is consistent (conditional updates); no message is `ready` with `approvalStatus != approved` |
| ST-11 | No code path writes a deferred status (`sent`, `delivered`, `queued`, etc.) — enum test and static grep |
| ST-20 | `prospects.icpId` unchanged after discovery through a second ICP; second-ICP score row inserted |
| ST-21 | Re-running the same discovery creates no duplicate prospects (apolloOrganizationId and domain paths) |
| ST-22 | Duplicate manual contact email on the same prospect → `409 CONFLICT` |
| ST-30 | Reply containing "unsubscribe" → prospect and contact `do_not_contact`, unsent drafts cancelled — **with the LLM mocked to fail** |
| ST-31 | Same reply with the LLM mocked to return `interested` → still `do_not_contact` |
| ST-32 | LLM failure on a normal reply → `201`, `reply_logged` stored, `classification: null` |
| ST-33 | Confidence < 0.6 stored as `other` and creates `review_prospect` |
| ST-34 | Clearing DNC requires `prospect:clear_dnc` and a reason; records `status_changed` |
| ST-35 | Setting prospect DNC also sets all its contacts DNC |
| ST-40 | State tables: every illegal transition for prospect, contact, campaign, and message is rejected; conditional-update races return `INVALID_STATE` |

### 6.5 AI safety (AI)
| ID | Test |
|---|---|
| AI-01 | Prompt-injection corpus in company name, industry, keywords, and reply text ("ignore previous instructions", fake JSON, fake `</untrusted_data>`) cannot change schema-valid output fields or any state |
| AI-02 | `<`/`>` in untrusted text are escaped before inclusion |
| AI-03 | LLM inputs contain no email addresses, LinkedIn URLs, or ObjectIds (assert on built messages) |
| AI-04 | Prompts and outputs are absent from `info` logs |
| AI-10 | Draft with number not present in facts, product summary, or calendar link → rejected (repair then fail) |
| AI-11 | Draft with `usedFactIds` outside the provided ids → rejected |
| AI-12 | Draft with a URL other than `calendarLink`, an email address, markdown/HTML, or a placeholder → rejected |
| AI-13 | Draft with no facts containing "I noticed"/"congratulations"/"recently" → rejected |
| AI-14 | Word limits enforced per step |
| AI-15 | While D21 is Proposed, drafts do not assume or append an opt-out footer; if D21 is accepted, test that the fixed server-side footer is appended and not model-controlled |
| AI-16 | Signal referencing an evidence field not in stored data → rejected; `value` always copied from stored data |
| AI-17 | Signal confidence above rubric caps → rejected |
| AI-18 | `explain_score` mentioning a different score → rejected; score and category unchanged afterwards |
| AI-19 | `icp_extract` output with invalid ranges, unknown country, or duplicate items → rejected; `insufficient_data` → `422` |
| AI-20 | Repair path: invalid output triggers exactly one repair call, recorded as a separate ledger row; second failure → `PROVIDER_FAILED`, nothing saved |
| AI-21 | `LLM_MODE=mock` in production refuses to boot |
| AI-22 | `nba_wording` failure or `BUDGET_EXHAUSTED` falls back to templates; `GET /next-actions` never returns `402` |

### 6.6 Frontend (FE)
| ID | Test |
|---|---|
| FE-01 | Company name, message body, and reply text containing `<img src=x onerror=…>` and `<script>` render as literal text |
| FE-02 | Lint rule fails the build on `dangerouslySetInnerHTML` |
| FE-03 | No token or contact email appears in `localStorage`/`sessionStorage` (E2E assertion) |
| FE-04 | CSP header present in the production build config |
| FE-10 | Wording lint: forbidden strings ("Delivered", "Sent" without "by you", "Running", "Charged") absent from UI source outside an allowlist |
| FE-11 | Every enum value has a label in `wording.ts` (unit; fails when a new enum value lacks one) |
| FE-12 | After handoff the UI shows "We opened your email app…" and never "Sent" |
| FE-13 | Dashboard funnel labels match the wording map; no open/delivery/reply-rate metrics |
| FE-20 | Paid buttons disable while pending and when `budgetBlocked`, `readOnly`, or capability is off |
| FE-21 | `mailto.ts`: encoding, CRLF newlines, 1800-character guard with body-copy fallback |
| FE-22 | Role-based UI: `member` sees no approve/handoff controls; direct navigation still yields `403` from the API and a clear state |
| FE-23 | Global handler: each error code in the registry triggers its defined behavior |

### 6.7 End-to-end journeys (Playwright, mock backend)
| ID | Journey |
|---|---|
| E2E-01 | Register → create workspace → ICP via AI propose (edit, save) → discover → select → add contact manually → draft → edit (approval resets) → approve → open email → mark sent → log reply (unsubscribe → DNC) → next actions → dashboard counts |
| E2E-02 | Capability disabled: discovery shows unavailable state; contacts tab offers manual add |
| E2E-03 | Budget exhausted: paid buttons disabled with banner; free actions still work |
| E2E-04 | Trial expired: read-only mode; writes rejected with the correct banner |
| E2E-05 | Two workspaces (two browsers): data never crosses; switching workspace clears cache |
| E2E-06 | Member vs owner: approval and handoff available only to the right role |

---

## 7. Non-functional tests
| ID | Test | Target |
|---|---|---|
| NF-01 | List and dashboard queries with 10k prospects per startup use the intended indexes (`explain()` shows no collection scan on `startupId`-led queries) | Index-backed |
| NF-02 | Discovery request (mock Apollo latency 2 s) p95 | < 5 s |
| NF-03 | 50 concurrent mixed users smoke test (mock providers) | No 5xx; p95 < 500 ms on reads |
| NF-04 | Graceful shutdown: in-flight reservations committed or released on SIGTERM | No leaked `spendReserved` |
| NF-05 | Provider outage (mock returns 5xx/timeouts) | Clean `502`, no stuck state, no leaked budget |

---

## 8. Privacy and data protection checklist

Engineering items only; confirm requirements with a lawyer for each market (for example the UK/EU rules on business email, India's data-protection law, and CAN-SPAM for US recipients).

### 8.1 Personal data inventory
| Data | Where | Source | Purpose |
|---|---|---|---|
| Users: name, email, password hash | `users` | User | Account |
| Contacts: name, job title, business email, LinkedIn URL | `decisionMakers` | Apollo or founder | Outreach drafting |
| Pasted replies (may include personal data) | `salesActivities.summary` and `reply_logged` | Founder | Classification and follow-up |
| Draft text referencing contacts | `outreachMessages` | AI + founder | Outreach |

### 8.2 Controls
- [ ] Collect only the fields listed in the schema; no extra scraping
- [ ] Access limited to active members of the owning startup (tested in §5)
- [ ] LLM inputs minimized (AI §4); provider data controls set to no training and shortest retention available
- [ ] Data processing terms accepted with the hosting, LLM, and Apollo providers; data location noted
- [ ] **Do-not-contact** honored everywhere and never silently cleared
- [ ] Resolve D21 after compliance review; if accepted, verify the fixed opt-out footer and sender identity are present on drafts
- [ ] Privacy notice tells founders that prospect and reply text is processed by an LLM provider and that contact data comes from Apollo
- [ ] Data subject requests: a documented manual procedure to find, export, and delete a contact across `decisionMakers`, `outreachMessages`, `salesActivities`, `nextBestActions`, `buyingSignals`
- [ ] Workspace deletion procedure: remove all documents with that `startupId` in all 11 tenant collections plus memberships; backups age out per retention policy
- [ ] Retention periods decided and written down (for example: inactive trial workspaces deleted after N days)
- [ ] Breach response: who is told, within what time, and how (see §10)

### 8.3 Tests
| ID | Test |
|---|---|
| PR-01 | Deletion script removes every document for a `startupId` (integration; counts per collection reach zero) |
| PR-02 | Contact erasure script removes or anonymizes the contact across all related collections and leaves the rest of the workspace consistent |
| PR-03 | Export script returns only the requesting startup's data |

---

## 9. CI/CD gates

| Gate | Requirement |
|---|---|
| Lint | ESLint incl. rules: no `dangerouslySetInnerHTML`, no model imports outside repositories, no `populate()` on tenant refs, no direct provider SDK imports outside `providers/` |
| Types | `tsc --noEmit` for client and shared |
| Unit + integration + contract | All green; coverage on `common/`, `modules/*/rules`, `providers/ai/validators` ≥ 90% lines |
| Tenant isolation suite (§5) | 100% pass; **blocks merge** |
| Safety suites (§6.3, §6.4, §6.5) | 100% pass; **blocks merge** |
| Dependency audit | `npm audit --omit=dev` with no high/critical unresolved; lockfile committed; Dependabot or equivalent |
| Secret scan | Gitleaks (or equivalent) on every push |
| E2E | Pre-merge on main branches; nightly full run |
| Build | Production build checks CSP config and absence of mock-mode flags |

---

## 10. Incident handling (minimum viable)

1. **Severity:** S1 cross-tenant exposure, credential leak, or unapproved handoff possible; S2 spend-cap bypass or data loss; S3 functional bug; S4 cosmetic.
2. **S1/S2 response:** disable the affected feature or take the app offline; rotate exposed secrets (JWT secrets, Apollo and LLM keys, DB credentials); preserve logs; identify affected startups using `requestId` and `startupId` logs; notify affected customers and any required regulator within legal deadlines (confirm with counsel).
3. **After:** write a post-mortem, add a regression test with the incident ID, and update this document's threat register.
4. **Contacts:** name an owner for security reports and publish a `security@` address.

---

## 11. Release gates (go/no-go)

### 11.1 Before the founder pilot (your own accounts and consenting founders)
- [ ] All §5 and §6 blocker suites green in CI
- [ ] Trial spend cap frozen and identical in config, API, UI, and tests (D5)
- [ ] Apollo capabilities 1–3 verified and recorded, or the pilot runs in mock mode and says so (`APOLLO_INTEGRATION.md`)
- [ ] `DRAFT_OPT_OUT_LINE` wording reviewed
- [ ] Privacy notice and terms drafted
- [ ] MongoDB not publicly reachable, authentication on, backups tested (REL-05)
- [ ] Secrets set; mock modes refuse to boot in production

### 11.2 Before any non-founder customer
- [ ] Apollo commercial questions C1–C3 answered in writing; license permits the intended use
- [ ] Manual security review of this checklist completed; consider an external penetration test focused on tenant isolation and auth
- [ ] Data processing agreements with hosting, LLM, and Apollo providers
- [ ] Deletion and export procedures tested (PR-01..03)
- [ ] Incident process and contacts in place
- [ ] Monitoring and alerting for `5xx` rate, auth failures, budget blocks, and provider errors (Deployment doc)

### 11.3 Release IDs referenced above
| ID | Item |
|---|---|
| REL-01 | Blocker suites green |
| REL-02 | Trial cap frozen |
| REL-03 | Apollo capability and license gate |
| REL-04 | Compliance review of drafts and privacy notice |
| REL-05 | Database network, auth, and backup verification |

---

## 12. Definition of done (per feature)
1. Code with repository allowlists, validators, and permission checks.
2. Unit + integration + contract tests, including the tenant cases for every new route or reference.
3. Entry in `API_CONTRACT.md`; enum or state changes recorded in `DB_ARCHITECTURE.md`.
4. Wording checked against `lib/wording.ts` for any new status or event.
5. New threat or control added to this document if the feature touches data, money, or outbound behavior.

---

## 13. Open items
1. Choose the test runner (Vitest vs Jest) and fix it in `package.json` for both server and client.
2. Decide whether to commission an external penetration test and when.
3. Write the Mongoose test-environment tenant guard plugin first (§5.2); it protects every later feature.
4. Define retention periods (§8.2) and the contact for security reports.
5. After `DEPLOYMENT_AND_OPS.md` is written, link REL-05 and the monitoring items to concrete steps.