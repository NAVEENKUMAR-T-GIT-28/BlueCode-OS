# BlueCode OS (AI Sales Copilot) — Documentation Map

**Stack:** MERN monolith · Apollo.io (data/execution) · configurable LLM (intelligence)
**Rule:** write docs in the order below. Each doc may only depend on docs above it.

| # | File | Purpose | Status |
|--:|---|---|---|
| 0 | `README.md` | This map, reading order, status | Done |
| 1 | `DB_ARCHITECTURE.md` | 13 collections, indexes, tenant rules | Done (needs amendments, see BACKEND §16) |
| 2 | `BACKEND_ARCHITECTURE.md` | Module structure, services, state machines, cross-cutting rules | **This delivery** |
| 3 | `API_CONTRACT.md` | Every endpoint: method, path, auth, request/response schemas, error codes | Next |
| 4 | `AI_SERVICE_DESIGN.md` | Prompt registry, JSON schemas per AI task, scoring formula, cost estimates | Planned |
| 5 | `APOLLO_INTEGRATION.md` | Auth model, endpoint mapping, field mapping, rate limits, mock strategy | Planned |
| 6 | `FRONTEND_ARCHITECTURE.md` | Routes, pages, component tree, state/data fetching, UX states | Planned |
| 7 | `SECURITY_AND_TESTING.md` | Threat checklist, tenant-isolation test matrix, test plan | Planned |
| 8 | `DEPLOYMENT_AND_OPS.md` | Env vars, Hostinger VPS setup, logging, backups, runbook | Planned |
| 9 | `DECISIONS.md` | ADR log (one line per decision, with date and reason) | Start now, grow over time |

## Suggested repo layout

```
bluecode-os/
├── docs/                 # this folder
├── server/               # Express API (see BACKEND_ARCHITECTURE §4)
├── client/               # React app (see FRONTEND_ARCHITECTURE)
└── README.md
```

## Reading order for a new developer
1. `DB_ARCHITECTURE.md` (what is stored)
2. `BACKEND_ARCHITECTURE.md` (how the server is organized)
3. `API_CONTRACT.md` (how the client talks to it)

## Change policy
- A change to a collection, state machine, or endpoint is made in the owning doc first, then in code.
- Every non-obvious choice gets one line in `DECISIONS.md`.