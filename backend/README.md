# BlueCode OS Backend

JavaScript ES modules · Node.js 20+ · Express 4 · Supabase PostgreSQL · Scalar API Reference.

## Run locally

```bash
cp .env.example .env
# Fill JWT_SECRET (32+ random characters), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run check
npm test
npm run openapi:validate
npm run dev
```

- Liveness: `GET http://localhost:4000/api/health`
- Readiness (checks Supabase): `GET http://localhost:4000/api/ready`
- OpenAPI JSON: `GET http://localhost:4000/openapi.json`
- Interactive Scalar API client: `http://localhost:4000/reference`

Run `supabase/migrations/0001_initial_schema.sql` once against the intended Supabase project. Back up an existing database and review the migration before applying it.

## Architecture

```text
src/
├── app.js                         # Express composition root
├── server.js                      # Startup, shutdown and process handlers
├── bootstrap/modules.js            # Feature router registration
├── config/env.js                  # Required environment validation
├── core/                           # Errors and security/request middleware
├── infrastructure/database/       # Supabase service client
├── modules/                        # auth, workspace, startup, icp, prospects,
│                                   # outreach, dashboard, integrations
├── shared/                         # Common helpers and workspace mapping
└── docs-openapi.js                 # OpenAPI 3.0 spec consumed by Scalar
```

Each feature router is mounted by the bootstrap registry. Existing API paths are preserved. Route handlers currently contain portions of application orchestration and Supabase access; further extraction into per-feature controllers, services and repositories is a planned internal refactor, not something to assume is already complete.

## Security model

- JWTs use HS256 with explicit issuer and audience validation. Existing sessions issued by an older JWT configuration may need users to sign in again.
- `sub`, `sid` and `role` are required claims. The startup/tenant ID is always taken from the verified token, not from request input.
- The Supabase service-role key is server-only and bypasses RLS. Every protected query MUST constrain records by the authenticated `startupId` or prove ownership before accessing dependent rows.
- `requireRole('owner', 'admin')` is available for role-gated operations. Apply it to administrative mutations; do not rely on frontend visibility.
- Global API and stricter auth rate limits use the Express in-memory store. For multi-instance production deployments, replace this with a shared Redis-compatible store before scaling horizontally.
- CORS is allow-list based in production. Set `TRUST_PROXY=true` only behind a trusted reverse proxy.
- JSON and URL-encoded payloads are limited to 1 MB. Helmet and request IDs are enabled.
- Access tokens are stateless until expiry. Refresh-token rotation and server-side revocation are not implemented yet; logout remains client-side token removal.
- `/api/ready` checks the Supabase dependency. Do not expose database credentials or internal error stacks in client responses.

## API documentation

The OpenAPI 3.0 document is maintained in `src/docs-openapi.js`; Scalar renders it at `/reference`. When adding or changing a route, update both the route and OpenAPI spec. `npm run openapi:validate` checks structural completeness; it does not prove that a live route behaves as documented.

See `docs/API.md` for the endpoint inventory and `docs/SMOKE_TEST.md` for manual verification.

## Current scope

No Hunter, AI/LLM, email delivery/mailbox, payments or calendar provider calls are made. Their routes report unconfigured or return 501. Usage reporting exists but quota enforcement is not complete.
