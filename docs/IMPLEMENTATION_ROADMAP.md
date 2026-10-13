# BlueCode OS — Implementation Roadmap

**Status:** Phase 0 plan  
**Implementation base:** `frontend-MVP`  
**Accepted UX reference:** `frontend`  
**Scope:** Align and evolve the integrated product incrementally; do not restart or wholesale-merge the prototype.

## 1. Working rules

1. Read `docs/FRONTEND_ARCHITECTURE.md` before planning or changing frontend code.
2. Treat `docs/API_CONTRACT.md` as frozen. Contract changes require explicit approval and a documented decision.
3. Treat `docs/DB_ARCHITECTURE.md` as the database source of truth; do not add collections or schema fields by inference.
4. Preserve auth cookies, `X-Requested-With`, `X-Startup-Id`, tenant isolation, permission checks, workspace switching and cache-clearing semantics.
5. Keep Apollo credentials and provider calls on the backend.
6. Never present mock results as live provider data or claim that email was sent/delivered unless verified by a real integration.
7. Keep outreach draft-first and founder-reviewed. The currently frozen outbound path is `mailto:`.
8. No new dependencies merely for folder organization.
9. Make small changes, one feature at a time; preserve local work and never use destructive resets to make a patch apply.
10. Run typecheck/build and relevant behavior checks after each implementation batch.

## 2. Phases and gates

### Phase 0 — Product/architecture alignment (current)

**Deliverables**
- `docs/PRODUCT_UX_MAPPING.md`
- `docs/PRODUCT_RULES_AND_ENTITLEMENTS.md`
- `docs/MVP_CAPABILITY_GAP_ANALYSIS.md`
- `docs/IMPLEMENTATION_ROADMAP.md`

**Acceptance**
- Accepted screens map to existing routes or are explicitly marked future/decision-required.
- Prototype mock behavior is distinguished from integrated API behavior.
- Commercial/entitlement ambiguities are documented.
- API contract and database architecture remain unchanged.
- Phase 0 review is complete before feature implementation.

### Phase 1 — Architecture and route stabilization

**Scope**
- Verify existing `App.tsx`, `app/navigation.ts`, `app/hooks.ts`, `layouts/AppShell.tsx`, `api.ts`, `features/pages/index.tsx` and extracted feature pages.
- Confirm the intended accepted UX route mapping.
- Extract or move code only when it reduces coupling; avoid folder churn for its own sake.
- Preserve current URL paths and query-string behavior.

**Acceptance**
- `pnpm typecheck` passes.
- `pnpm build` passes.
- Auth/register/login, workspace picker/switch, each nav route, refresh/deep-link and browser back/forward behavior pass smoke tests.
- No duplicated API client and no changed request headers or credentials behavior.

### Phase 2 — UX flow alignment

**Build order**
1. ICP creation/review and manual fallback.
2. Prospect list, discovery disabled states, filters and selection.
3. Prospect detail: score, evidence/signals, contacts and manual contact entry.
4. Outreach draft editor, approval lifecycle and `mailto:` handoff.
5. Reply logging and next-action recommendations.
6. Dashboard funnel, activity timeline and usage display.

**Acceptance**
- Each action maps to a real endpoint, a clearly local UI action or a capability-disabled notice.
- Empty/error/loading/disabled states are complete.
- Score and signal explanations are evidence-based and honestly labeled.
- No action is reported as successful before the server responds.
- No “sent/delivered/opened by recipient” claim without supporting integration evidence.

### Phase 3 — Usage and trial enforcement

**Prerequisites**
- Product owner approves trial period semantics and entitlement matrix.
- Each usage metric has a unit, event, scope, period, failure/refund behavior and limit.
- Per-operation cost estimates are based on current provider pricing and controlled test observations.

**Scope**
- Implement approved backend enforcement and usage ledger behavior.
- Surface server-authoritative trial, spend, limit and blocked-action states in the UI.
- Add boundary/concurrency/tenant-isolation tests.

**Acceptance**
- UI and backend usage agree.
- Concurrent paid operations cannot exceed approved cap through race conditions.
- Failed and blocked operation accounting follows the approved policy.
- No guessed prices or limits.

### Phase 4 — Apollo integration

**Prerequisites**
- Confirm customer-level OAuth eligibility, scopes, plan/API limits, credit behavior and commercial/data terms.
- Approve any necessary API-contract and architecture changes.

**Scope**
- Backend integration service and OAuth connect/callback/disconnect lifecycle.
- Secure token storage, minimal scopes and tenant-bound account connection.
- Company/people search, pagination, duplicate suppression and selective enrichment.
- Provider error, rate-limit, retry and usage accounting behavior.

**Acceptance**
- Controlled test account connects and disconnects successfully.
- Searches are provider-backed and scoped to the right workspace/account.
- Enrichment is only run on selected records and is budget-gated.
- Tokens/secrets never reach the frontend or logs.
- Contract, security and integration tests pass.

### Phase 5 — AI intelligence

**Scope**
- ICP interpretation, research summaries, personalization, reply classification and next-best-action reasoning.
- Deterministic scoring remains authoritative for numeric fit scores; AI explanations must be labeled as such.
- Include source facts/evidence for “Why Now?” and recommendation reasoning.

**Acceptance**
- No invented company facts, signals or contact data.
- AI failure does not destroy saved data or block supported manual paths.
- Prompt inputs/outputs and costs are bounded and recorded without sensitive body/email logging.
- Evaluation fixtures cover useful, unsupported and ambiguous evidence.

### Phase 6 — Entitlements and subscription

**Prerequisites**
- Approved Starter/Growth/Pro feature and limit matrix, prices, billing cadence and payment provider.
- Approved API contract and data model changes if required.

**Scope**
- Subscription lifecycle, upgrade/downgrade, renewals, cancellations and failed payment handling.
- Server-enforced limits and clear UI for blocked/available actions.
- Monthly and annual plans only if approved.

**Acceptance**
- Entitlements are enforced server-side and cannot be bypassed by client requests.
- Billing state and access state are reconciled and tested.
- Price and limit copy matches approved commercial policy.

### Phase 7 — Visual polish and controlled pilot

**Scope**
- Apply approved typography, color tokens, spacing, component patterns and responsive layout to the accepted UX.
- Accessibility audit, regression tests and pilot scorecard.
- Run the 15-day founder pilot with a controlled cohort.

**Acceptance**
- Core founder journey is usable end to end.
- Visual hierarchy matches approved reference; premium styling does not obscure data quality or action states.
- Pilot report records ICP approval time, prospect relevance, decision-maker coverage, research usefulness, draft approval/edit rate, recorded funnel events, AI/API cost and continuation intent.
- Outcomes are reported honestly; meetings/revenue are not guaranteed.

## 3. Required test strategy

- Unit tests for API error normalization, wording/status labels, money formatting and `mailto:` encoding/length fallback.
- Component tests for disabled capabilities, paid-action states, score coverage, editor approval reset and reply-log failure.
- Integration tests for workspace headers, permission gates, usage updates and server error handling.
- End-to-end flow: register/login → workspace → ICP → discovery state → prospect → manual contact → draft → approval → mailto handoff → user-reported sent → reply log → next actions.
- Negative paths: trial expired, budget blocked, capability disabled, network error, rate limit, DNC contact, missing mail client and insufficient permission.
- Accessibility checks for keyboard use, dialogs, labels, focus and non-color status meaning.

## 4. Change-control checklist

Before each implementation batch:
- [ ] Re-read the relevant architecture and API sections.
- [ ] State exact files to change and expected behavior.
- [ ] Verify no unapproved API/DB changes.
- [ ] Preserve unrelated local edits.
- [ ] Apply the smallest useful diff.
- [ ] Run typecheck/build and targeted tests.
- [ ] Summarize changed files, tests and known gaps.

## 5. Phase 0 exit criteria

Phase 0 is complete when the four alignment documents are reviewed, open decisions are visible, and Phase 1 can proceed without guessing what the accepted UX means or what the backend supports.
