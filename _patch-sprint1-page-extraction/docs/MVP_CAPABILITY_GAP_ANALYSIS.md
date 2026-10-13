# BlueCode OS — MVP Capability Gap Analysis

**Status:** Phase 0 baseline  
**Review target:** `frontend-MVP` integrated application against the accepted `frontend` UX and supplied project proposal  
**Contract policy:** `docs/API_CONTRACT.md` remains frozen unless an explicitly approved change is documented.

## 1. Executive assessment

The integrated frontend is the implementation base and already has extracted route-level modules. The accepted branch is a visual/interaction reference and contains mock-data or simulated actions that must not be copied as if they were production capabilities.

The largest gaps are not primarily folder structure. They are the difference between the target product journey and provider capabilities currently disabled in the backend, plus missing approved usage/cost policy and unresolved commercial limits.

## 2. Capability matrix

| Capability | Target UX / proposal | Current known state from frozen docs/code | Gap / required action |
|---|---|---|---|
| Authentication and workspace selection | Founder can sign in and work in a startup workspace | Integrated app has auth/session and workspace picker; httpOnly cookie and tenant header rules are architectural requirements | Regression-test session expiry, membership failures and workspace switching |
| Startup setup/profile | Capture product context, geography, customers and objective | Settings and workspace APIs exist; do not assume all prototype fields are in the frozen DTO | Map each field to existing contract; log unrepresented fields as decisions |
| ICP builder | Describe, review/edit, save approved ICP | ICP propose route exists but live provider behavior is gated/mock-first | Preserve manual-entry path; test unsaved proposal and validation behavior |
| Company discovery | Search/filter/paginate matching companies | `POST /prospects/search` currently returns `503 CAPABILITY_DISABLED` when `search_orgs` is disabled | UI must clearly show capability unavailable; live Apollo integration required |
| Prospect list and de-duplication | Directory, filters, score and selection | Prospect APIs exist; exact behavior depends on contract | Verify supported filters and response shape; no fabricated search results |
| Deterministic fit scoring | Explain prioritization | `POST /prospects/score` is deterministic | Present as estimated fit; verify score source, coverage and per-ICP version |
| Score explanation | Concise rationale and breakdown | Explanation route is mock-only / provider-gated in current contract notes | Distinguish rules-derived data from AI-written text; avoid unsupported factor claims |
| Buying signals / “Why Now?” | Evidence-backed signal context | Signal interpretation is disabled; signals must be evidence-backed | Show no-data/disabled state; never invent timing or buying intent |
| Decision-maker search | Identify relevant people | `POST /prospects/:id/decision-makers/search` disabled when `search_people` is off | Capability notice plus manual-contact path |
| Contact enrichment | Enrich selected people | `POST /decision-makers/:id/enrich` disabled when `enrich` is off | Do not imply verification/enrichment unless response confirms it |
| Manual contact entry | Add contact when search is unavailable | API supports manual contacts per contract | Ensure UI has validation, DNC controls and tenant-safe errors |
| Outreach draft | Personalized editable message | Campaign/message APIs exist; live LLM action may be disabled | Show capability status; do not simulate a live AI generation as if real |
| Approval lifecycle | Founder/team reviews message | Approval/status model exists in contract | Ensure editing resets approval as specified and actions are role/status gated |
| Email handoff | Open approved draft in founder's email app | Frozen decision is `mailto:` handoff; no server-side send | Follow handoff flow and length fallback; copy text when no mail client opens |
| Mark-sent | User can record their own action | User-reported state is distinct from provider confirmation | Label “Marked sent by you”; never state delivery |
| Apollo OAuth / customer account | Connect user's authorized Apollo account | Proposal recommends customer-level OAuth; current architecture notes say live Apollo integration is not implemented/enabled | Requires approved backend integration work, OAuth lifecycle, token storage, disconnect, scopes and account tests |
| Apollo sequences | Sequence handoff where available | Current frozen product flow uses `mailto:`; proposal mentions Apollo sequence handoff | Decision needed: preserve current frozen `mailto:` MVP or approve contract/architecture change for sequence handoff |
| Reply classification | Founder pastes a reply; AI classifies if available | Reply logging exists; AI classification may be gated/mock-first | State that the user pasted the reply; graceful save if classification fails |
| Next-best-action | Explain recommended next task | Next Actions route/module exists | Verify recommendation source, state transitions and no autonomous send/schedule |
| Dashboard/pipeline | Summarize actual workflow | Dashboard module exists; honest funnel wording specified in architecture | Only aggregate persisted product/user events; no open/reply rates without real data |
| Usage ledger and cap | Display trial usage and stop costly actions at cap | Usage route exists; operation cost estimates intentionally empty; entitlement limits mostly undefined | Product owner must approve cost/metric policy; backend enforcement and tests required |
| Starter/Growth/Pro subscription | Monthly/annual billing | No complete plan matrix or billing contract confirmed | Future approved scope; no UI promise or billing integration assumption |
| Calendar / booking | Suggest meeting/booking next step | Proposal mentions meeting links; frozen API/UI architecture does not implement booking | Can show user-provided calendar link only where supported; no automated booking claim |
| Visual style | Preserve accepted UX, later premium treatment | Current integrated UI is not yet confirmed as visually equivalent to prototype | First map interactions; then apply approved design tokens as a separate visual phase |

## 3. Highest-priority blockers

### P0 — Phase 0/architecture and requirements
- Approve screen-to-route mapping and identify any UX that needs a new contract.
- Separate prototype mock behavior from live product capability.
- Resolve the meaning of usage metrics, 50 decision makers, 100 emails, 50 email credits and 50 clients.
- Keep the ₹250 cap clearly labeled as an internal 15-day pilot cost guardrail.

### P1 — User journey readiness
- Ensure every route has loading, empty, error and disabled-capability states.
- Make the ICP → prospect → contact → outreach → reply → next-action journey navigable with real supported operations.
- Provide manual contact entry when people search/enrichment are disabled.
- Ensure message editing/approval and `mailto:` handoff are truthful and complete.

### P2 — Provider integration
- Confirm customer Apollo OAuth eligibility, scopes, limits, credits, and data terms.
- Implement Apollo behind a backend integration service with encrypted server-side tokens and disconnect.
- Add actual cost estimates before enabling paid provider operations.
- Add retry/rate-limit/error behavior and provider-backed integration tests.

### P3 — Commercialization and polish
- Approve plan matrix and billing rules.
- Add backend-enforced entitlements and usage reporting.
- Apply premium visual design after workflow mapping and capability semantics are stable.
- Validate accessibility and responsive states.

## 4. Decisions requiring explicit approval

1. **Apollo sequence handoff vs `mailto:`.** The proposal mentions sequence handoff, while the current frozen architecture decision is `mailto:` with no server-side sending. Do not silently switch.
2. **Customer-level Apollo OAuth.** The proposal recommends OAuth; existing contract and backend must be reviewed before adding credentials/endpoints.
3. **“Why Now?” implementation.** Only show signal claims supported by stored/provider evidence; current interpretation capability is disabled.
4. **Subscription/billing.** No final price, plan entitlement matrix or billing API contract is established.
5. **Calendar/meeting flow.** User-provided calendar link may be displayed where supported; automatic booking is not part of the current contract.
6. **Visual migration.** Preserve accepted UX interactions first; colors/typography/premium treatment are a later separate phase.

## 5. Definition of ready for Phase 1

- [ ] Architecture and API source documents are named and frozen for the refactor.
- [ ] Accepted screen-to-route map is approved.
- [ ] Existing integrated routes and modules are inventoried.
- [ ] Disabled and mock-only capabilities have explicit UI behavior.
- [ ] Entitlement ambiguities are recorded and not encoded as guesses.
- [ ] No new dependency, database collection, endpoint or API DTO is introduced by the UX alignment work.
