# BlueCode OS — Product UX Mapping

**Status:** Phase 0 baseline  
**Branch target:** `frontend-MVP`  
**UX source:** `frontend` branch and the supplied October 2026 AI Sales Copilot project proposal  
**Implementation source of truth:** `docs/FRONTEND_ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DB_ARCHITECTURE.md`, and `docs/DECISIONS.md`

## 1. Purpose

Map the client-accepted experience to the existing integrated frontend without merging the older prototype wholesale or changing the frozen API contract. The UX branch describes the desired user journey; it does not prove that its mock interactions or simulated AI/provider behavior exist in production.

## 2. Product journey

1. Sign in / register.
2. Select or create a startup workspace.
3. Configure startup context and an Ideal Customer Profile (ICP).
4. Review and approve the ICP.
5. Discover companies when company search is enabled.
6. Qualify prospects using fit scores, evidence, coverage, and rationale.
7. Identify decision-makers or add contacts manually.
8. Review available signals and the “Why Now?” context only when supported by evidence.
9. Draft personalized outreach and review/approve it.
10. Hand the approved draft to the founder's email app.
11. Log replies the founder supplies, review recommendations, and inspect recorded activity.
12. Review dashboard, pipeline funnel, trial status, and usage.

The signature product concepts are **Why Now?** and **Next Best Action**. Both must be grounded in available records. No evidence means clearly state that evidence is unavailable; do not invent a buying signal.

## 3. Accepted screen-to-route mapping

| Accepted UX screen | Integrated route / destination | Current module | Implementation notes |
|---|---|---|---|
| Login / Register | `/login`, `/register` | `features/auth/` | Preserve server validation and cookie-based session behavior. |
| Startup Setup / workspace selection | `/workspaces`, workspace settings | `features/workspaces/`, `features/settings/` | Map startup context to supported workspace fields; do not invent new fields without approval. |
| Dashboard | `/dashboard` | `features/dashboard/DashboardPage.tsx` | Summarize recorded activity, next actions, pipeline stages and usage. |
| ICP Builder | `/icps/new` | `features/icps/IcpPage.tsx` | Describe → review/edit → save; retain manual-entry fallback if AI proposal is unavailable. |
| AI Generated ICP / ICP result | `/icps/:id` | `features/icps/IcpPage.tsx` | Clearly mark proposals as unsaved until founder confirms. |
| Prospects / company directory | `/prospects`, `/prospects/discover` | `features/prospects/ProspectsPage.tsx` | Company discovery is capability-gated. Show disabled state instead of mock live results. |
| Leads / ranked list | `/prospects` with an ICP/score view | `features/prospects/ProspectsPage.tsx` | Do not add a separate `leads` collection; architecture uses prospects plus versioned lead scores. |
| Prospect Intelligence / “Why Now?” | `/prospects/:id` | `features/prospects/ProspectsPage.tsx` | Detail tabs should expose overview, score, signals, contacts, outreach and activity as supported. |
| Decision Makers | Contacts tab at `/prospects/:id` | `features/prospects/ProspectsPage.tsx` and future contact submodule if needed | `search_people` and enrichment remain disabled until enabled; manual contacts are the honest fallback. |
| Personalized Outreach editor | `/outreach/messages/:id` | `features/outreach/OutreachPage.tsx` | Draft-first, editable, approval-aware. Never imply the product sent the email. |
| Follow-ups | `/next-actions` | `features/next-actions/NextActionsPage.tsx` | Display recommendations; no autonomous follow-up sending. |
| Next Best Action | `/next-actions` and dashboard recommendation area | `features/next-actions/`, `features/dashboard/` | Explain reason and link to the relevant task. |
| Pipeline & Analytics | Dashboard funnel; Activity where detailed events are needed | `features/dashboard/`, `features/activity/` | Use only recorded events. No recipient-open or reply-rate analytics unless actually measured. |
| Activity timeline | `/activity` and prospect Activity tab | `features/activity/`, prospect detail | Distinguish manual/user-reported events from system events. |
| Usage / trial status | `/usage` and app shell | `features/usage/`, `layouts/AppShell.tsx` | Server is authoritative for usage, cap and trial state. |
| Settings | `/settings` | `features/settings/SettingsPage.tsx` | Workspace profile, members and read-only plan information as currently contracted. |

## 4. Current route and module baseline

The integrated route dispatcher currently lazy-loads:
- `features/dashboard/DashboardPage.tsx`
- `features/icps/IcpPage.tsx`
- `features/prospects/ProspectsPage.tsx`
- `features/outreach/OutreachPage.tsx`
- `features/next-actions/NextActionsPage.tsx`
- `features/activity/ActivityPage.tsx`
- `features/usage/UsagePage.tsx`
- `features/settings/SettingsPage.tsx`

`App.tsx`, `layouts/AppShell.tsx`, `app/navigation.ts`, `app/hooks.ts`, `api.ts`, and `features/pages/index.tsx` are existing integration points. Extend these deliberately; do not replace them with a new router or duplicate API client merely for organization.

## 5. UX behavior requirements

- Keep the accepted information hierarchy and interactions; premium colors and final design tokens are a later phase.
- Keep forms editable and display validation close to the relevant field.
- Provide loading, empty, error, disabled-capability and retry states.
- Keep filters in the URL when the existing API/route supports them.
- Show score rationale, evidence provenance, coverage/limited-data state and source where available.
- Use labels that distinguish estimates, possible signals, recommendations and user-reported outcomes.
- Disable duplicate submits while a mutation is pending; wait for server responses for state-changing or paid operations.
- Protect unsaved edits in ICP and message editors.
- Ensure responsive layouts, keyboard access, focus management and non-color status labels.
- Keep all customer/provider secrets on the backend and never log contact emails, message bodies or reply text.

## 6. Honest wording requirements

| Actual state/event | Preferred UI wording | Avoid |
|---|---|---|
| Deterministic score | “Fit score (estimate)” | “Likelihood to buy” |
| Inferred/weak signal | “Possible signal” | “Buying intent confirmed” |
| Approved message ready for handoff | “Approved · ready to open in email” | “Queued” |
| Handoff requested | “Opened in your email app” | “Sent” / “Delivered” |
| User confirms sending | “Marked sent by you” | Unqualified “Sent” |
| Reply pasted by user | “Reply added by you” | “Reply received” unless independently integrated |
| Next-best action | “Recommendation” | “Automatic follow-up” |
| Estimated cost | “Approx. ₹…” | “Charged ₹…” unless that is the actual accounting event |

## 7. API/capability alignment

The API contract remains frozen for this phase. Current disabled capabilities include live organization search, decision-maker search, enrichment and some live AI operations. The UI must read capability state and handle `CAPABILITY_DISABLED`/503 responses. No mock result should be presented as live provider data.

Outbound email remains founder-approved `mailto:` handoff. The product cannot confirm whether a mail client opened successfully or whether a message was sent/delivered. Calendar booking, provider sequence activation, inbox reading and autonomous follow-ups are not to be implied unless separately implemented and approved.

## 8. Phase 0 acceptance checklist

- [ ] Every accepted UX screen maps to an existing route or an explicitly approved future route.
- [ ] Every action is mapped to a real API operation, a local UI-only action, or a disabled/future capability.
- [ ] Mock-only prototype behavior is labeled and not mistaken for live behavior.
- [ ] No new backend endpoint, DB collection, or API contract field is assumed.
- [ ] Product owner approves any route/interaction that cannot be represented by the frozen API.
