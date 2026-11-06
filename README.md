# BlueCode OS — Integrated MVP

This repository combines the existing React frontend and Express/Supabase backend into one project.

## Project structure
- `frontend/` — React 18 + Vite + React Router + Tailwind + Axios.
- `backend/` — Node.js 20 + Express + Supabase JS + custom JWT authentication.
- `backend/supabase/migrations/0001_initial_schema.sql` — consolidated initial database schema and workspace compatibility columns.

## Run locally
### 1. Supabase
Create a Supabase project. Open SQL Editor and run the complete file:
`backend/supabase/migrations/0001_initial_schema.sql`

Run it once on a new/empty database. Do not separately run the old `schema.original.sql` or `migration_002_workspace_adapter.original.sql`; they are retained only as source references.

### 2. Backend
```bash
cd backend
cp .env.example .env
# Fill JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run check
npm run dev
```

### 3. Frontend
In another terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend default: `http://localhost:5173`  
Backend default: `http://localhost:4000/api`

## Important security notes
- Never commit `.env` files.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend environment variables.
- Custom JWT authentication is retained to match the existing Axios frontend integration. JWT logout is client-side only in this MVP; tokens remain valid until expiry.
- All tenant-scoped backend queries must use the verified `startupId` from the JWT. The service-role key bypasses Supabase RLS, so backend ownership checks are mandatory.
- External LLM, Hunter, email, payments, and calendar integrations are intentionally not implemented.

## Verification status
Source packages and project structure are assembled. Static Node syntax checks are included. A real database integration test requires your Supabase project credentials and must be run in your environment. Do not consider the project production-ready until the smoke-test checklist in `backend/docs/SMOKE_TEST.md` passes.
