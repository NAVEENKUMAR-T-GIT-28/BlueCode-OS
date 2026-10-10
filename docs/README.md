# BlueCode OS (AI Sales Copilot) — Documentation Map

**Stack:** MERN monolith · Apollo.io (data) · configurable LLM (intelligence)
**MVP execution model:** draft-first, founder approves, `mailto:` handoff (see `DECISIONS.md` D2)
**Rule:** each doc may depend only on docs above it. **Single schema source: `DB_ARCHITECTURE.md` v2.0** (amendments merged).

| # | File | Purpose | Status |
|--:|---|---|---|
| 0 | `README.md` | Map, reading order, status | Done |
| 1 | `DB_ARCHITECTURE.md` | 13 collections, enums, indexes, tenant rules, lifecycle (**v2.0 detailed**) | Authoritative |
| 1b | `db/ER_DIAGRAM.eraser` | ER diagram source, kept in sync with the schema | Authoritative |
| 1a | `DB_AMENDMENTS.md` | Change register and rationale (A1–A29) | Historical; do not code from it |
| 2 | `BACKEND_ARCHITECTURE.md` | Modules, services, pipeline, budget, state machines, tests (v2) | Reconciled with DB v2 |
| 2a | `APOLLO_INTEGRATION.md` | Capability matrix, verification procedure, licensing questions | **Needs data from Apollo account** |
| 3 | `API_CONTRACT.md` | Every endpoint under `/api/v1`, DTOs, errors, permissions | Draft; freezes after the trial cap is set |
| 4 | `AI_SERVICE_DESIGN.md` | Six LLM tasks: prompts, output schemas, validators, runtime, cost model, tests | Draft for review |
| 5 | `FRONTEND_ARCHITECTURE.md` | Routes, pages, flows, data fetching, UX states, honest wording, mailto handoff | Draft for review |
| 6 | `SECURITY_AND_TESTING.md` | Threat register, controls, test inventory with IDs, release gates | Draft for review |
| 7 | `DEPLOYMENT_AND_OPS.md` | Env vars, VPS, Mongo replica set, logging, backups | **Next** |
| 8 | `DECISIONS.md` | Decision log (D1–D19) | Living |

## Frozen
- D2: draft → approval → `mailto:` handoff; no server-side sending (Accepted / Frozen).
- 13 collections; modular monolith; no scheduled jobs; shared Apollo key only in server `.env`.

## Open before freezing the API contract and generating code
1. **Trial spend cap (D5):** ₹250 (current default) or ₹1,000? One config value, used by backend, API, UI, and tests.
2. **Apollo verification:** capabilities 1–3 (`search_orgs`, `search_people`, `enrich`) verified with evidence. Until then discovery is unavailable in live mode (mock mode only). Commercial questions C1–C3 answered before any non-founder customer uses live Apollo data.
3. **Tests to implement** (not just plan): the blocker suites in `SECURITY_AND_TESTING.md` §5–§6 (tenant isolation, budget concurrency, draft concurrency, approval reset, do-not-contact, unsubscribe).

M1 (foundation) in `BACKEND_ARCHITECTURE.md §17` can start now.

## Repo layout
```
bluecode-os/
├── docs/       # this folder
├── shared/     # enums + DTO types (FRONTEND_ARCHITECTURE §3)
├── server/     # see BACKEND_ARCHITECTURE §4
└── client/     # see FRONTEND_ARCHITECTURE
```

## Change policy
Change the owning doc first, then the code. One line in `DECISIONS.md` for each non-obvious choice.