# BlueCode OS — M6 API Addendum: Contacts & Signals

Base URL: `http://localhost:4000`. All routes require the `bc_session` cookie and `x-startup-id`, except where standard middleware rejects earlier. Use `Origin` matching `CLIENT_ORIGIN`; non-GET requests require `X-Requested-With: XMLHttpRequest`.

## Contacts

### `GET /api/v1/prospects/:id/decision-makers`
No body. Returns `200 { "data": DecisionMaker[] }`.

### `POST /api/v1/prospects/:id/decision-makers`
Manual contact add. Required body:
```json
{
  "fullName": "Pat Lee",
  "jobTitle": "CTO",
  "businessEmail": "pat@example.com",
  "linkedinUrl": "https://www.linkedin.com/in/pat"
}
```
`fullName` 1–120 chars, `jobTitle` optional up to 120, `businessEmail` required and valid, `linkedinUrl` optional HTTP(S). Server sets `source="manual"`, `emailVerified=false`, and `outreachStatus="not_contacted"`. Returns `201`. Duplicate email on the same prospect: `409 CONFLICT`. DNC prospect: `409 DO_NOT_CONTACT`.

### `POST /api/v1/prospects/:id/decision-makers/search`
No body. Returns `503 CAPABILITY_DISABLED` until Apollo `search_people` is verified/enabled.

### `POST /api/v1/decision-makers/:id/enrich`
No body. Returns `503 CAPABILITY_DISABLED` until Apollo `enrich` is verified/enabled.

### `POST /api/v1/decision-makers/:id/do-not-contact`
No body. Marks the tenant-scoped contact `outreachStatus="do_not_contact"`. Returns `200`.

## Signals

### `GET /api/v1/prospects/:id/signals`
Optional query `status=active|dismissed|stale`. A stored active signal older than 45 days is returned with derived status `stale`.

### `POST /api/v1/prospects/:id/signals/detect`
No body. Applies deterministic rules to fields already stored on the tenant-scoped prospect. Returns `200 { "data": { "created": number, "signals": Signal[], "message"?: string } }`. The current conservative rule may create a `technology` signal from recorded `firmographics.technologies`; it does not infer growth/funding or confirmed purchase intent. Repeated identical evidence is deduplicated.

### `POST /api/v1/prospects/:id/signals/interpret`
No body. Returns `503 CAPABILITY_DISABLED` until the AI runtime is implemented/configured.

### `POST /api/v1/signals/:id/dismiss`
No body. Marks a tenant-scoped signal `dismissed`, preserving its evidence. Returns `200`.

Errors follow the main `API_CONTRACT.md` registry: malformed IDs `400 MALFORMED_REQUEST`, foreign/missing records `404 NOT_FOUND`, duplicates/state conflicts `409`, invalid body/query `422 VALIDATION_FAILED`, and disabled provider features `503 CAPABILITY_DISABLED`.
