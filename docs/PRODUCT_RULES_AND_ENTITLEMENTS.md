# BlueCode OS — Product Rules and Entitlements

**Status:** Phase 0 baseline; not an authorization to implement unapproved limits  
**Commercial source:** Supplied October 2026 AI Sales Copilot project proposal and related trial/cap planning documents  
**Technical source of truth:** `docs/FRONTEND_ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DB_ARCHITECTURE.md`, `docs/DECISIONS.md`

## 1. Product and pilot intent

AI Sales Copilot helps founders find the right companies, identify relevant decision-makers, understand why a prospect may be relevant now, personalize founder-approved outreach and choose the next action.

The supplied proposal describes a **15-day founder pilot** with an indicative output target of:
- Up to 50 accounts researched
- Up to 25 accounts qualified
- Up to 15 selected for personalized outreach

These are pilot targets, not guaranteed throughput or currently enforced application entitlements. Results depend on ICP quality, provider permissions, account plan limits, available data and actual costs.

## 2. Trial operating-cost cap

The proposal defines **₹250 maximum internal AI/API usage per startup during the 15-day pilot**. This is an internal operating guardrail, not a customer-facing promise of exact provider spend and not the price of the product. It excludes people costs and any customer Apollo subscription.

The source planning ranges are estimates only:
- Language-model/API usage: roughly ₹100–₹130
- Apollo/data enrichment: roughly ₹70–₹100
- Other search infrastructure: roughly ₹20–₹40
- Buffer: roughly ₹20–₹50

These ranges do not all resolve to a single guaranteed spend. Confirm current provider prices, endpoint behavior, customer Apollo account permissions and actual usage before a controlled pilot. Enrichment must be selective; search and prioritize first.

## 3. Requirements versus current implementation

| Item | Source-derived requirement | Current known code status | Action |
|---|---|---|---|
| Trial duration | 15 days | Architecture describes trial state; inspect actual backend trial calculation before claiming enforcement | Verify backend behavior and tests |
| Trial seats | One user in trial | `backend/src/config/plan-limits.ts` has `trial: 1` | Preserve; add tests if missing |
| ICP limit | One ICP proposed for initial trial | Numeric entitlement registry is intentionally empty | Product owner approval, then implement server-side |
| Research volume | Target up to 50 accounts | Not equivalent to a hard cap; no approved search limit currently encoded | Decide whether target or enforceable entitlement |
| Qualified volume | Target up to 25 | Pilot success target, not necessarily a hard limit | Track as pilot metric |
| Outreach selection | Target up to 15 | Pilot target, not a send allowance | Track selections and approvals |
| Decision makers | Earlier planning notes mention 50; proposal does not establish this as a hard cap | No approved limit in entitlement registry | Resolve meaning and approve before implementation |
| Email allowance | Some notes mention 100 emails; proposal's pilot target is 15 selected outreach prospects | Current outbound is `mailto:` handoff; no server-side send | Define whether it counts drafts, handoffs or provider-confirmed sends |
| Email credits | Some notes mention 50 credits | No approved mapping to a backend usage metric in current frozen docs | Define what consumes a credit and how it relates to email allowance |
| Client capacity | Some notes mention 50 clients | Meaning is ambiguous: prospects, workspaces, seats or customers | Clarify before implementation |
| Internal cost cap | ₹250 AI/API cost per startup for the pilot | `backend/src/config/usage-estimates.ts` intentionally has no approved estimates; paid routes can be capability-disabled without them | Approve per-operation estimate policy and enforcement tests |
| Paid tiers | Starter, Growth, Pro | Plan limit configuration only has trial user limit explicitly set; other entitlements undefined | Define plan matrix and effective dates before implementation |
| Billing cadence | Monthly and annual proposed | Billing workflow is not part of frozen frontend contract | Future scope until approved |

## 4. Entitlement definitions required before coding

For each proposed limit, record:
1. **Metric key** used by the backend usage ledger.
2. **Unit** counted (e.g. company records, unique contacts, generated drafts, handoff requests, provider-reported sends).
3. **Counting event** and whether failed/blocked operations count.
4. **Period** (per trial, calendar month, rolling month, or lifetime).
5. **Scope** (workspace/startup, user, or integration account).
6. **Limit** for trial and each paid plan.
7. **Enforcement point** (backend must be authoritative).
8. **UI display wording** and warning threshold.
9. **Refund/reversal rule** for failed provider operations.
10. **Tests** for boundary, concurrent requests, reset/renewal and tenant isolation.

## 5. Plan matrix status

No final paid pricing or complete plan matrix is established by the supplied evidence. Survey evidence in the proposal is directional only: 12 genuine founder responses were analyzed; 11/12 rated trial likelihood 4 or 5, while 5/12 said they would probably or definitely pay. This supports testing a pilot, not claiming validated market demand or a validated subscription price.

Use this table as a decision register, not a user-facing plan comparison:

| Entitlement | Trial | Starter | Growth | Pro | Decision |
|---|---:|---:|---:|---:|---|
| Duration | 15 days proposed | TBD | TBD | TBD | Confirm trial start/end semantics |
| Seats | 1 currently encoded | TBD | TBD | TBD | Define plan entitlements |
| ICP count | 1 proposed | TBD | TBD | TBD | Approve and encode |
| Company discovery | Capability-gated | TBD | TBD | TBD | Depends on Apollo access and cost |
| People search/enrichment | Capability-gated | TBD | TBD | TBD | Decide credits and selective enrichment policy |
| AI draft/research actions | Capability-gated | TBD | TBD | TBD | Define units and cost estimates |
| Outreach | Human-reviewed handoff | Human-reviewed unless separately approved | Same | Same | No autonomous sending in current MVP |
| Usage cost cap | ₹250 internal pilot cap | TBD | TBD | TBD | Do not expose internal provider cost as customer price |
| Billing | Not applicable to pilot | Monthly/annual proposed | Monthly/annual proposed | Monthly/annual proposed | Payment provider and contract not defined |

## 6. Commercial and safety rules

- Do not promise a number of meetings, replies, revenue, or conversion rates.
- Do not claim that Apollo credits are free or that provider cost is fixed until verified.
- Do not call a draft or `mailto:` handoff a sent email.
- Do not enrich every discovered prospect by default; prioritize and enrich selected records.
- Show users when a capability is unavailable and provide a supported alternative where possible.
- Enforce paid-operation limits on the backend, not solely in the UI.
- Keep workspace usage isolated by `startupId`; never trust client-provided usage counters.
- Treat plan names and price points as proposals until approved.
- Record actual AI/API usage and Apollo credits separately where their billing/accounting models differ.

## 7. Decision log

The following questions remain open and must be answered by the product owner before Phase 3 entitlement enforcement:

- [ ] Does the “100 email” limit mean generated drafts, email-app handoffs, or provider-confirmed sends?
- [ ] What exactly is a “50 client” limit: prospects managed, workspaces, customer accounts, or user seats?
- [ ] Is ₹250 an internal cap only for the 15-day pilot, or should paid plans also have internal provider-cost guardrails?
- [ ] Does “50 decision makers” count discovered contacts, saved contacts, or enriched contacts?
- [ ] How do “100 emails” and “50 email credits” relate?
- [ ] Are the 50/25/15 pilot quantities targets, hard limits, or both with separate metrics?
- [ ] What are Starter/Growth/Pro prices, entitlements, billing provider and upgrade/downgrade rules?

No unresolved item above should be silently converted into code defaults.
