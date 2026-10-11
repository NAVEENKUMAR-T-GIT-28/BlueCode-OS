# BlueCode OS — Frontend Architecture (LLD)

**Document:** `FRONTEND_ARCHITECTURE.md`
**Version:** 1.0 (draft for review)
**Depends on:** `API_CONTRACT.md` (endpoints, DTOs, errors), `DB_ARCHITECTURE.md` (enums), `BACKEND_ARCHITECTURE.md` (permissions, states)
**Scope:** React client structure, routing, state and data fetching, pages and flows, UX states, honest-wording rules, the `mailto:` handoff, security, testing, build order.
**Out of scope:** visual design system details (colors, brand), marketing site.

---

## 1. Principles

1. **The server is the source of truth.** The client holds no business rules for money, approval, state transitions, or permissions. It displays what the API returns and calls action endpoints.
2. **Honest wording.** The UI never says "sent", "delivered", or "monitoring". It says what the product actually knows (see §11).
3. **Show why.** Every score, signal, and recommendation shows its reason, evidence, and data coverage.
4. **Spend is visible.** Paid actions are labeled, budget is always visible, and limits produce clear states, not silent failures.
5. **Fail soft.** Disabled capabilities, expired trial, exhausted budget, and provider errors each have a defined screen state with a next step.
6. **No secrets, no tokens in JavaScript.** Auth is an httpOnly cookie. The client never sees Apollo or LLM credentials.
7. **Request/response only.** No polling and no websockets in the MVP; data refreshes on navigation and after mutations.

---

## 2. Stack decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | React 18 SPA (Vite), **TypeScript** | MERN fit; no SSR needed for an authenticated app. (The tech spec allowed Next.js; not required for the MVP.) |
| Routing | React Router v6 (data router) | Route guards, nested layouts |
| Server state | TanStack Query v5 | Caching, invalidation, loading/error states |
| Forms | React Hook Form + Zod resolver | Mirrors server validation |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | Accessible components, fast to build |
| Icons / toasts / dates | lucide-react, sonner, date-fns | |
| Types | Shared enums and DTO types from a `shared/` package (see §3) | One source for enum values; prevents drift |
| Testing | Vitest, React Testing Library, MSW, Playwright | §14 |

Decision D24: SPA with Vite, not Next.js. Revisit only if SEO or SSR becomes a requirement.

---

## 3. Repository layout

```
bluecode-os/
├── shared/                      # enums + DTO types used by client and server
│   ├── enums.ts   dto.ts   permissions.ts (permission keys only)
├── server/
└── client/
    ├── index.html  vite.config.ts  tailwind.config.ts
    └── src/
        ├── main.tsx
        ├── app/
        │   ├── router.tsx       # route table, guards, layouts
        │   ├── providers.tsx    # QueryClient, Auth, Workspace, Toaster
        │   └── layouts/         # PublicLayout, AppLayout (sidebar + top bar + banners)
        ├── api/
        │   ├── client.ts        # fetch wrapper (§6)
        │   ├── errors.ts        # ApiError
        │   ├── queryKeys.ts
        │   └── endpoints/       # auth.ts startups.ts icps.ts prospects.ts contacts.ts
        │                        # campaigns.ts messages.ts activities.ts nextActions.ts usage.ts dashboard.ts
        ├── features/            # one folder per area: pages, components, hooks
        │   ├── auth/  workspace/  dashboard/  icps/  prospects/
        │   ├── contacts/  outreach/  activity/  nextActions/  usage/  settings/
        ├── components/
        │   ├── ui/              # shadcn primitives
        │   └── shared/          # ScoreBadge, StatusChip, EvidenceList, EmptyState, ErrorState,
        │                        # ConfirmDialog, PaidActionButton, CapabilityNotice, Money, DateTime
        ├── lib/
        │   ├── mailto.ts        # §9
        │   ├── format.ts        # paise → ₹, dates, counts
        │   ├── permissions.ts   # can(permission)
        │   └── wording.ts       # all status → label maps (§11)
        └── tests/
```

`shared/enums.ts` is the same enum list as `DB_ARCHITECTURE.md §6`. If the server and client live in separate repos, publish `shared/` as a small package or copy it in CI with a drift check.

---

## 4. Routes and guards

### 4.1 Route table

| Path | Page | Guard | Notes |
|---|---|---|---|
| `/login`, `/register` | Auth | Public (redirect if signed in) | |
| `/workspaces` | Workspace picker / create | Signed in | Shown when user has 0 or >1 active workspaces and none selected |
| `/` | Dashboard | Workspace | |
| `/icps` | ICP list | Workspace | |
| `/icps/new` | ICP builder (AI propose → edit → save) | Workspace, `icp:write` | |
| `/icps/:id` | ICP detail/edit | Workspace | |
| `/prospects` | Prospect list (ranked) | Workspace | Filters in URL |
| `/prospects/discover` | Run discovery for an ICP | Workspace, `prospect:search` | |
| `/prospects/:id` | Prospect detail (tabs) | Workspace | Tabs via `?tab=` |
| `/outreach` | Campaigns list | Workspace | |
| `/outreach/:campaignId` | Campaign detail: messages, approvals | Workspace | |
| `/outreach/messages/:id` | Message editor / approval / handoff | Workspace | |
| `/next-actions` | Recommendations | Workspace | |
| `/activity` | Timeline (filterable) | Workspace | |
| `/usage` | Usage and limits | Workspace | |
| `/settings` | Workspace settings, members | Workspace | Role-gated sections |
| `*` | Not found | | |

Navigation (sidebar): Dashboard · ICPs · Prospects · Outreach · Next actions · Activity · Usage · Settings. The tech spec's "Leads" and "Decision Makers" are views inside **Prospects** (ranked list; contacts tab). "Pipeline & Analytics" is the dashboard funnel only (MVP).

### 4.2 Guards (in order)
1. **AuthGuard:** `GET /auth/me` on load. `401` → `/login` (preserve `redirectTo`).
2. **WorkspaceGuard:** needs a selected workspace in `activeStartupId` that appears in `memberships`; otherwise `/workspaces`. A `403 NOT_A_MEMBER` clears the selection and redirects.
3. **PermissionGuard:** route-level check using `me.permissions` from the API (§5.3). UI hiding is a convenience; the server still enforces.
4. **TrialGuard (soft):** on `trial_expired` the app stays readable; write buttons are disabled with an explanation (§10).

---

## 5. Auth, workspace, and permissions

### 5.1 Session
- Login sets an httpOnly cookie; the client stores **nothing** secret. `AuthProvider` holds `user` and `memberships` from `/auth/me`.
- Logout calls `POST /auth/logout`, clears the query cache, and navigates to `/login`.
- Any `401` from any request triggers the global handler: clear cache, redirect to `/login`.

### 5.2 Active workspace
- `activeStartupId` is kept in React state and mirrored to `localStorage` (not secret; the server always verifies membership).
- The API client adds `X-Startup-Id: <activeStartupId>` to every tenant request.
- Switching workspace clears the entire query cache.

### 5.3 Permissions and capabilities (API additions required)
The client must not duplicate the permission matrix. It reads `me.permissions` and `capabilities` from `GET /startups/current` as defined in `API_CONTRACT.md` and decision D26 (API-1).

```ts
Startup.me:           { role, permissions: string[] }       // e.g. ['icp:write','message:approve',…]
Startup.capabilities: { searchOrgs: boolean, searchPeople: boolean, enrich: boolean }
```
- `can('message:approve')` reads `me.permissions`.
- `capabilities` lets the UI show a "not available" state **before** the user clicks (instead of discovering it from a `503`). The `503 CAPABILITY_DISABLED` response is still handled as a fallback.

---

## 6. API layer

### 6.1 Client wrapper (`api/client.ts`)
- Base URL `/api/v1` (Vite dev proxy to the server).
- Adds `credentials: 'include'`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`, and `X-Startup-Id` (except for `/auth/*`, `GET /startups`, `POST /startups`).
- Unwraps `{ data, meta }`. On a non-2xx response parses `{ error }` and throws `ApiError { status, code, message, details, requestId, retryAfter }`.
- `204` returns `undefined`.
- No automatic retries for mutations. Queries retry once for network errors only (never for `4xx`).

### 6.2 Global error handling (one place)

| Code | Behavior |
|---|---|
| `UNAUTHENTICATED` | Clear cache, redirect to login |
| `NOT_A_MEMBER` | Clear workspace selection, go to `/workspaces` |
| `TRIAL_EXPIRED` | Set app state `readOnly`; persistent banner (§10) |
| `BUDGET_EXHAUSTED` | Set `budgetBlocked`; persistent banner; paid buttons disabled |
| `PLAN_LIMIT_REACHED` | Inline message with `details` (metric, used, limit) |
| `CAPABILITY_DISABLED` | Inline `CapabilityNotice` with the fallback action |
| `RATE_LIMITED` | Toast with the `Retry-After` countdown; button disabled until then |
| `VALIDATION_FAILED` | Map `details[].path` onto form fields |
| `NOT_FOUND` | "Not found" state (no mention of other workspaces) |
| `INVALID_STATE` | Refetch the resource, toast "This item changed. Reloaded." |
| `PROVIDER_FAILED`, `INTERNAL` | Error state with "Try again" and the `requestId` |
| everything else | Toast with message |

### 6.3 Query keys and invalidation

Keys: `['startup']`, `['icps', filters]`, `['icp', id]`, `['prospects', filters]`, `['prospect', id]`, `['scores', prospectId, icpId]`, `['signals', prospectId]`, `['contacts', prospectId]`, `['campaigns', filters]`, `['campaign', id]`, `['messages', filters]`, `['message', id]`, `['activities', filters]`, `['nextActions', filters]`, `['usage']`, `['dashboard']`.

| Mutation | Invalidate |
|---|---|
| `POST /icps`, `PATCH /icps/:id`, archive | `icps`, `icp` |
| `POST /prospects/search` | `prospects`, `dashboard`, `usage` |
| select / disqualify / DNC | `prospects`, `prospect`, `dashboard` |
| score / explain | `scores`, `prospect`, `prospects`, `usage` |
| signals detect / interpret / dismiss | `signals`, `prospect`, `usage` |
| contacts search / enrich / manual add | `contacts`, `prospect`, `usage` |
| campaign actions | `campaigns`, `campaign`, `dashboard` |
| message draft / edit / approve / reject / handoff / mark-sent / cancel | `message`, `messages`, `campaign`, `dashboard`, `activities`, `usage` (draft) |
| `POST /activities/replies` | `activities`, `nextActions`, `prospect`, `dashboard`, `usage` |
| next action accept/dismiss/complete | `nextActions`, `dashboard` |

**Always invalidate `usage` after any 💰 call**, so the budget indicator is current.

### 6.4 Caching defaults
`staleTime` 30 s for lists, 60 s for details and usage, `gcTime` 5 min. `refetchOnWindowFocus` on for `nextActions` and `dashboard`, off elsewhere.

### 6.5 Mutation rules
- **No optimistic updates** for anything that costs money, changes approval, or changes state. Wait for the server response.
- Optimistic UI allowed only for non-critical toggles (e.g. dismissing a recommendation) with rollback on error.
- Every submit button disables while pending (prevents double-submits). Server idempotency is a second line of defense.

---

## 7. Global UI structure

### 7.1 `AppLayout`
```
┌────────────────────────────────────────────────────────────────────┐
│ Top bar: workspace switcher │ Trial: 11 days left │ Spend ₹36 / configured cap │ user menu │
├───────────┬────────────────────────────────────────────────────────┤
│ Sidebar   │  [Persistent banners: trial expired / budget reached]   │
│ Dashboard │                                                          │
│ ICPs      │  Page content                                            │
│ Prospects │                                                          │
│ Outreach  │                                                          │
│ Next act. │                                                          │
│ Activity  │                                                          │
│ Usage     │                                                          │
│ Settings  │                                                          │
└───────────┴────────────────────────────────────────────────────────┘
```
Spend and trial info come from `GET /usage/summary` (cached 60 s, invalidated after paid calls). On mobile the sidebar becomes a drawer.

### 7.2 Shared components

| Component | Purpose |
|---|---|
| `ScoreBadge` | Category chip (Hot/High/Medium/Low) + number; tooltip "Rules-based estimate"; "Limited data" chip when `coverage < 0.5` |
| `StatusChip` | Maps enum → label and color via `wording.ts` |
| `EvidenceList` | Shows signal evidence as `field: value` rows |
| `PaidActionButton` | Button with a small cost hint ("uses AI" / "uses Apollo credits"), disabled with a reason when `readOnly`, `budgetBlocked`, or capability is off |
| `CapabilityNotice` | "This feature isn't available right now" plus the fallback action |
| `EmptyState` / `ErrorState` | Consistent copy, icon, and one primary action |
| `ConfirmDialog` | For DNC, cancel campaign, clear DNC (reason required) |
| `Money` | Paise → `₹` format; always with "approx." where `costType='estimated'` |
| `PermissionGate` | Renders children only if `can(permission)`; otherwise nothing or a disabled variant |

---

## 8. Pages and flows

For each page: purpose, data, actions, and state handling. All lists are paginated (`limit` 20) with filters in the URL query string.

### 8.1 Auth and workspace
- **Register / Login:** forms with server validation mapping. After login → `/workspaces` or `/` if one workspace.
- **Workspace picker:** list of active memberships; "Create workspace" form (name) → `POST /startups` → select it. Creating starts a trial; show "15-day trial, usage limit ≈ ₹X" (value from `usage/summary` after creation).

### 8.2 Dashboard (`GET /dashboard`)
```
Welcome, ABC Technologies                       Trial: 11 days left
Today:  25 Prospects found | 12 Hot & High | 4 Drafts to approve | 6 Ready to open | 3 Follow-ups to consider
Top recommendations (up to 3)  →  [View all]
Pipeline (what we recorded): Discovered 25 → Selected 12 → With email 9 → Approved 6 → Opened in email 5 → Marked sent by you 3 → Replies logged 1
Usage: ₹36 of configured cap
```
- Empty state for a new workspace: a 3-step checklist (Create ICP → Discover prospects → Draft outreach) with links.
- The funnel labels use the honest wording (§11). There are no open or reply-rate charts.

### 8.3 ICP flow
- **List:** name, version, active flag, created date. Archive action. Plan limit shown ("1 of 1 ICPs").
- **Builder (`/icps/new`):**
  1. Step 1, Describe: product description (20–2000), geography, objective, notes → `POST /icps/propose` (💰 AI).
  2. Step 2, Review/edit: criteria as tag inputs per field, plus rationale text. The user can edit every field.
  3. Step 3, Save: name + `POST /icps`.
  - If the API returns `422` with missing information, show "Add more detail: …" using `details`.
  - A "Skip AI, enter manually" path exists so a failed LLM call never blocks ICP creation.
  - Banner reminder: "The AI suggestion is not saved until you confirm."
- **Edit:** changing criteria shows "This creates a new criteria version; existing scores keep the old version."

### 8.4 Discovery (`/prospects/discover`)
- Select an active ICP → "Find companies" (💰 Apollo).
- Results come one page at a time (25). Show a result summary: "18 new, 5 already known, 2 already known under another ICP (scored for this one)". "Load more" calls the next page.
- If `capabilities.searchOrgs` is false, the page shows: "Company discovery isn't available right now." (no fallback; there is no manual company import).
- The spend line below the button: "This search uses Apollo (no credits expected)"; leave the credit wording generic until Apollo verification.

### 8.5 Prospect list (`/prospects`)
Table: company, domain, industry, employees, country, **score badge (for selected ICP)**, status, signals count, contact count. Row click → detail.

Filters (URL-synced): ICP (origin) · "scored against" ICP · category (multi) · status · search text · "Show low-fit" toggle (default off, API `includeLow=false`) · sort (score, newest, name).

Bulk action: select rows → "Select for outreach" (`POST /prospects/select`, ≤ 50). The response's `skipped[]` is shown as a result dialog ("3 skipped: …").

### 8.6 Prospect detail (`/prospects/:id`)
Header: name, domain, status chip, score badge, "Mark do-not-contact" (confirm) / "Disqualify". Tabs:

| Tab | Content | Actions |
|---|---|---|
| **Overview** | Firmographics (only fields present; missing shown as "—"), origin ICP, all ICP scores | |
| **Score** | Latest score per ICP, **breakdown table** (component → points), coverage, explanation text with source label ("Rules" or "AI-written"), history list | "Explain with AI" (💰), "Re-score" |
| **Signals** | Signal cards: description, confidence, `EvidenceList`, detected date; stale chip; dismissed hidden by toggle | "Detect from data" (free), "Interpret with AI" (💰), "Dismiss". Empty copy: "No signals found in available data" |
| **Contacts** | Contact cards: name, title, email (if any) + "verified by Apollo" chip only when `emailVerified`, source chip (Apollo / Added by you) | "Find decision makers" (💰, `searchPeople`), "Enrich" (💰, `enrich`), "Add contact manually", "Mark do-not-contact" |
| **Outreach** | Messages for this prospect with status chips | "Draft message" (opens campaign picker) |
| **Activity** | Timeline for the prospect | "Log a reply" |

If `searchPeople` or `enrich` is off, the Contacts tab shows the `CapabilityNotice` with **"Add contact manually"** as the primary action.

### 8.7 Outreach: campaigns
- **List:** name, ICP, status chip, message counts, created date. "New campaign" (name + ICP; channel fixed to Email).
- **Campaign detail:**
  - Header: status chip and the allowed actions for the role (Submit for approval, Approve, Pause, Resume, Complete, Cancel; buttons shown from the current status).
  - Helper text on `active`: "Active means at least one message was handed off to your email app. BlueCode doesn't send emails or schedule follow-ups."
  - Message table: contact, step, status chip, approval chip, revision.
  - "Add draft": pick a contact (only those with an email and not DNC; others listed disabled with the reason) and a step (1–5).

### 8.8 Message editor (`/outreach/messages/:id`), the most important screen
```
Draft for Sarah Jones (HR Director, ABC Ltd)        Step 1 · Revision 2
Status: Draft · Awaiting approval
Subject  [__________________________________]        (≤ 200)
Body     [                                   ]        (≤ 5000)
         Based on: • 250 employees (firmographics.employeeCount)   ← facts used
[Save changes]  [Regenerate with AI 💰]    Note: editing or regenerating resets approval.
─────────────────────────────────────────────────────────────────────
Approval:  [Approve] [Request revision] [Reject]       (admin/owner)
Send:      [Open in my email app]  (enabled only when Approved · Ready)
```
- **Edit rules reflected in UI:** saving a change calls `PATCH`; the response returns `approvalStatus='pending'`/`status='draft'`, and the UI shows "Approval was reset because you edited the message".
- **Regenerate** is disabled once approved ("Edit the message to reset approval first" is *not* offered; regeneration after approval is not allowed by the API).
- **Do-not-contact:** if the prospect or contact is DNC, the page shows a blocked state and no handoff button.
- After approval: **"Open in my email app"** → handoff flow (§9).

### 8.9 Log a reply
Modal from the prospect Activity tab or message page: paste the reply, optionally choose the related message → `POST /activities/replies` (💰 AI).
Result panel shows: the classification (intent chip + confidence) or "We couldn't classify this reply. It was saved.", plus effects: "Marked do-not-contact" (for unsubscribes) and "Recommendation created: …".
Copy: "You pasted this reply. BlueCode doesn't read your inbox."

### 8.10 Next actions (`/next-actions`)
Cards by priority: title, reason, prospect link, due date, actions **Accept** (routes the user to the relevant screen: a prospect, message editor, or reply logger), **Dismiss**, **Mark done**. Header note: "Recommendations are computed when you open this page. BlueCode doesn't send follow-ups or book meetings for you."

### 8.11 Activity
Filterable timeline (prospect, type, date range). Each item shows type label, summary, time, and a source chip ("Manual" / "Opened in email app" / "System").

### 8.12 Usage (`/usage`)
Spend bar (committed vs cap, labeled "approx."), trial days left, entitlements table (used / limit), recent usage records table (operation, status, cost type). Blocked entries (`status='blocked'`) shown with an explanation.

### 8.13 Settings
- **Workspace:** name, sender name/title, product summary, calendar link (https only). Helper: "Used when drafting emails." (`workspace:settings`)
- **Members:** list, invite by email (existing users only, with the clear error "No account for this email yet"), change role, remove (`member:invite` / `member:role`).
- Plan section is read-only in the MVP (shows plan name and limits).

---

## 9. The `mailto:` handoff (`lib/mailto.ts`)

### 9.1 Flow
1. User clicks **Open in my email app** → `POST /messages/:id/handoff`.
2. On success the API returns `{ message, handoff: { to, subject, body } }` and has recorded `handoff_requested`.
3. Client builds the link and navigates:
```ts
const mailto = `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body.replace(/\r?\n/g, '\r\n'))}`;
// enc = encodeURIComponent
```
4. **Length guard:** if `mailto.length > 1800` (browser/OS limits vary), open `mailto:{to}?subject=…` **without the body**, copy the body to the clipboard, and show "The email is long. We copied the body. Paste it into your email."
5. A confirmation panel appears (stays until dismissed):
   > **We opened your email app.** BlueCode can't tell whether you sent it.
   > [I sent it] [Copy email text] [I didn't send it]

### 9.2 Buttons
- **I sent it** → `POST /messages/:id/mark-sent` → status "Marked sent by you".
- **Copy email text** → copies `To`, `Subject`, and body.
- **I didn't send it** → just closes the panel; the message stays "Opened in email app" and the user can open it again later.

### 9.3 Edge cases
- No mail client configured (browser does nothing): the confirmation panel still appears, so "Copy email text" is the fallback. Add help text: "Nothing opened? Copy the text and paste it into your email."
- Popup/navigation blockers: use an `<a href=mailto:>` programmatic click inside the user-gesture handler, after the `await`ed API call succeeds (store the result and trigger from a visible "Open email app" button if the browser blocks the automatic navigation).
- Never include the contact's email in URLs of our app or in analytics events.
- Webmail deep links (e.g. Gmail compose) are **not** part of the MVP; the user chose `mailto:`. Listed as an open item (§16).

---

## 10. Global states and banners

| State | Source | UI |
|---|---|---|
| `trial_expired` | `Startup.status` or `TRIAL_EXPIRED` | Persistent banner: "Your trial has ended. You can view your data but can't run new searches or drafts." Write buttons disabled with tooltip. |
| `budgetBlocked` | `BUDGET_EXHAUSTED` or `remainingPaise` too low for a paid action | Banner: "You've reached this workspace's usage limit." `PaidActionButton`s disabled. Free actions still work. |
| `capabilityDisabled` | `Startup.capabilities` or `503` | Inline `CapabilityNotice` where the feature would be |
| `rateLimited` | `429` | Toast with countdown; disabled button |
| Offline / network error | fetch failure | Toast "Can't reach the server" + retry on the query's error state |

Low-budget hint: when `remainingPaise < 20%` of the cap, show an amber chip in the top bar.

---

## 11. Honest-wording map (`lib/wording.ts`)

All labels come from this file so copy cannot drift.

| Enum / event | UI label | Never say |
|---|---|---|
| message `draft` + approval `pending` | "Draft · awaiting approval" | |
| approval `revision_requested` | "Changes requested" | |
| approval `rejected` | "Rejected" | |
| message `ready` | "Approved · ready to open in email" | "Queued" |
| message `handed_off` | "Opened in your email app" | "Sent", "Delivered" |
| message `user_reported_sent` | "Marked sent by you" | "Sent" (without "by you"), "Delivered" |
| message `cancelled` | "Cancelled" | |
| campaign `active` | "Active (a message was handed off)" | "Running", "Sending" |
| activity `handoff_requested` | "Opened email app" | |
| activity `reply_logged` | "Reply added by you" | "Reply received" |
| score | "Fit score (estimate)" | "Prediction", "Likelihood to buy" |
| signal | "Possible signal" | "Buying intent confirmed" |
| next action | "Recommendation" | "Automatic follow-up" |
| cost | "≈ ₹36" | "Charged ₹36" |
| contact `emailVerified=true` | "Verified by Apollo" | |
| contact `emailVerified` absent/false | "Not verified" | |
| dashboard funnel stages | Discovered · Selected · With email · Approved · Opened in email · Marked sent by you · Replies added | "Delivered", "Opened by recipient", "Reply rate" |

---

## 12. Forms and validation

- Every form uses a Zod schema mirroring the server limits in `DB_ARCHITECTURE.md §3.4` (name 1–80, subject ≤ 200, body 1–5000, replies ≤ 5000, etc.). The client validation is for UX; the server stays authoritative.
- `VALIDATION_FAILED` `details[].path` maps to field names (e.g. `criteria.industries[0]`).
- Tag inputs for ICP lists enforce ≤ 25 items of ≤ 80 chars with inline counters.
- Unsaved-changes guard on the ICP editor and message editor.
- Dates shown in the user's local timezone; ISO UTC from the API.

---

## 13. Accessibility, responsiveness, performance

- Radix/shadcn primitives for focus management; all icon-only buttons have `aria-label`; chips never rely on color alone (text label always present).
- Keyboard: tables navigable, dialogs trap focus, `Esc` closes.
- Responsive: desktop first; sidebar becomes a drawer below 1024 px; tables become cards below 640 px.
- Performance: route-level code splitting (`React.lazy`), list virtualization not needed at MVP sizes (≤ 100 per page), debounce search inputs (300 ms).
- English only for the MVP; keep strings in `wording.ts` and component-level constants so i18n can be added later.

---

## 14. Security

- Auth cookie is httpOnly; no tokens in `localStorage`, `sessionStorage`, or JS variables.
- Always send `X-Requested-With`; the API also checks `Origin`.
- Render all server and AI text as plain text. **No `dangerouslySetInnerHTML`.** Linkify only the startup's own calendar link if shown.
- External links use `rel="noopener noreferrer"`.
- Never log message bodies, contact emails, or reply text to the console or any analytics tool. Analytics (if any) are limited to page names and non-identifying event names.
- Content Security Policy via the hosting layer (no inline scripts); the API origin is the only `connect-src`.
- Do not store API errors containing `requestId` beyond display.

---

## 15. Testing

| Level | What |
|---|---|
| Unit | `mailto.ts` (encoding, newline handling, length guard), `format.ts`, `wording.ts` coverage (every enum value has a label), `can()` |
| Component | `ScoreBadge`, `PaidActionButton` states, `CapabilityNotice`, message editor reset-approval behavior, ICP builder steps, reply-log result panel |
| API-layer | `ApiError` parsing for every code in the registry; global handler actions per code (MSW) |
| E2E (Playwright, against the mock Apollo/LLM backend) | Register → create workspace → ICP builder → discover → select → add contact manually → draft → edit (approval resets) → approve → open email (handoff) → mark sent → log reply (unsubscribe → DNC) → next actions; trial-expired read-only mode; budget-exhausted mode; disabled-capability mode |
| Wording lint | Test that no UI string contains forbidden words ("Delivered", "Sent" without "by you", "Running") outside an allowlist |
| Accessibility | axe checks on key pages |

The backend runs in `APOLLO_MODE=mock` and `LLM_MODE=mock` for all E2E tests.

---

## 16. Build order (aligned with backend milestones)

| Frontend step | Needs backend | Deliverable |
|---|---|---|
| F1 Foundation | M1 | Vite app, providers, API client, auth pages, workspace picker, layout, banners |
| F2 ICP | M2 | ICP list, builder with AI propose, usage bar |
| F3 Discovery | M3 | Discover page, prospect list and filters |
| F4 Qualification | M4 | Prospect detail (overview, score, signals, contacts, manual add) |
| F5 Outreach | M5 | Campaigns, message editor, approval, `mailto:` handoff, mark-sent |
| F6 Activity | M6 | Reply logger, next actions, dashboard, activity timeline |
| F7 Hardening | M7 | Accessibility, E2E suite, wording lint, error-state audit |

With MSW fixtures built from `API_CONTRACT.md`, F1 to F2 can start before the backend is finished.

---

## 17. Open items

1. **API-1 / D26:** `GET /startups/current` already specifies `me.permissions` and `capabilities` in `API_CONTRACT.md`. This is a contract requirement to implement and test, not a pending API-doc addition.
2. **Webmail fallback:** decide whether to add "Open in Gmail/Outlook" compose links later. Not in the MVP, because `mailto:` is the frozen decision.
3. **Brand and design tokens:** colors, typography, logo. The component structure does not depend on them.
4. **Shared package:** decide whether `shared/` lives in the same repo (recommended) or is published separately.
5. **Analytics:** decide whether any product analytics are used; if so, restrict to non-identifying events (§14).
6. After approval, generate TypeScript types from the contract (`openapi.yaml`) and compare them with `shared/dto.ts` in CI.