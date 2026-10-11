# M2 slice — ICP proposal endpoint

This patch implements the documented `POST /api/v1/icps/propose` route as a mock-first, unsaved proposal operation.

## Request

```json
{
  "productDescription": "HRMS and payroll software for growing companies",
  "targetGeography": "United Kingdom",
  "salesObjective": "10 qualified meetings per month",
  "notes": ""
}
```

`productDescription` must be 20–2000 characters. Unknown fields are rejected. The endpoint requires an authenticated active workspace and the existing `icp:write` permission.

## Local mock mode

Set `LLM_MODE=mock` (the default in non-production configuration). The mock adapter supports a few explicit demo fixtures (HRMS/payroll, accounting/finance, CRM). Its rationale says `MOCK-ONLY`. Unrecognized descriptions return `422 VALIDATION_FAILED` with a `missing` list. This is a development fixture, **not an AI-generated proposal** and is not suitable as production output.

Mock calls create a zero-cost `usageRecords` row and do not reserve or consume spend. No ICP is saved; the founder must still review and submit the proposal through `POST /icps`.

## Live mode remains deliberately disabled

`LLM_MODE=live` does not make an external call. It fails closed while the approved per-operation estimate is empty and no vendor adapter/country allowlist is configured. The patch does not choose an LLM vendor, invent cost estimates, or set entitlement limits. Production boot rejects `LLM_MODE=mock`.

Before live ICP proposals can be enabled, the owner must approve the cost estimate, choose/configure an LLM adapter consistent with `AI_SERVICE_DESIGN.md`, and define the supported-country list referenced by that document. Existing D5 trial-cap decision remains unchanged.

## No schema changes

No collections, fields, indexes, or dependencies are added by this patch.
