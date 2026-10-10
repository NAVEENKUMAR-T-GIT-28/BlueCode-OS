# BlueCode OS — Decision Log

One row per decision. Never delete rows; supersede them. Dates are ISO.

| ID | Date | Decision | Status | Reason | Revisit when |
|---|---|---|---|---|---|
| D1 | 2026-10-10 | Pilot uses one server-side Apollo key behind a `credentialProvider` | **Proposed (risk open)** | Fastest for pilot | Before any non-founder customer; needs Apollo answers C1–C3 (`APOLLO_INTEGRATION.md §4`) |
| D2 | 2026-10-10 | Outbound is `mailto:` handoff only; no server-side sending | **Accepted / Frozen for MVP** (confirmed by product owner) | Observable, low-risk. Verifying Apollo sequences later does **not** reopen this; it requires a deliberate product-scope change | Only by explicit product-scope decision |
| D3 | 2026-10-10 | No job queue and no scheduled jobs; time rules evaluated lazily | Accepted | Smaller MVP, fewer failure modes | Activity sync or multi-instance deployment |
| D4 | 2026-10-10 | Money stored as integer paise (INR) | Accepted | No float errors | Multi-currency billing |
| D5 | 2026-10-10 | Trial cap from config, default ₹250 (25000 paise) | **Pending owner freeze** | Docs conflict (₹1,000 vs ₹250); config makes it trivial to change | Pilot cost data |
| D6 | 2026-10-10 | Lead score is deterministic; LLM writes explanation only | Accepted | Reproducible, cheap, comparable | Evidence AI adjustment improves outcomes |
| D7 | 2026-10-10 | JWT in httpOnly cookie, 24 h, key-rotation list, membership checked every request | Accepted | No extra collection | Mobile/SSO |
| D8 | 2026-10-10 | MongoDB runs as a (single-node) replica set | Accepted | Transactions for workspace creation and usage commit | n/a |
| D9 | 2026-10-10 | API base `/api/v1`; one error registry; 402 for plan/budget, 429 for request rate only | Accepted | Consistency across backend, API doc, frontend | If product prefers 429 for budget, change registry + tests only |
| D10 | 2026-10-10 | One prospect per company per startup; `prospects.icpId` is the immutable origin ICP; scores are per-ICP | Accepted | Fits current schema without a many-to-many collection | Per-ICP pipeline tracking needed (Growth/Pro multi-ICP) |
| D11 | 2026-10-10 | Missing score components are excluded and rescaled; `coverage` stored; coverage < 0.5 caps category at `medium` | Accepted | Fair to sparse data, honest about confidence | Scoring review after pilot |
| D12 | 2026-10-10 | Reply handling in MVP is founder-pasted (`logReply`); no automatic reply retrieval | Accepted | `reply_read` capability unverified | `reply_read` VERIFIED |
| D13 | 2026-10-10 | Estimated spend after provider timeout is committed (conservative) | Accepted | Provider may have charged | If Apollo exposes reliable usage reads |
| D14 | 2026-10-10 | Signal evidence: `{field, value}`; `field` from allowlist `EVIDENCE_PATHS`; AI references fields by name (`evidenceFields`); value copied from stored data | Accepted | One format across DB, backend, API | New Apollo fields verified |
| D15 | 2026-10-10 | Draft idempotency key `draft:{campaignId}:{decisionMakerId}:{step}`; unique index; regeneration rewrites same row (`revision`); in-process single-flight plus duplicate-key backstop | Accepted | One row and one LLM call under concurrency | Multi-instance deployment |
| D16 | 2026-10-10 | Campaign `active` = at least one message handed off; product-side label only | Accepted | Avoid implying running sequences | n/a |
| D17 | 2026-10-10 | No manual company import; discovery is unavailable when `search_orgs` is disabled | Accepted | Fallback not designed; avoid promising it | Product wants a CSV import feature |
| D18 | 2026-10-10 | Schema enums hold MVP values only; future values added by migration; `DB_ARCHITECTURE.md` v2.0 is the single schema source | Accepted | Remove drift | n/a |
| D19 | 2026-10-10 | Next-best actions and follow-up prompts are recommendations computed on page open; no automatic follow-up, reply detection, or booking | Accepted | Matches no-jobs MVP | Activity sync approved |
| D20 | 2026-10-10 | LLM receives minimized data only (no emails, LinkedIn URLs, IDs); `classify_reply` receives pasted reply text | Accepted | Privacy and cost | Provider/data-control change |
| D21 | 2026-10-10 | Drafts carry a fixed server-side opt-out footer (`DRAFT_OPT_OUT_LINE`), not model-generated | Proposed | Model cannot omit or alter it; wording needs compliance review | After compliance check |
| D22 | 2026-10-10 | Unsubscribe is detected by a keyword pre-check that overrides the LLM; failed classification still stores the reply | Accepted | Safety rule must not depend on the model | n/a |
| D23 | 2026-10-10 | At most one LLM repair attempt per request, recorded as a separate ledger row; no retry after timeout | Accepted | Bounded, honest cost | Cost data from pilot |
| D24 | 2026-10-10 | Frontend is a React 18 + Vite + TypeScript SPA with React Router, TanStack Query, Tailwind/shadcn; not Next.js | Accepted | No SSR/SEO need for an authenticated app | SEO or SSR requirement |
| D25 | 2026-10-10 | `shared/` package holds enums and DTO types for client and server | Proposed | Prevents enum and contract drift | Separate repos |
| D26 | 2026-10-10 | `GET /startups/current` returns `me.permissions` and `capabilities` so the client never duplicates the permission matrix | Accepted (API-1) | Single source of truth; avoids discovering disabled features by error | n/a |
| D27 | 2026-10-10 | No optimistic updates for paid, approval, or state-changing actions | Accepted | Server is source of truth | n/a |
| D28 | 2026-10-10 | Test environment registers a Mongoose plugin that throws when a tenant-owned query lacks `startupId` | Accepted | Structural guard against future isolation bugs | n/a |
| D29 | 2026-10-10 | Tenant isolation, budget, draft/approval/handoff, AI safety, and unsubscribe suites are merge-blocking in CI | Accepted | Audit requirement: tests must exist in code | n/a |
| D30 | 2026-10-10 | Server never fetches user-supplied URLs (`linkedinUrl`, `calendarLink` are stored and displayed only) | Accepted | Removes SSRF class | A feature that needs fetching |