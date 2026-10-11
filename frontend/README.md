# BlueCode OS — Frontend MVP Preview

React + TypeScript + Vite frontend based on the supplied Figma Make review ZIP and the frozen BlueCode OS API contract. This is a live-API client, not a demo with fabricated sales records.

## Requirements

- Node.js 20+ (Node 22 recommended)
- A running BlueCode OS backend at `http://localhost:4000` or the URL configured through `VITE_API_ORIGIN`

## Start locally

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. Ensure the backend `CLIENT_ORIGIN`/CORS configuration allows this exact origin. In PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`.

## Quality commands

```bash
npm run typecheck
npm run build
npm run preview
```

Dependencies were not installed in the authoring environment, so build/typecheck still need to be run after `npm install`.

## Included routes and screens

- `/login` and `/register` — cookie-backed auth
- `/workspaces` — choose or create a workspace
- `/dashboard` — API-reported overview, recorded funnel and next actions
- `/icps`, `/icps/new`, `/icps/:id` — ICP list, proposal preview, manual criteria edit, save/archive
- `/prospects`, `/prospects/discover`, `/prospects/:id` — stored prospects, disabled-discovery explanation, detail tabs for overview, score, signals, contacts, outreach, and activity
- `/outreach`, `/outreach/:campaignId`, `/outreach/messages`, `/outreach/messages/:id` — campaigns, draft editor, approval, `mailto:` handoff, founder-reported mark-sent
- `/next-actions` — accept/dismiss/complete recommendations
- `/activity` — recorded timeline and manual pasted-reply logging
- `/usage` — usage summary and ledger, without guessed caps
- `/settings` — read-only workspace, permissions and provider capabilities

The visual style follows the supplied reference: navy sidebar, white data surfaces, measured blue action color, restrained badges, clean tables, and responsive navigation.

## Contract and safety notes

- All API requests use `credentials: 'include'`; the browser never reads or stores the session JWT. The client adds `X-Requested-With: XMLHttpRequest` to non-GET operations and `x-startup-id` to tenant-scoped requests.
- The active workspace ID is held in `sessionStorage`; this is not an authentication token. Workspace permissions remain server-authoritative.
- Live Apollo discovery, people search and enrichment remain disabled unless the backend reports them enabled; the UI does not synthesize provider results.
- Mock ICP/message generation is described as preview content and must be reviewed. Numeric scoring is displayed as an estimate.
- Outreach is draft → human approval → email-app handoff. No server-side sending, inbox sync, delivery tracking, or automatic follow-up is implemented. “I sent it” records the founder's report only.
- Spend caps/entitlements are read from API configuration and are not hard-coded in the UI.
- Workspace settings and member changes are read-only because the frozen contract does not expose corresponding write routes.

### Backend contract discrepancy to resolve

`docs/API_CONTRACT.md` documents `POST /api/v1/prospects/:id/scores/explain`, but the current `backend/src/routes/scoring.routes.ts` registers only score-batch and score-history routes. The UI calls the documented route and displays the backend error instead of fabricating an explanation until the backend route is implemented and tested.

## Directory

```text
frontend/
├── src/
│   ├── api.ts        # credentials, tenant/CSRF headers, response/error handling
│   ├── App.tsx       # page routing, shared components and MVP screens
│   ├── index.css     # visual system, desktop and responsive styles
│   ├── main.tsx      # React entry point
│   └── vite-env.d.ts
├── public/favicon.svg
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Implementation status

This is the first complete MVP-preview UI pass, covering the main page inventory and core user journeys. Before treating it as release-ready:

1. Run `npm install`, `npm run typecheck`, and `npm run build` in an environment with package-registry access.
2. Start the backend with the owner's intended local environment and test the cookie/CORS flow through register, login, workspace creation, ICP save, stored-prospect filters, manual contact creation, campaign/message approval, `mailto:` handoff, reply logging, and usage ledger.
3. Implement and test the score-explanation route already specified in `docs/API_CONTRACT.md`. The current `backend/src/routes/scoring.routes.ts` snapshot does not register that route, so the UI intentionally leaves the action disabled rather than calling an absent endpoint.
4. Recheck the page states against the frozen API contract when the backend changes. Do not turn mock fixtures into claims of live AI or provider output.

This package was source-checked with TypeScript syntax transpilation and a temporary structural type stub, but it was **not** fully typechecked or browser-built against installed React/Vite dependencies because dependency installation timed out in the authoring environment. No backend/API integration tests have been run here.
