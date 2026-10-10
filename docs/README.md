# BlueCode OS (AI Sales Copilot) — Documentation Map

**Stack:** MERN monolith · Apollo.io (data) · configurable LLM (intelligence)
**MVP execution model:** draft-first, founder approves, `mailto:` handoff (see `DECISIONS.md` D2)
**Rule:** each doc may depend only on docs above it. Approved schema = `DB_ARCHITECTURE.md` + `DB_AMENDMENTS.md`.

| # | File | Purpose | Status |
|--:|---|---|---|
| 0 | `README.md` | Map, reading order, status | Done |
| 1 | `DB_ARCHITECTURE.md` | 13 collections, indexes, tenant rules | Done; fold in amendments after approval |
| 1a | `DB_AMENDMENTS.md` | Adopt/Defer register of schema changes, enum registry, index checklist | **Needs approval** |
| 2 | `BACKEND_ARCHITECTURE.md` | Modules, services, pipeline, budget, state machines, tests (**v2**) | Revised after review |
| 2a | `APOLLO_INTEGRATION.md` | Capability matrix, verification procedure, licensing questions | **Needs data from Apollo account** |
| 3 | `API_CONTRACT.md` | Every endpoint under `/api/v1`, DTOs, errors, permissions | **Draft for review** |
| 4 | `AI_SERVICE_DESIGN.md` | Prompts, JSON schemas, cost per task | **Next** |
| 5 | `FRONTEND_ARCHITECTURE.md` | Routes, pages, components, data fetching, UX states | Planned |
| 6 | `SECURITY_AND_TESTING.md` | Threat checklist, tenant-isolation test matrix | Planned |
| 7 | `DEPLOYMENT_AND_OPS.md` | Env vars, VPS, Mongo replica set, logging, backups | Planned |
| 8 | `DECISIONS.md` | Decision log (D1–D13) | Living |

## Blockers before coding starts
1. Product owner confirms D2 (mailto-only MVP).
2. DB owner approves `DB_AMENDMENTS.md`.
3. Apollo capabilities 1–3 verified and recorded; commercial questions C1–C3 answered or pilot limited to consenting founders / mock mode.

M1 (foundation) in `BACKEND_ARCHITECTURE.md §17` does not depend on blockers 1 and 3 and can start once 2 is approved.

## Repo layout
```
bluecode-os/
├── docs/       # this folder
├── server/     # see BACKEND_ARCHITECTURE §4
└── client/     # see FRONTEND_ARCHITECTURE
```

## Change policy
Change the owning doc first, then the code. One line in `DECISIONS.md` for each non-obvious choice.