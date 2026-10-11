# BlueCode OS — M7 Usage API Addendum

Base URL: `http://localhost:4000`. Both endpoints require `bc_session`, `x-startup-id`, and `workspace:read`. GET requests need no CSRF header. All amounts are integer paise (₹ × 100); the UI should describe usage as approximate when `costType="estimated"`.

## `GET /api/v1/usage/summary`

No body or query parameters.

Returns `200`:
```json
{
  "data": {
    "plan": "trial",
    "trialEndsAt": "2026-10-26T00:00:00.000Z",
    "trialDaysLeft": 15,
    "spend": {
      "capPaise": 100000,
      "committedPaise": 0,
      "reservedPaise": 0,
      "remainingPaise": 100000,
      "costType": "estimated"
    },
    "entitlements": {
      "prospects": { "used": 0, "limit": null },
      "dmSearches": { "used": 0, "limit": null },
      "emails": { "used": 0, "limit": null },
      "icps": { "used": 1, "limit": null }
    }
  }
}
```
Numbers are illustrative only. The endpoint reads the actual `apiSpendCap` and counters stored on the selected workspace. The current docs do not freeze entitlement limits, so they are returned as `null` rather than invented.

## `GET /api/v1/usage/records`

Optional query parameters: `provider=apollo|llm`, `operation`, `status=success|failed|blocked`, `from`, `to`, `page` (default 1), `limit` (default 20, max 100).

Example:
`GET /api/v1/usage/records?provider=llm&status=failed&page=1&limit=20`

Returns `200`:
```json
{
  "data": [
    {
      "id": "USAGE_RECORD_ID",
      "provider": "llm",
      "operation": "llm.signal_interpret",
      "status": "failed",
      "costPaise": 120,
      "costType": "estimated",
      "errorCode": "PROVIDER_TIMEOUT",
      "occurredAt": "2026-10-11T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

`costPaise` comes from `usageRecords.costAmount`. Optional fields are absent when unknown. Cross-tenant records cannot be read because `startupId` is always included in the query.

## Budget service usage (internal only)

Provider routes should verify capability and validate request references **before** calling usage accounting. Then resolve an approved estimate and call:
```ts
usageService.withUsage(
  { startupId, requestId, entityRef },
  'apollo.org_search',
  estimatePaise,
  async () => ({ value: providerResult, costType: 'estimated' })
);
```
The `estimatePaise` argument must come from approved server-side configuration, never request input. `getUsageEstimate(operation)` currently fails closed because numerical estimates have not been owner-approved. Do not enable live Apollo/LLM operations until estimates and capability/commercial gates are approved.

## Reconciliation

- `pnpm reconcile:usage` reports counter/ledger drift and exits with code 2 when drift exists.
- `pnpm reconcile:usage --fix` updates `startups.spendCommitted` to the value computed from successful/failed ledger rows; review the dry-run report first.
- The script is manual and is not a scheduled job.

Errors: `402 BUDGET_EXHAUSTED` for cap exhaustion, `402 TRIAL_EXPIRED` for expired trial writes, `403 FORBIDDEN` for suspended workspace, `404 NOT_FOUND` for missing workspace, and `422 VALIDATION_FAILED` for invalid query parameters.
