# Backend Architecture & Engineering Notes

## Request lifecycle

1. Request context assigns/propagates `x-request-id`.
2. Helmet, CORS and bounded body parsers run.
3. API-wide rate limiting applies to `/api/*`; authentication routes receive a stricter limiter.
4. Bootstrap registry mounts feature routers.
5. Authentication verifies HS256 signature, issuer, audience and required claims.
6. Feature handlers validate input and scope data to `req.user.startupId`.
7. Central not-found and error middleware return a stable error envelope.

## Error contract

```json
{
  "success": false,
  "error": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "details": {},
  "requestId": "uuid"
}
```

Successful response shapes are intentionally retained to avoid breaking the current React application. Errors use a string `error` field for compatibility with the existing frontend, a machine-readable top-level `code`, optional `details`, and `requestId`. Route-local errors should use `HttpError` or flow through the central error handler.

## Adding a module

- Add `src/modules/<feature>/routes/index.js`.
- Keep feature registration in `src/bootstrap/modules.js`.
- Use shared `wrap`, `parse`, `ok`, `findOwned` helpers.
- Scope all tenant records with `req.user.startupId`.
- Add/update OpenAPI paths in `src/docs-openapi.js`.
- Add tests for validation, access control, tenant isolation and success paths.
