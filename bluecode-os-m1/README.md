# BlueCode OS — M1 Backend Foundation

This is the first implementation slice for the frozen BlueCode OS MVP. It follows the current
`docs/DB_ARCHITECTURE.md`, `docs/BACKEND_ARCHITECTURE.md`, and `docs/API_CONTRACT.md`.

## Included
- Node.js 20, Express, TypeScript, Mongoose, Zod
- Environment validation; no hard-coded trial spend-cap default
- Request IDs, common response envelopes, centralized API errors
- User registration/login/logout/me using an httpOnly JWT cookie
- Startup creation/list/current workspace selection
- Active `startupMembers` membership checks on tenant routes
- Transactional startup + owner membership creation
- Initial Mongoose models for `users`, `startups`, and `startupMembers`
- Basic auth/API tests and local setup instructions

## Not included yet
ICP, Apollo, scoring, signals, campaigns, LLM, usage reservation, frontend, and the remaining ten
models are later implementation milestones. Apollo capability flags stay disabled. This slice does
not claim those features or tests are complete.

## Important configuration
`TRIAL_SPEND_CAP_PAISE` is intentionally required. The owner has not frozen the value in D5, so the
server must not silently choose ₹250 or ₹1,000. Set it explicitly in `.env` before starting.

## Local development
1. Use Node.js 20+ and MongoDB running as a replica set (a single-node replica set is sufficient).
2. Copy `.env.example` to `.env` and set every required value.
3. Run `npm install`.
4. Run `npm run dev`.
5. Run tests with `npm test`; type-check with `npm run typecheck`.

No tests are represented as passing until they are run in an installed environment.
