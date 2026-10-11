# BlueCode OS Frontend Architecture — Sprint 1 Baseline

## Status
Architecture baseline only. Existing UI remains implemented in `src/App.tsx` until individual extractions are verified. This package does not replace the main app or introduce a new router/dependency.

## Target structure

```text
src/
  app/
    App.tsx                 # application composition after migration
    routing/                # current URL mapping/navigation
    layouts/                # AppShell/AuthLayout
    guards/                 # authenticated/workspace guards
  pages/                    # public and exceptional route-level pages
  components/
    ui/
    feedback/
    data-display/
    branding/
  features/
    auth/
    workspaces/
    dashboard/
    icps/
    prospects/
    contacts/
    signals/
    campaigns/
    messages/
    activities/
    next-actions/
    usage/
    settings/
  lib/api/                  # shared transport and error normalization
  types/                    # genuinely shared frontend types
  index.css
  main.tsx
```

## Rules
1. No UI redesign in this refactor; preserve existing CSS class names and responsive behavior.
2. Keep existing URL paths, query parameters, popstate handling, and navigation semantics.
3. Keep the existing `api.ts` behavior (credentials, CSRF marker, tenant header, error handling). Consolidate rather than duplicate it in a later reviewed step.
4. No API-contract changes, backend changes, database changes, collection changes or environment changes.
5. Apollo and LLM provider requests/credentials remain backend-only. Existing disabled capability states remain disabled.
6. Outreach stays draft-first and human-reviewed with client-side `mailto:` handoff; no server-side dispatch.
7. Each extraction is a small diff that can be independently typechecked and reviewed.
8. Do not introduce a routing/state-management dependency just for folder organization.

## Current baseline
- Branch: `frontend-MVP`
- Base commit: `a92032dea9dc13433f79ad7113f300dea9495026`
- Runtime UI and several helper/hooks are currently colocated in `src/App.tsx`.
- Shared HTTP client is in `src/api.ts`.

## Sprint gates
### Sprint 1 — foundation and extraction plan
- Establish target folders and rules.
- Extract only low-coupling primitives/hooks with direct import-only refactors.
- Preserve session, workspace selection, route mapping and CSS selectors.
- Verify frontend typecheck/build and primary navigation/auth flows.

### Sprint 2 — feature migration
- Move feature components/screens one feature at a time.
- Move feature API calls and types only when that does not change wire contracts.
- Keep the shared API transport singular.

### Sprint 3 — stabilization
- Remove dead code only after usage search.
- Improve targeted tests and accessibility/regression coverage.
- Confirm all existing routes and disabled/mocked provider behavior.
- Approve architecture before live provider integration.

## Not included
- Route endpoint implementation such as score explanation.
- Live Apollo/LLM client adapters or API keys.
- New dependencies, changed database schema, or visual redesign.
