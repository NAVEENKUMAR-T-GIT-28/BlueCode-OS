# BlueCode OS frontend — handoff status

## Included

- Standalone React + TypeScript + Vite app in `frontend/`.
- Login/register via httpOnly-cookie API contract; no JWT in browser storage.
- Workspace selection and creation; selected tenant header on scoped calls.
- Responsive app shell and consistent navy/white/blue visual system based on the supplied UI/UX review ZIP.
- Dashboard, ICP list/create/edit/archive/proposal, prospects list/filter/selection/scoring, discovery-unavailable state, prospect overview/scoring/signals/contacts/outreach/activity tabs, campaign flows, message editor/review/handoff, next actions, activity/reply logging, usage ledger, and read-only settings/capabilities.
- Explicit warning states for disabled Apollo/LLM capabilities and truthful wording for email handoff and founder-reported sending.
- Top-bar usage context that does not hard-code a trial cap or entitlement.

## Verified in this session

- TypeScript syntax transpilation: `App.tsx`, `api.ts`, and `main.tsx` pass.
- Internal structural check with temporary React/Vite declaration stubs passes. This is not a substitute for official package type definitions.
- The production TypeScript check was attempted and could not resolve `@types/node` or `vite/client` because npm dependencies were not installed. `npm install --no-audit --no-fund` timed out in this environment.
- The remote GitHub write integration denied branch creation (`403 Resource not accessible by integration`), so this package has not been committed or pushed.

## Explicit integration blocker

The frozen contract documents `POST /api/v1/prospects/:id/scores/explain`, but the current source at `backend/src/routes/scoring.routes.ts` registers only `POST /prospects/score` and `GET /prospects/:id/scores`. The frontend's explanation action is therefore disabled until the backend route and tests are present.

## Not represented as available

- Live Apollo company discovery, people search, and enrichment when API capability flags are false.
- Inbox synchronization, automatic email sending, recipient open/delivery tracking, scheduled follow-up, calendar booking, or automatic reply detection.
- Editable workspace/member settings, because no corresponding write endpoints exist in the frozen API contract.
- Fixed spend/entitlement numbers that the owner has not approved.

## Local integration

Copy the `frontend/` directory into the repository root. Run `npm install`, copy `.env.example` to `.env.local`, make backend `CLIENT_ORIGIN` match `http://localhost:5173`, then run `npm run dev`. See `frontend/README.md` for detail.
