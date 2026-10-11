# M3 — Mock-first organization discovery (implementation note)

This slice wires the existing `POST /api/v1/prospects/search` contract to a deterministic mock provider. It is not a claim that Apollo access, fields, credit cost, rate limits, data storage rights, or multi-tenant commercial use has been verified.

## Guardrails

- `APOLLO_MODE=mock` is the default for local/test use; production rejects that mode.
- `APOLLO_MODE=live` still fails closed with `CAPABILITY_DISABLED` for `search_orgs`.
- Fixtures use synthetic names and reserved `.example` domains.
- Existing canonical collections are reused; no collection/model/index/dependency is added.
- ICP lookup is scoped by authenticated `startupId`; archived ICPs cannot be searched.
- Deduplication checks `apolloOrganizationId` first and normalized `domain` second. Original `prospects.icpId` is immutable.
- Scoring is delegated to the existing deterministic scoring service; no AI score adjustment and no synthetic buying signals are created.
- Each mock provider response appends a zero-cost usage ledger row. It does not reserve or commit spend and does not claim Apollo usage.

## Verification gate for live Apollo

Live search remains unavailable until `docs/APOLLO_INTEGRATION.md` has verified evidence for `search_orgs`, and the commercial/legal gate (C1–C3 at minimum) is answered. This patch deliberately does not add Apollo HTTP calls or consume the server Apollo key.
