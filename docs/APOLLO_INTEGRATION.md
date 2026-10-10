# BlueCode OS — Apollo Integration & Capability Matrix

**Document:** `APOLLO_INTEGRATION.md`
**Purpose:** record what the configured Apollo account can actually do, and gate the backend on it.
**Rule:** a capability flag in `APOLLO_CAPABILITIES` may be enabled **only** when its row below is `VERIFIED` with evidence. Everything starts `UNVERIFIED` and **disabled**.

Nothing in this file is verified yet. Endpoint names, credit costs, and limits must be confirmed by whoever holds the Apollo account, from Apollo's current developer documentation and real test calls. The Apollo Integration Plan cites 0-credit search and sequence creation, and 1–9 credits for person enrichment, but those are claims to confirm on the actual plan, not facts for this account.

---

## 1. Capability matrix

| # | Capability (flag) | Used by | MVP? | Endpoint (fill from docs) | Required permission / key type | Plan restriction found | Credits per call (measured) | Rate limit (measured) | Evidence (link/date) | Status | Fallback if unavailable |
|--:|---|---|:-:|---|---|---|---|---|---|---|---|
| 1 | Organization search (`search_orgs`) | Discovery | Yes | | | | | | | UNVERIFIED | Manual company import (CSV/paste) |
| 2 | People search (`search_people`) | Find decision makers | Yes | | | | | | | UNVERIFIED | `addContactManually` |
| 3 | Person enrichment (`enrich`) | Business email | Yes | | | | | | | UNVERIFIED | `addContactManually` (`emailVerified=false`) |
| 4 | Credit/usage visibility (`usage_read`) | Cost reconciliation | Nice | | | | | | | UNVERIFIED | Use our estimates (`costType:'estimated'`) |
| 5 | Create sequence (`sequence_create`) | Future execution | **No** | | | | | | | DISABLED | `mailto:` handoff |
| 6 | Add contact to sequence (`sequence_enroll`) | Future execution | **No** | | | | | | | DISABLED | `mailto:` handoff |
| 7 | Retrieve activity/status (`activity_read`) | Future sync | **No** | | | | | | | DISABLED | Founder logs activity manually |
| 8 | Retrieve reply content (`reply_read`) | Future classification | **No** | | | | | | | DISABLED | Founder pastes reply (`logReply`) |

Status values: `UNVERIFIED` → `VERIFIED` (tested with evidence) → `ENABLED` (flag on in an environment) · or `BLOCKED` (not available/not permitted) · `DISABLED` (intentionally off).

---

## 2. Verification procedure (per capability)

1. Read Apollo's current documentation for the operation; record endpoint, parameters, response fields, and documented credit cost.
2. Call it once with a **small, controlled** request from a test script (not from production code). Record: HTTP status, which fields are actually returned, credits consumed (compare account credit balance before/after), rate-limit headers.
3. Save a **redacted** sample response to `server/src/tests/fixtures/apollo/<capability>.json` (no real personal data; no keys).
4. Confirm the account plan permits API use of this operation. Note any plan-gated fields (e.g. emails or phone numbers returned only on paid plans).
5. Write or update the mapper test using the fixture.
6. Fill the row (evidence link, date, verifier name) and set `VERIFIED`.
7. Enable the flag in the target environment and record that in `DECISIONS.md`.

If a fixture shows a field the mapper expects is **absent**, the mapper leaves it absent; the app does not guess.

---

## 3. Field availability (fill after verification)

| Product field | Apollo source field | Returned? | Notes |
|---|---|---|---|
| `prospects.name`, `domain`, `apolloOrganizationId` | | | |
| `firmographics.industry`, `employeeCount`, `country`, `revenueRange` | | | Required for scoring |
| `firmographics.technologies`, `keywords` | | | If absent, scoring redistributes weights |
| Job-posting / funding / growth fields (signal evidence) | | | If absent, **no signals are created** |
| `decisionMakers.fullName`, `jobTitle`, `linkedinUrl`, `apolloPersonId` | | | |
| `businessEmail`, email status | | | `emailVerified=true` only when status explicitly verified |

---

## 4. Commercial and licensing questions (get written answers)

| # | Question | Answer | Date | Source |
|--:|---|---|---|---|
| C1 | May a single BlueCode Apollo account power searches and enrichment for multiple customer startups? | | | |
| C2 | May Apollo-derived data (company/contact fields) be stored in BlueCode's database and shown to customers? | | | |
| C3 | Is a custom contract or partner agreement required for this use? | | | |
| C4 | Retention/deletion obligations for stored contact data? | | | |
| C5 | Is OAuth partner access required before any customer-facing launch? | | | |
| C6 | Are there restrictions on caching or exporting results? | | | |

**Gate:** items C1–C3 must be answered before any customer other than the founders' own pilot accounts uses live Apollo data. Until then, pilots run on the team's own Apollo account with consent, or on `APOLLO_MODE=mock`.

---

## 5. Integration behaviour (implemented once a capability is enabled)

- All calls go through `SalesDataProvider` (`Backend §8`); modules never import Apollo code.
- Timeout 15 s; retries only for search-type reads on 429/5xx; never retry paid or state-changing calls automatically.
- Errors map to `RATE_LIMITED`, `PROVIDER_FAILED`, or `CAPABILITY_DISABLED`.
- Every paid call runs inside `usage.withUsage` (reserve, call, commit or release).
- Duplicate suppression by `apolloOrganizationId`, then normalized `domain`; `apolloPersonId` for contacts.

---

## 6. Future OAuth model (not in MVP)

When C5 requires it: add an `integrations` collection (per-startup encrypted access/refresh tokens, scopes, status), swap `credentialProvider` to read the startup's tokens, add Connect/Disconnect endpoints, and request minimum scopes. No module code should need to change; this is the purpose of the provider interface.