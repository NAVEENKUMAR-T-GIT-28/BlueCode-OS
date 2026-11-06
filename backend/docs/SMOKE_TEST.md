# Backend Smoke Test

1. `pnpm install`
2. `pnpm check`
3. `pnpm test`
4. `pnpm run openapi:validate`
5. Configure `.env` and run `pnpm run dev`.
6. `GET /api/health` returns `200`.
7. `GET /api/ready` returns `200` only when Supabase is reachable.
8. Open `/reference`; inspect generated OpenAPI operations.
9. Register a test account, then authorize Scalar with the returned JWT.
10. Verify `/api/auth/me`, startup, ICP, prospects, outreach and dashboard.
11. Create two independent test tenants. Confirm tenant A cannot read, update or delete tenant B records by substituting IDs.
12. Verify missing/expired tokens return `401`, insufficient roles return `403`, invalid payloads return `400`, and repeated auth attempts are rate limited.
13. Confirm `x-request-id` is present in API responses and error bodies.
