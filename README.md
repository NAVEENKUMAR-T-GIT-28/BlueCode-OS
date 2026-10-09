# AI Founder OS: Sales Copilot (MVP Phase 1)

> **Status:** Final plan, v1.0. This is the single source of truth for architecture, system design, and build plan.
> **Source requirements:** *AI Founder OS: High-Level Architecture & Requirements Document (PRD v1.0)*.
> **Scope rule:** Only PRD Phase 1 is built. Anything not listed here is out of scope until the pilot ends. Changes to this document require explicit agreement before code changes.

---

## Table of Contents

1. [Product Summary](#1-product-summary)
2. [Scope: In and Out](#2-scope-in-and-out)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack](#4-tech-stack)
5. [Repository Structure](#5-repository-structure)
6. [Database Design](#6-database-design)
7. [Multi-Tenancy & Security](#7-multi-tenancy--security)
8. [Budget Gate & Usage Tracking](#8-budget-gate--usage-tracking)
9. [Background Jobs](#9-background-jobs)
10. [Lead State Machine](#10-lead-state-machine)
11. [Module Specifications](#11-module-specifications)
12. [LLM Layer](#12-llm-layer)
13. [API Reference](#13-api-reference)
14. [Frontend](#14-frontend)
15. [Error Handling](#15-error-handling)
16. [Testing Strategy](#16-testing-strategy)
17. [Deployment (Hostinger VPS)](#17-deployment-hostinger-vps)
18. [Configuration](#18-configuration)
19. [Build Plan (Sprints)](#19-build-plan-sprints)
20. [Locked Decisions](#20-locked-decisions)
21. [Open Items](#21-open-items)
22. [PRD Inconsistencies & How We Resolve Them](#22-prd-inconsistencies--how-we-resolve-them)
23. [Definition of Done (MVP)](#23-definition-of-done-mvp)

---

## 1. Product Summary

AI Founder OS is a multi-tenant SaaS platform. Its first product, the **AI Sales Copilot**, automates outbound sales for early-stage startups:

```
ICP Config → Discovery → DM Identification → Scoring → Outreach → Follow-up → Booking
```

**Phase 1 goal:** Onboard the first **15-20 startups** on a **single common plan** with a **15-day free trial** and a **hard API spend cap of ₹1,000 per startup**, and record real usage data (how many prospects founders use, whether they send emails or Apollo messages) to design the paid tiers in Phase 2.

**Three qualities the PRD demands from the Phase 1 delivery:**
1. Robust error handling for external API failures.
2. Strict data isolation per startup account.
3. Clean user-facing status indicators during AI prospect generation.

Domain: `www.bluecode-os.com`

---

## 2. Scope: In and Out

### In scope (Phase 1)

| # | Module | Summary |
|---|---|---|
| 1 | ICP Builder | Natural-language product description → structured, editable targeting criteria |
| 2 | Prospect & DM Finder | Apollo search for companies and verified decision-makers |
| 3 | AI Lead Scoring | 0-100 score with written rationale, banded Hot/High/Medium/Low |
| 4 | Outreach Generator | Cold email, Apollo DM, Follow-up #1, Follow-up #2 |
| 5 | Follow-up Assistant | Detects inactivity, alerts founder, pre-generates reply copy |
| 6 | Auto-Scheduling | Detects positive replies, adds booking link |
| 7 | Sales Dashboard | Daily action metrics for the logged-in startup |

Plus the platform requirements: multi-tenant isolation, JWT auth, the single plan with 15-day trial, ₹1,000 hard cap, and usage tracking.

### Out of scope (do not build)

| Item | When |
|---|---|
| Company Research module | Post-MVP |
| Prioritization Engine | Post-MVP |
| Starter / Growth / Pro tiers, Stripe billing, upgrades | Phase 2 |
| Add-on credit packs | Phase 2 |
| CRM sync / export, advanced analytics | Phase 2 |
| AWS migration | Phase 2 |
| Multi-user teams (the trial allows 1 user) | Phase 2 |
| Redis, SendGrid, LangChain, microservices | Not needed for Phase 1 |

---

## 3. Architecture Overview

```
                 Browser (Next.js + Tailwind)
                          │ HTTPS
                 Caddy (TLS + reverse proxy)
                          │
              ┌───────────┴───────────┐
              │      FastAPI (api)    │
              │ JWT → tenant context  │
              │ → budget gate → logic │
              └───────────┬───────────┘
                          │ SQL (RLS enforced)
                          ▼
              ┌───────────────────────┐
              │      PostgreSQL       │  data + job queue + usage counters
              └───────────▲───────────┘
                          │ claims jobs (FOR UPDATE SKIP LOCKED)
              ┌───────────┴───────────┐
              │   Worker (same code)  │  + timers: inbox sync, follow-up scan
              └───┬───────┬───────┬───┘
                  │       │       │
               Apollo    LLM   SMTP / IMAP
                               (founder's own mailbox)
```

### Runtime components

| Container | Role |
|---|---|
| `caddy` | TLS termination, reverse proxy |
| `web` | Next.js frontend |
| `api` | FastAPI REST API |
| `worker` | Job runner plus two internal timers. Same codebase as `api`. |
| `postgres` | All persistent state, including the job queue |

### Design principles

| Principle | Meaning |
|---|---|
| Modular monolith | One backend codebase with clean internal modules. No microservices. |
| Postgres only | No Redis. Postgres handles queue, locks, counters. Revisit if scale requires it. |
| Async by default | Anything calling Apollo or an LLM runs as a background job, never inside an HTTP request. |
| Isolation in the database | Row-Level Security is the safety net behind application checks. |
| Spend is reserved before it is incurred | Every paid call goes through one budget gate. |
| Human approval for outbound | Nothing is sent to a prospect without the founder's approval. |
| Portable | Everything is containerized with config from environment variables, so the later AWS move is a redeploy. |

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2 |
| Database | PostgreSQL 16 with Row-Level Security |
| Job queue | `jobs` table in Postgres |
| LLM | **OpenAI, Anthropic, or Ollama (local)**, selected by `LLM_PROVIDER`, behind one internal `LLMClient` (plain HTTP, no vendor SDKs, no LangChain) |
| Data provider | Apollo.io API |
| Email | SMTP (send) and IMAP (read replies) using the founder's own mailbox |
| Scheduling | Founder's Calendly or custom booking link |
| Auth | JWT in httpOnly cookie, argon2 password hashing |
| Hosting | Docker Compose on Hostinger VPS |
| CI | GitHub Actions: lint, tests, build, deploy |
| Errors | Sentry (free tier) plus structured JSON logs |

---

## 5. Repository Structure

```
ai-founder-os/
├── README.md                      # this file
├── docker-compose.yml
├── docker-compose.dev.yml
├── Caddyfile
├── .env.example
├── .github/workflows/ci.yml
│
├── backend/
│   ├── pyproject.toml
│   ├── alembic/                   # migrations (includes RLS policies)
│   ├── app/
│   │   ├── main.py                # FastAPI app
│   │   ├── config.py              # env settings
│   │   ├── db.py                  # engine, session, tenant context
│   │   ├── auth/                  # signup, login, JWT, dependencies
│   │   ├── core/
│   │   │   ├── budget.py          # BudgetGate: reserve / settle / release
│   │   │   ├── state.py           # lead state machine: transition()
│   │   │   ├── crypto.py          # encrypt/decrypt integration secrets
│   │   │   └── errors.py          # error envelope, exceptions
│   │   ├── llm/
│   │   │   ├── client.py          # LLMClient (structured output, retry, cost)
│   │   │   └── prompts/           # versioned prompt templates
│   │   ├── integrations/
│   │   │   ├── apollo.py          # Apollo client (timeouts, retries)
│   │   │   ├── smtp.py            # send
│   │   │   └── imap.py            # fetch and thread-match replies
│   │   ├── modules/
│   │   │   ├── icp/               # router, service, schemas
│   │   │   ├── discovery/         # prospects + decision makers
│   │   │   ├── scoring/
│   │   │   ├── outreach/
│   │   │   ├── followup/
│   │   │   ├── replies/           # inbox sync, intent, booking reply
│   │   │   └── dashboard/
│   │   ├── jobs/
│   │   │   ├── queue.py           # enqueue, claim, heartbeat, complete/fail
│   │   │   ├── worker.py          # main loop + timers
│   │   │   └── handlers/          # one file per job type
│   │   └── models/                # SQLAlchemy models (9 tables)
│   └── tests/
│       ├── isolation/             # tenant isolation suite
│       ├── budget/
│       ├── state/
│       ├── modules/
│       └── e2e/
│
└── frontend/
    ├── app/
    │   ├── (auth)/login, signup
    │   └── (app)/dashboard, icp, prospects, leads, decision-makers,
    │             outreach, followups, analytics, settings
    ├── components/                # JobProgress, ScoreBadge, MessageEditor, BudgetMeter
    └── lib/                       # typed apiClient, useJob polling hook
```

---

## 6. Database Design

The schema follows the PRD hierarchy: **Startup Accounts → Users, ICPs, Prospects → Decision_Makers, Leads, Outreach_History, Usage_Tracker**. The only addition is **Jobs**, which the PRD's progress-indicator and error-handling requirements force.

### 6.1 Conventions

- Primary keys are UUIDs.
- Every tenant table has `startup_id UUID NOT NULL REFERENCES startups(id)` and an RLS policy.
- Money is stored as integers in minor units (**paise**), never floats.
- Timestamps are `timestamptz` in UTC.

### 6.2 Tables (9)

```sql
-- 1. Startup Accounts (the tenant)
CREATE TABLE startups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  plan              TEXT NOT NULL DEFAULT 'pilot',          -- single common plan in Phase 1
  status            TEXT NOT NULL DEFAULT 'trial',          -- trial | active | expired | suspended
  trial_ends_at     TIMESTAMPTZ NOT NULL,                   -- created_at + 15 days
  booking_link      TEXT,                                   -- Calendly or custom
  smtp_config_enc   BYTEA,                                  -- encrypted JSON (host, port, user, password)
  imap_config_enc   BYTEA,                                  -- encrypted JSON
  sender_name       TEXT,
  sender_address    TEXT,                                   -- postal address for email footer
  daily_send_cap    INT NOT NULL DEFAULT 30,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Users
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id     UUID NOT NULL REFERENCES startups(id),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'owner',             -- owner | member
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ICPs
CREATE TABLE icps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id           UUID NOT NULL REFERENCES startups(id),
  product_description  TEXT NOT NULL,
  criteria_json        JSONB NOT NULL,                      -- see 11.1 for schema
  confirmed            BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Prospects (companies)
CREATE TABLE prospects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id      UUID NOT NULL REFERENCES startups(id),
  icp_id          UUID NOT NULL REFERENCES icps(id),
  apollo_org_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  domain          TEXT,
  industry        TEXT,
  headcount       INT,
  geo             TEXT,
  raw_json        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, apollo_org_id)
);

-- 5. Decision Makers
CREATE TABLE decision_makers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id        UUID NOT NULL REFERENCES startups(id),
  prospect_id       UUID NOT NULL REFERENCES prospects(id),
  apollo_person_id  TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  title             TEXT,
  email             TEXT,
  email_status      TEXT,                                   -- verified | unverified | missing
  linkedin_url      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, apollo_person_id)
);

-- 6. Leads
CREATE TABLE leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id         UUID NOT NULL REFERENCES startups(id),
  prospect_id        UUID NOT NULL REFERENCES prospects(id),
  dm_id              UUID NOT NULL REFERENCES decision_makers(id),
  score              INT CHECK (score BETWEEN 0 AND 100),
  band               TEXT,                                  -- hot | high | medium | low
  rationale          TEXT,
  state              TEXT NOT NULL DEFAULT 'discovered',
  state_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  suppressed         BOOLEAN NOT NULL DEFAULT false,        -- unsubscribed / negative / bounced
  booked_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (startup_id, dm_id)
);

-- 7. Outreach History (outbound and inbound messages)
CREATE TABLE outreach_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id         UUID NOT NULL REFERENCES startups(id),
  lead_id            UUID NOT NULL REFERENCES leads(id),
  direction          TEXT NOT NULL,                         -- outbound | inbound
  kind               TEXT NOT NULL,                         -- cold_email | apollo_dm | followup_1 | followup_2 | reply
  channel            TEXT NOT NULL DEFAULT 'email',         -- email | apollo
  subject            TEXT,
  body               TEXT NOT NULL,
  status             TEXT NOT NULL,                         -- draft | approved | sent | failed | bounced | received
  intent             TEXT,                                  -- inbound only: positive | negative | question | unsubscribe | auto_reply
  intent_confidence  REAL,
  handled            BOOLEAN NOT NULL DEFAULT false,        -- inbound only
  scheduled_for      TIMESTAMPTZ,
  sent_at            TIMESTAMPTZ,
  received_at        TIMESTAMPTZ,
  message_id_header  TEXT,                                  -- RFC 5322 Message-ID
  in_reply_to        TEXT,                                  -- for thread matching
  error              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Usage Tracker (one row per startup)
CREATE TABLE usage_tracker (
  startup_id          UUID PRIMARY KEY REFERENCES startups(id),
  cap_minor           BIGINT NOT NULL DEFAULT 100000,       -- ₹1,000 in paise
  reserved_minor      BIGINT NOT NULL DEFAULT 0,
  spent_minor         BIGINT NOT NULL DEFAULT 0,
  prospects_used      INT NOT NULL DEFAULT 0,
  dm_lookups_used     INT NOT NULL DEFAULT 0,
  messages_generated  INT NOT NULL DEFAULT 0,
  emails_sent         INT NOT NULL DEFAULT 0,
  apollo_dms_generated INT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (spent_minor + reserved_minor <= cap_minor)
);

-- 9. Jobs (background work and progress)
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID NOT NULL REFERENCES startups(id),
  type          TEXT NOT NULL,        -- discover | dm_lookup | score | generate_outreach | send_email | inbox_sync | classify_reply | followup_scan
  status        TEXT NOT NULL DEFAULT 'queued',  -- queued | running | succeeded | partial | failed | paused_budget
  total         INT NOT NULL DEFAULT 0,
  done          INT NOT NULL DEFAULT 0,
  failed        INT NOT NULL DEFAULT 0,
  params_json   JSONB NOT NULL DEFAULT '{}',
  error         TEXT,
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  run_after     TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at     TIMESTAMPTZ,          -- heartbeat for crash recovery
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);
```

### 6.3 Required indexes

```sql
CREATE INDEX ON leads (startup_id, state);
CREATE INDEX ON leads (startup_id, band);
CREATE INDEX ON outreach_history (startup_id, lead_id, created_at);
CREATE INDEX ON outreach_history (startup_id, direction, status, sent_at);
CREATE INDEX ON outreach_history (message_id_header);
CREATE INDEX ON jobs (status, run_after);
CREATE INDEX ON jobs (startup_id, created_at DESC);
```

### 6.4 Relationships

```
startups 1─* users
startups 1─* icps 1─* prospects 1─* decision_makers
prospects + decision_makers 1─1 leads
leads 1─* outreach_history
startups 1─1 usage_tracker
startups 1─* jobs
```

### 6.5 Intentionally not tables

| Dropped idea | Where it lives instead |
|---|---|
| `replies` | `outreach_history` with `direction = inbound` |
| `integrations` | Encrypted columns on `startups` |
| `usage_events` | Counters in `usage_tracker` answer the pilot questions |
| `suppression_list` | `leads.suppressed` flag |
| `audit_log` | Out of scope. `state_updated_at` and job rows give enough traceability for the pilot. |

---

## 7. Multi-Tenancy & Security

### 7.1 Rules (non-negotiable)

1. **`startup_id` comes only from the verified JWT.** Never from a request body, query string, or URL.
2. Every request runs in a DB transaction that starts with:
   ```sql
   SET LOCAL app.current_startup_id = '<uuid from JWT>';
   ```
3. **RLS is enabled and forced on every tenant table:**
   ```sql
   ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
   ALTER TABLE leads FORCE  ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON leads
     USING      (startup_id = current_setting('app.current_startup_id', true)::uuid)
     WITH CHECK (startup_id = current_setting('app.current_startup_id', true)::uuid);
   ```
   Apply the same policy to: `users, icps, prospects, decision_makers, leads, outreach_history, usage_tracker, jobs`. For `startups`, the policy is `id = current_setting(...)`.
4. **The app connects as a non-owner, non-superuser role.** Superusers and table owners bypass RLS. Migrations run under a separate owner role.
5. **Worker jobs** carry `startup_id` and set the same session variable before touching tenant data. The job *claim* step uses a restricted worker role that can only read the queue columns across tenants.
6. **Cross-tenant access returns 404**, not 403, so IDs cannot be probed.
7. Foreign keys are validated: a lead's `prospect_id` and `dm_id` must belong to the same `startup_id`. Use composite checks in services and tests.

### 7.2 Authentication

- Signup creates a startup (status `trial`, `trial_ends_at = now() + 15 days`), an owner user, and a `usage_tracker` row, all in one transaction.
- Login returns a JWT (httpOnly, Secure, SameSite=Lax cookie). Claims: `sub` (user_id), `startup_id`, `role`, `exp`.
- Passwords: argon2.
- Login throttling: 5 failed attempts per 15 minutes per email and IP.

### 7.3 Secrets and data protection

- SMTP and IMAP credentials are stored encrypted (AES-GCM, key from `APP_ENCRYPTION_KEY`) and never returned by the API.
- All secrets live in environment variables, never in the repository.
- TLS everywhere via Caddy.
- Webhook-style endpoints are not used in Phase 1.

### 7.4 Outbound email safeguards (required for a legitimate cold-email product)

- Every email includes the sender identity, a postal address, and an **unsubscribe line**.
- Unsubscribe or negative replies set `leads.suppressed = true`. The system never sends to a suppressed lead.
- Daily send cap per startup (`daily_send_cap`, default 30) to protect the founder's mailbox reputation.
- Onboarding page tells founders to set up SPF, DKIM, and DMARC on their sending domain.
- Legal review of Apollo's terms and cold-email regulations (CAN-SPAM, GDPR, India DPDP Act) is required before the pilot opens. See [Open Items](#21-open-items).

---

## 8. Budget Gate & Usage Tracking

Enforces the PRD's **hard ₹1,000 cap**. All Apollo and LLM calls pass through `BudgetGate`.

### 8.1 Flow

```
reserve(estimate) ──blocked──► raise BudgetExceeded → job becomes paused_budget
      │ ok
      ▼
 call provider
      ▼
 settle(actual): reserved -= estimate; spent += actual
 on failure: release(estimate)
```

### 8.2 Atomic reservation

```sql
UPDATE usage_tracker
SET reserved_minor = reserved_minor + :estimate, updated_at = now()
WHERE startup_id = :sid
  AND spent_minor + reserved_minor + :estimate <= cap_minor
RETURNING startup_id;          -- zero rows = blocked
```

Atomic SQL means concurrent jobs cannot both pass the check and overshoot the cap. The table's `CHECK` constraint is the final backstop.

### 8.3 Cost estimation

| Call | Estimate basis |
|---|---|
| LLM | Input tokens × input price + `max_tokens` × output price, settled to actual reported usage |
| Apollo org search / people search / email reveal | Per-credit cost from config (`APOLLO_COST_*_MINOR`) |

USD-billed provider costs are converted at a fixed config rate (`USD_INR_RATE`), reviewed monthly.

### 8.4 Counters (what the pilot measures)

`prospects_used`, `dm_lookups_used`, `messages_generated`, `apollo_dms_generated`, `emails_sent`. These answer the PRD's pilot questions: 50 vs 500 prospects, and emails vs Apollo messages.

### 8.5 Trial and cap behavior

| Condition | Behavior |
|---|---|
| Spend ≥ 80% of cap | Warning banner with remaining budget |
| Spend reaches cap | Paid calls blocked, running jobs become `paused_budget`, banner explains |
| `trial_ends_at` passed | Account becomes `expired`: read-only (data visible, no paid calls, no sending) |
| Cap is checked | At every `reserve()`, and trial expiry is checked at login and in `reserve()` |

---

## 9. Background Jobs

Postgres is the queue. The worker is a long-running process.

### 9.1 Claiming a job

```sql
UPDATE jobs SET status='running', locked_at=now(), attempts=attempts+1
WHERE id = (
  SELECT id FROM jobs
  WHERE status='queued' AND run_after <= now()
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

### 9.2 Lifecycle

```
queued → running → succeeded
                 → partial         (some items failed)
                 → failed          (after max_attempts)
                 → paused_budget   (cap reached)
```

- The worker updates `done`, `total`, `failed` as it works. The UI reads these for progress.
- **Heartbeat:** `locked_at` is refreshed every 30 seconds. A running job with a stale `locked_at` (> 5 minutes) is reset to `queued` on worker start, which recovers from crashes.
- **Retries:** transient failures re-queue with `run_after = now() + backoff` (30s, 2m, 10m), up to `max_attempts`.
- **Idempotency:** handlers use upserts and check existing state, so a retry never duplicates prospects, leads, or messages.
- **Fairness:** at most 2 running jobs per startup.

### 9.3 Job types

| Type | Triggered by | Does |
|---|---|---|
| `discover` | Founder starts a search | Pages Apollo org search, upserts prospects, enqueues `dm_lookup` |
| `dm_lookup` | After discover | Apollo people search per company, upserts decision makers, creates leads, enqueues `score` |
| `score` | After DM lookup, or manual rescore | Scores a batch of leads |
| `generate_outreach` | After scoring (leads ≥ threshold) or manual | Generates the 4-message sequence as drafts |
| `send_email` | Founder approves | Sends via SMTP |
| `inbox_sync` | Timer, every 10 min per connected mailbox | Fetches replies via IMAP |
| `classify_reply` | After inbox sync | Classifies intent, drafts booking reply |
| `followup_scan` | Timer, hourly | Marks leads follow-up due |

### 9.4 Timers

The worker runs two internal timers that insert jobs: `inbox_sync` (10 min) and `followup_scan` (60 min). No external cron is needed.

### 9.5 Progress indicator contract (PRD requirement)

```
API:    POST /icps/{id}/discover → creates job → returns { job_id }
Worker: updates jobs.done / total / failed
UI:     polls GET /jobs/{id} every 2-3 s → "Finding prospects… 20 / 50"
        shows final state: succeeded, partial ("38 of 50 found, retry failed"), failed, paused_budget
```

---

## 10. Lead State Machine

```
discovered ─► dm_found ─► scored ─┬─► filtered_out        (score < 50)
                                  └─► drafted ─► approved ─► sent
                                                              │
                                  ┌───────────────────────────┤
                                  ▼                           ▼
                           followup_due ─► followup_sent   replied
                                  │              │          │
                                  ▼              ▼          ├─► positive ─► link_sent ─► booked
                              no_response    no_response    ├─► negative ───► closed
                                                            └─► unsubscribed ─► closed
```

Rules:
- All changes go through `transition(lead, new_state)` in `core/state.py`. It validates the move, updates `state_updated_at`, and rejects illegal transitions. **No other code writes `leads.state`.**
- `closed` and `filtered_out` are terminal for outreach. `suppressed = true` blocks all sending.
- **Dashboard counts come from `GROUP BY state`**, so this field is the contract between the backend and the dashboard.

---

## 11. Module Specifications

### 11.1 ICP Builder

**Input:** product description (free text).
**Process:**
1. LLM returns JSON validated against this schema (one repair retry on failure, then fall back to manual entry):

```json
{
  "industries": ["SaaS", "IT Services"],
  "headcount_min": 50,
  "headcount_max": 500,
  "geographies": ["India"],
  "languages": ["English"],
  "job_titles": ["HR Head", "CEO", "Founder"],
  "exclusions": ["Staffing agencies", "Competitors"]
}
```

2. Industries and titles are mapped to Apollo's filter vocabulary through a lookup table (`apollo_filters.py`). Unmapped values are shown to the founder to fix.
3. The founder edits and confirms. **Only a confirmed ICP can be used for discovery.**

PRD v1 supports 1 ICP per startup during the trial. Enforce `max 1 ICP` for the pilot plan.

### 11.2 Prospect & DM Finder

```
POST /icps/{id}/discover { limit }
→ job: discover
   loop pages: reserve → Apollo org search → settle → upsert prospects → progress
→ job(s): dm_lookup (batched)
   per company: reserve → Apollo people search (target titles)
   keep contacts with verified email; store others with email_status = unverified/missing
   upsert decision_makers → create lead (state: dm_found) → enqueue score
```

- Request `limit` is capped by the remaining budget and an entitlement cap (the pilot defaults to 50 prospects, adjustable by config).
- Leads without a verified email are created but flagged and excluded from email outreach.
- Timeouts 15 s, retries with backoff on 429 and 5xx (max 3).
- Zero results: UI suggests broadening the ICP.

### 11.3 AI Lead Scoring

**Hybrid approach for consistent, cheap scoring:**

| Component | Points | Source |
|---|---|---|
| Industry match | 0-30 | Deterministic rule |
| Headcount in range | 0-25 | Deterministic rule |
| Geography match | 0-15 | Deterministic rule |
| Title match | 0-20 | Deterministic rule |
| Exclusion hit | Score capped at 40 | Deterministic rule |
| LLM adjustment | ±10 | LLM judgment on fit signals in the data |

The LLM returns `{ adjustment, rationale }` (temperature 0, rubric in prompt). Final score is clamped to 0-100.

| Score | Band | Behavior |
|---|---|---|
| 90-100 | Hot | Priority for outreach |
| 70-89 | High | Outreach generated |
| 50-69 | Medium | Outreach generated |
| < 50 | Low | State `filtered_out`: kept in DB, hidden by default, no outreach generated |

The rationale is always shown on the lead detail view. "Clear triggers" (funding, hiring) are used only if Apollo returns that data, since Company Research is post-MVP. Scoring several leads per LLM call is allowed to reduce cost.

### 11.4 Outreach Generator

For each lead with score ≥ 50 and a verified email, **one LLM call** produces four drafts:

| Kind | Content |
|---|---|
| `cold_email` | Subject plus body |
| `apollo_dm` | Short direct message |
| `followup_1` | Bump or value-add |
| `followup_2` | Break-up or final call |

Flow:
1. Drafts are saved with `status = draft`, lead state becomes `drafted`.
2. Founder edits and approves individually or in bulk, so the state becomes `approved`.
3. Approved cold emails are queued as `send_email` jobs. Follow-ups stay drafts until their cadence is reached.
4. `send_email`: checks `suppressed`, daily send cap, and budget/trial status, then sends through SMTP, stores `message_id_header`, sets `sent_at`, and increments `emails_sent`.
5. Footer is appended automatically: sender name, address, and unsubscribe instruction.

**Apollo DM:** Whether Apollo's API can send messages directly depends on the plan (see [Open Items](#21-open-items)). Default behavior: the Apollo DM is generated as **copy-ready text** the founder sends manually, and the founder marks it as sent. This still counts in `apollo_dms_generated`.

### 11.5 Follow-up Assistant

Hourly `followup_scan`:

```
find leads where:
  last outbound message status = sent
  AND no inbound reply
  AND not suppressed
  AND now - sent_at ≥ cadence(step)      -- default: follow-up 1 at day 3, follow-up 2 at day 7
→ lead.state = followup_due
```

- The pre-generated draft for that step is shown in the **Follow-ups** queue.
- Dashboard shows the count: *"18 prospects require follow-up today."*
- The founder approves, then it sends. After follow-up #2 with no reply, the lead moves to `no_response`.
- Cadence values are configurable.
- Inbox sync always runs before the scan, so replies are never missed.

### 11.6 Auto-Scheduling & Reply Handling

`inbox_sync` (every 10 min):

```
IMAP fetch new mail
→ match to a lead through In-Reply-To / References → message_id_header
→ ignore bounces (DSN), auto-replies, out-of-office (store as intent auto_reply)
→ insert inbound row into outreach_history → enqueue classify_reply
```

`classify_reply` (LLM, JSON): `positive | negative | question | unsubscribe` with confidence.

| Result | Action |
|---|---|
| positive (confidence ≥ 0.8) | Draft a reply including the founder's booking link. Lead state `positive`. Founder approves, then it sends and the state becomes `link_sent`. |
| positive (low confidence) or question | Placed in a "needs review" list for the founder |
| negative | State `closed`, `suppressed = true` |
| unsubscribe | State `closed`, `suppressed = true` immediately |

**Meetings Booked:** counted when the founder marks a lead as booked (`booked_at` set, state `booked`). A Calendly webhook is not part of Phase 1. The dashboard labels the number "Meetings Booked" and the lead detail shows "link sent" separately.

### 11.7 Sales Dashboard

`GET /dashboard/summary` returns:

| Tile | Query |
|---|---|
| Prospects Found | count of `prospects` |
| Hot Leads | `leads` where `band = 'hot'` |
| Messages Ready | `outreach_history` outbound `draft` or `approved`-unsent |
| Follow-ups | `leads` where `state = 'followup_due'` |
| Meetings Booked | `leads` where `state = 'booked'` |

Also returns: the active ICP summary line (e.g. *ICP: Indian B2B Companies | 50-500 Employees | Target: HR Heads / Founders*), running job progress, and budget remaining and trial days left. Every tile links to its filtered list. No caching in Phase 1. The queries are indexed counts.

**Pipeline & Analytics page:** a simple funnel of lead counts per state plus usage counters. No advanced analytics.

---

## 12. LLM Layer

```
LLMClient.generate_structured(task, schema, input, startup_id)
  ├─ BudgetGate.reserve
  ├─ load versioned prompt template
  ├─ provider call (timeout 30 s, one retry on transient error)
  ├─ validate JSON with Pydantic (one repair retry)
  └─ settle actual cost, log prompt_version and token counts
```

- One provider, configured by `LLM_PROVIDER` and model name settings. The interface is provider-agnostic, so switching is a config change.
- A cheaper model is used for scoring and intent classification, and a stronger one for outreach copy.
- Prompts live in `app/llm/prompts/` with a version string and have unit tests on fixtures.
- Apollo data and inbound email text are **untrusted input** in prompts: wrap them in delimiters and instruct the model to treat them as data only. LLM output never triggers actions without validation.
- Every LLM function has a deterministic fallback path (manual entry or "needs review") if output stays invalid.

---

## 13. API Reference

Base path: `/api/v1`. All routes except signup and login require a valid JWT. Errors use `{ "code": "...", "message": "...", "details": {} }`.

| Area | Endpoint | Purpose |
|---|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /me` | Account and session |
| ICP | `POST /icps`, `GET /icps`, `GET /icps/{id}`, `PUT /icps/{id}` | Create (LLM parse), edit, confirm |
| Discovery | `POST /icps/{id}/discover` | Start discovery job |
| Prospects | `GET /prospects`, `GET /prospects/{id}` | Company list and detail |
| Decision makers | `GET /decision-makers` | Contact list |
| Leads | `GET /leads?band=&state=`, `GET /leads/{id}`, `POST /leads/{id}/rescore`, `POST /leads/{id}/mark-booked` | Scored leads |
| Outreach | `GET /messages?lead_id=&status=`, `PATCH /messages/{id}`, `POST /messages/approve`, `POST /leads/{id}/generate` | Draft, edit, approve |
| Follow-ups | `GET /followups`, `POST /followups/{id}/approve` | Follow-up queue |
| Replies | `GET /replies`, `POST /replies/{id}/respond` | Inbound replies and booking responses |
| Dashboard | `GET /dashboard/summary` | Tiles |
| Pipeline | `GET /pipeline/funnel` | Funnel counts |
| Jobs | `GET /jobs/{id}`, `GET /jobs?status=`, `POST /jobs/{id}/retry` | Progress and retry |
| Usage | `GET /usage` | Cap, spent, counters, trial days |
| Settings | `GET /settings`, `PUT /settings` | Company profile, SMTP/IMAP, booking link, sender identity |
| Health | `GET /healthz` | Liveness |

Conventions: cursor pagination (`limit`, `cursor`), Pydantic validation on all input, and never returning secrets.

---

## 14. Frontend

Navigation follows the PRD blueprint:

```
AI SALES COPILOT
├── Dashboard            Action center, tiles, job progress, budget meter
├── ICP Builder          Description box → editable criteria → confirm
├── Prospects            Companies found
├── Leads                Scored list, band filter, rationale panel
├── Decision Makers      Contacts with email status
├── Outreach             Drafts, editor, approve (email and Apollo DM)
├── Follow-ups           Pending queue with pre-generated copy
├── Pipeline & Analytics State funnel and usage counters
└── Settings             Company, user, mailbox (SMTP/IMAP), booking link, usage
                         (billing is a placeholder: "Pilot plan")
```

**UX requirements:**
- Show job progress (`JobProgress`) for every long operation, including partial failures with a retry button.
- Show the AI rationale next to every score.
- A persistent `BudgetMeter` and trial-days-left indicator.
- Every list has loading, empty, and error states.
- All outbound messages require an explicit approve action.
- Plain wording for errors ("Apollo is slow right now. We'll retry automatically.").

---

## 15. Error Handling

| Failure | Behavior |
|---|---|
| Apollo 429 / 5xx / timeout | Retry with backoff (max 3), then mark the item failed and the job `partial` |
| Apollo zero results | UI suggests broadening ICP filters |
| Apollo auth or quota error | Job `failed` with a clear message, not retried blindly |
| LLM invalid JSON | One repair retry, then flag the item `needs_review` |
| LLM timeout | Retry once, then skip the item without failing the whole batch |
| Budget exhausted | Job `paused_budget`, banner shown, no further paid calls |
| Trial expired | Read-only mode with a notice |
| SMTP failure | Message `failed` with error, retry allowed from the UI |
| Hard bounce | Message `bounced`, `suppressed = true` |
| IMAP failure | Retry on the next timer, show "mailbox disconnected" in Settings after 3 consecutive failures |
| Worker crash | Stale lock recovery re-queues the job |
| Unhandled API error | Error envelope with request ID, logged and sent to Sentry |

---

## 16. Testing Strategy

| Priority | Suite | Must prove |
|---|---|---|
| 1 | **Tenant isolation** | For every endpoint, Startup A using Startup B's IDs gets 404. At DB level, with `app.current_startup_id` = A, `SELECT` on B's rows returns zero and `INSERT` with B's `startup_id` fails. |
| 2 | **Budget gate** | N parallel reservations never exceed the cap. Failed calls release reservations. |
| 3 | **State machine** | Valid transitions pass, invalid ones raise, `suppressed` blocks sending. |
| 4 | **Provider failure paths** | Mocked Apollo, LLM, SMTP, IMAP: timeouts, 429, malformed JSON, auth errors. |
| 5 | **Job queue** | No double-claim under concurrency, stale lock recovery, retry and backoff. |
| 6 | **Prompt fixtures** | Schema validity, score range, band mapping. |
| 7 | **E2E smoke** | signup → ICP → discover (mocked Apollo) → score → draft → approve → send (mock SMTP) → inbound reply → classify → booking-link response. |

CI runs all suites on every pull request. The isolation and budget suites block merges.

---

## 17. Deployment (Hostinger VPS)

```yaml
# docker-compose.yml (outline)
services:
  caddy:     # TLS, reverse proxy to web and api
  web:       # Next.js
  api:       # FastAPI (uvicorn, 2 workers)
  worker:    # python -m app.jobs.worker
  postgres:  # volume-mounted data
```

- **CI/CD:** GitHub Actions runs lint and tests, builds images, and deploys over SSH. Alembic migrations run on each deploy.
- **Environments:** `staging` and `production` as separate compose stacks.
- **Backups:** nightly `pg_dump` to off-server storage, 14-day retention, with a **restore test before the pilot opens**. A single VPS has no redundancy, so backups are the safety net.
- **Firewall:** only ports 80, 443, and SSH (key-only) open. Postgres is never exposed publicly.
- **Monitoring:** Sentry for errors, an uptime ping on `/healthz`, and container logs in JSON.
- **Portability:** no Hostinger-specific features. For the Phase 2 AWS move, Postgres becomes RDS, containers move to ECS, and Caddy is replaced by ALB. No application changes are required.

---

## 18. Configuration

`.env.example`:

```bash
# App
APP_ENV=production
APP_BASE_URL=https://www.bluecode-os.com
JWT_SECRET=
JWT_EXPIRE_MINUTES=720
APP_ENCRYPTION_KEY=              # 32-byte key, base64

# Database
DATABASE_URL=postgresql://app_user:...@postgres:5432/founder_os      # non-owner role (RLS applies)
MIGRATION_DATABASE_URL=postgresql://owner:...@postgres:5432/founder_os
WORKER_DATABASE_URL=postgresql://worker_user:...@postgres:5432/founder_os

# Plan and budget
TRIAL_DAYS=15
TRIAL_CAP_MINOR=100000           # ₹1,000 in paise
USD_INR_RATE=85
DEFAULT_DAILY_SEND_CAP=30
MAX_PROSPECTS_PER_SEARCH=50
SCORE_MIN_FOR_OUTREACH=50
FOLLOWUP_1_DAYS=3
FOLLOWUP_2_DAYS=7

# Apollo
APOLLO_API_KEY=
APOLLO_COST_ORG_SEARCH_MINOR=
APOLLO_COST_PEOPLE_SEARCH_MINOR=
APOLLO_COST_EMAIL_REVEAL_MINOR=

# Secrets at rest (32 random bytes, base64)
APP_ENCRYPTION_KEY=

# LLM: choose ONE provider
LLM_PROVIDER=openai              # openai | anthropic | ollama
LLM_MODEL_FAST=                  # scoring, classification (no default: set explicitly)
LLM_MODEL_QUALITY=               # ICP parsing, outreach copy (no default: set explicitly)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://ollama:11434
LLM_PRICE_INPUT_USD_PER_MTOK=3.0   # PLACEHOLDER: set to your model's real price
LLM_PRICE_OUTPUT_USD_PER_MTOK=15.0 # PLACEHOLDER: set to your model's real price
USD_INR_RATE=85

# Monitoring
SENTRY_DSN=
```

Per-startup SMTP/IMAP credentials are entered in Settings and stored encrypted in the database. They are not environment variables.

---

## 19. Build Plan (Sprints)

| Sprint | Deliverables | Exit criteria |
|---|---|---|
| **1. Foundation** | Repo, Docker Compose, CI, DB roles, migrations for all 9 tables, RLS policies, auth (signup, login, JWT), tenant context, jobs table and worker loop, **tenant isolation test suite** | Two test tenants cannot read or write each other's data. CI is green. |
| **2. Core services** | BudgetGate and usage tracking, `LLMClient`, encryption helper, ICP Builder (API and UI), Settings page skeleton | Founder describes a product, edits, and confirms an ICP. Budget concurrency test passes. |
| **3. Discovery** | Apollo client, `discover` and `dm_lookup` jobs, Prospects and Decision Makers pages, `JobProgress` UI, partial-failure handling | A real search fills the lists with visible progress and survives injected Apollo failures. |
| **4. Scoring & dashboard** | Scoring engine, state machine wiring, Leads page with rationale, Dashboard v1, Pipeline funnel | Dashboard tiles show real counts from `GROUP BY state`. |
| **5. Outreach** | Sequence generator, editor and approve flow, SMTP send job, footer and unsubscribe, daily cap, Apollo DM copy flow | Approved emails send from the founder's mailbox. Suppressed leads are never sent to. |
| **6. Replies & follow-ups** | IMAP sync, intent classification, follow-up scan and queue, booking-link reply, mark-booked | A positive reply produces an approvable booking-link response. Follow-up counts are accurate. |
| **7. Pilot hardening** | Trial expiry and read-only mode, usage meter UI, error and empty states, backups with restore test, Sentry, onboarding guide (SPF/DKIM/DMARC), E2E smoke test, load check with 20 tenants | Pilot-ready. Usage counters record real behavior. |

Each sprint ends with a working, deployed increment on staging.

---

## 20. Locked Decisions

| # | Decision |
|---|---|
| 1 | **Modular monolith** (`api` + `worker` from one codebase), no microservices. |
| 2 | **No Redis.** Postgres is the queue, lock, and counter store. |
| 3 | **9-table schema** following the PRD hierarchy, plus `jobs`. Replies, integrations, and suppression are columns, not tables. |
| 4 | **SMTP/IMAP through the founder's own mailbox** is the only email channel in Phase 1. No SendGrid. |
| 5 | **Founder approval required** before any message is sent to a prospect. |
| 6 | **Meetings Booked** is counted when the founder marks a lead booked. No Calendly webhook in Phase 1. |
| 7 | **One user per startup**, with the `role` column present for Phase 2. |
| 8 | **Three supported LLM providers** (OpenAI, Anthropic, Ollama local) behind one interface. The operator selects ONE per deployment with `LLM_PROVIDER`; it is not a per-customer choice. No LangChain. *(Changed from "one provider" on request.)* |
| 9 | **One plan** (`pilot`): 15-day trial and ₹1,000 hard cap. |
| 10 | **Money in paise (integers).** USD-billed costs converted by a fixed config rate. |
| 11 | **404 for cross-tenant access**, RLS enforced as a non-owner role. |
| 12 | **"Research credits"** from the trial entitlement are treated as the prospect and DM lookup allowance, since Company Research is post-MVP. |

---

## 21. Open Items

These must be resolved by the sprint shown. None block Sprint 1.

| # | Question | Needed by | Owner |
|---|---|---|---|
| 1 | ~~Which LLM provider~~ **Decided: OpenAI, Anthropic and Ollama are all supported.** Still needed: which one to run in production, the exact model names (`LLM_MODEL_QUALITY`, `LLM_MODEL_FAST`), the API key, and the real per-token prices for the budget gate | Before the pilot | Product owner |
| 2 | **Apollo plan and API access:** which endpoints are available, per-credit costs, and whether the API can send direct messages (otherwise Apollo DM is copy-ready text only) | Sprint 3 start | Product owner |
| 3 | **Legal review** of Apollo's data terms and cold-email rules (CAN-SPAM, GDPR, DPDP) for the intended pilot | Before the pilot opens | Product owner |
| 4 | **Pilot entitlements:** the exact prospect, DM, and email limits behind the single plan (default: 50 prospects per search, bounded by ₹1,000 cap) | Sprint 2 | Product owner |
| 5 | **Mailbox providers** founders will use (Gmail and Google Workspace need app passwords or OAuth, as plain SMTP login is often disabled) | Sprint 5 start | Tech lead |
| 6 | **Hostinger VPS sizing** (recommended minimum: 4 GB RAM, 2 vCPU) | Sprint 1 | Tech lead |

---

## 22. PRD Inconsistencies & How We Resolve Them

| PRD statement | Issue | Resolution |
|---|---|---|
| "8-stage pipeline" but 7 stages listed | Count mismatch | We implement the 7 listed stages. |
| "Research & Score" stage | Company Research is post-MVP | In Phase 1 this stage is scoring only, using data returned by Apollo. |
| Capability matrix has 8 MVP modules, MVP section says 7 | Prospect Finder and DM Finder are merged in the spec | We build 7 functional modules (Prospect and DM Finder is one pipeline). |
| "60% margin on all paid tiers" but Pro is 50% | Arithmetic inconsistency | Not relevant to Phase 1. Flag for Phase 2 pricing. |
| "50 Research Credits" in the trial | Company Research is post-MVP | Treated as the prospect and DM lookup allowance. |
| PRD architecture mentions microservices | Over-engineered for 15-20 tenants | Modular monolith, with module boundaries that allow a later split. |
| PRD lists SendGrid | Not needed with SMTP/IMAP through the founder's mailbox | Deferred. |
| Margin figures reflect API costs only | Hosting, payment fees, tax, and support are excluded | Track actual costs during the pilot. |

---

## 23. Definition of Done (MVP)

The MVP is complete when **all** of the following are true:

- [ ] All 7 modules work end to end on staging and production.
- [ ] Tenant isolation suite passes, with zero cross-tenant leaks across API and DB layers.
- [ ] The ₹1,000 cap cannot be exceeded under concurrent load, and the UI explains when it is reached.
- [ ] The 15-day trial expires into read-only mode.
- [ ] Every long-running operation shows live progress, and partial failures are visible and retryable.
- [ ] Apollo, LLM, SMTP, and IMAP failure paths are tested and produce clear user-facing messages.
- [ ] No message is sent without founder approval. Suppressed leads are never contacted. Every email has an unsubscribe line.
- [ ] Dashboard tiles match database state.
- [ ] Usage counters record prospects, DM lookups, messages generated, and emails sent per startup.
- [ ] Nightly backups run and a restore has been tested.
- [ ] E2E smoke test passes in CI.
- [ ] Open Items 1-3 are resolved and a pilot onboarding guide exists.

---

## 24. Implementation Notes: Sprint 1 (Foundation)

Where the code intentionally differs from, or adds to, the plan above. Each item needs sign-off if you disagree.

| Area | What was built | Why |
|---|---|---|
| Data access | SQLAlchemy **Core** with explicit SQL (no ORM `models/` package yet) | RLS and tenant context are easier to reason about and test with explicit SQL. ORM models can be added in Sprint 2 if wanted. |
| Composite foreign keys | `prospects`, `decision_makers`, `leads`, `outreach_history` reference their parent with `(id, startup_id)` | Implements rule 7.1.7 in the database: a row can never point at another tenant's parent. Tested. |
| `auth_lookup` policy | Extra SELECT-only policy on `users`, matching only `app.auth_email` | Login must find a user by email before the tenant is known. Exposes exactly one row, never writes. Tested. |
| `worker_queue` policy | Policy on `jobs` only, for `worker_user` | Lets the worker claim jobs across tenants. Every other table still needs a tenant context. Tested. |
| RLS setting parsing | Policies use `nullif(current_setting(...), '')::uuid` | After a transaction ends, a pooled connection keeps an empty-string setting; a bare cast would error. Tested. |
| Login throttle | In-memory: 5 failures / 15 min per email and 20 per IP | Single-process pilot deployment, no Redis. Resets on restart. Move to the database if the API runs multiple replicas. |
| Check constraints | Added on status, role, band, state, kind and similar columns | Bad values are rejected at the database, not only in code. Sprint 4 may extend the lead `state` list. |
| Extra endpoints | `GET /usage`, `GET /healthz`, `POST /jobs/{id}/retry` | Needed for the trial meter, liveness checks, and the retry button from the PRD error-handling requirement. |
| `web` container | Not yet in `docker-compose.yml` | Frontend starts in Sprint 2. Caddy serves a placeholder until then. |
| Worker timers | Not yet implemented | `inbox_sync` and `followup_scan` arrive with their job types in Sprint 6. |
| Migration owner | Compose uses the Postgres superuser as the migration role | Fine for the pilot. App and worker roles are non-superuser and cannot bypass RLS. |

### Running locally

```bash
cp .env.example .env              # fill in passwords and JWT_SECRET
docker compose up -d --build      # postgres, migrate, api, worker, caddy
curl http://localhost/healthz
```

### Running the tests

```bash
cd backend && pip install -e ".[dev]"
export TEST_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres   # a Postgres superuser
pytest tests/isolation   # tenant isolation (merge gate)
pytest tests/jobs        # job queue and worker (merge gate)
pytest tests/api         # auth and API
```

Tests create a throwaway `founder_os_test` database, create the two runtime roles, run the real migration, and then connect as `app_user` / `worker_user`, so Row-Level Security is exercised exactly as in production.

---

## 25. Implementation Notes: Sprint 2 (Core Services, ICP Builder, Settings)

### LLM providers

| Provider | Endpoint used | Structured output | Cost in the budget gate |
|---|---|---|---|
| OpenAI | `POST {base}/chat/completions` | `response_format: json_object` | Tokens x configured price x `USD_INR_RATE` |
| Anthropic | `POST {base}/v1/messages` | Instructed JSON, parsed and validated | Tokens x configured price x `USD_INR_RATE` |
| Ollama (local) | `POST {base}/api/chat` with `format: json` | Native JSON mode | **Rs 0.** Still blocked when the trial has ended or the account is suspended |

All three map failures identically: timeouts, connection errors, HTTP 429 and 5xx become `TransientError` (one automatic retry, then the job backs off); 401/403/404 become `LLMConfigError` (operator must fix); anything else is `LLMError`. Invalid model output gets **one repair attempt**, after which `LLMOutputError` is raised and the tokens already spent are still charged.

Operator notes:
- **Model names and prices are not defaulted.** If `LLM_MODEL_*` is empty the API reports "not configured" and the ICP page falls back to manual entry. The default prices in `.env.example` are placeholders; the Rs 1,000 cap is only as accurate as the prices you configure.
- **Ollama on the pilot VPS:** start it with `docker compose --profile ollama up -d`, then `docker compose exec ollama ollama pull <model>`. Small models need roughly 8 GB of RAM, run slowly without a GPU, and follow the JSON instructions less reliably, so expect more "manual entry" fallbacks. `OLLAMA_TIMEOUT_SECONDS` defaults to 180 s.
- Some newer OpenAI models reject a `temperature` value. If calls fail with HTTP 400, set `OPENAI_SEND_TEMPERATURE=false`.

### Budget gate (`core/budget.py`)

`reserve -> provider call -> settle(actual)` as specified in section 8, each step its own committed transaction. Additions beyond the plan: trial expiry and suspension are enforced inside the same atomic statement (even free/Ollama calls are refused after the trial ends), actual cost is clamped so the `spent + reserved <= cap` constraint can never be violated, and only whitelisted usage counters can be incremented.

### ICP Builder and Settings

| Item | Behavior |
|---|---|
| `POST /icps` | Runs the AI parse **synchronously** (one short call), as written in 11.1, rather than as a background job. If the AI is unavailable, unconfigured, over budget or returns unusable output, the ICP is still created empty with `parse_status: "manual"` so the founder can fill it in. |
| `POST /icps/{id}/reparse` | Added. The pilot allows 1 ICP and the app role cannot delete, so this is how a founder starts over. Resets confirmation; leaves existing data untouched if the AI fails. |
| Confirmation | Needs at least one industry, country and job title. Any later edit returns the ICP to draft. |
| Industry mapping | `apollo_filters.py` is a **seed list** of LinkedIn-style industry names plus aliases ("SaaS", "HR Tech", "B2B SaaS"...). It must be verified against the real Apollo plan in Sprint 3 (Open Item 2). Unmatched industries are shown to the founder, never silently dropped. Job titles and locations are free text in Apollo and are not mapped. |
| `GET/PUT /settings` | Company name, sender name and postal address, https booking link, encrypted SMTP and IMAP credentials. Only the fields sent are changed; `null` clears a field. Passwords are write-only. |
| Mailbox encryption | AES-256-GCM, key from `APP_ENCRYPTION_KEY`. Each blob is bound to its tenant and field, so a blob copied to another tenant or column cannot be decrypted. Saving mailbox credentials without a key returns 503 rather than storing them unencrypted. |
| Frontend | Next.js app with login/signup, app shell following the PRD navigation, ICP Builder, Settings, and a setup-checklist dashboard. Pages for later modules are labeled with the sprint they arrive in. |

### Verification status at the end of Sprint 2

Run and passing in the authoring environment: the AES-GCM crypto module, JWT claim checks, the login throttle, the JSON-extraction helpers, and the Apollo industry mapper. Compiled and import-checked only: all other Python (the sandbox could not install FastAPI or Postgres) and the frontend (syntax-checked and type-checked against stubbed external types, **not built**). The test suites in `backend/tests` exercise all of it against real Postgres in CI; the first CI run is the real verification.
