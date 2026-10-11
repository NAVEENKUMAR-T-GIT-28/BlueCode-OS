# BlueCode OS — Database Amendments

**Document:** `DB_AMENDMENTS.md`
**Historical scope:** records the rationale and disposition of proposed database changes; the MVP schema remains the 13-collection contract in `DB_ARCHITECTURE.md`.
**Rule:** `DB_ARCHITECTURE.md` is the sole coding source for models, validators, DTOs, and migrations. This register is historical context only; do not generate code from it or treat an **Adopt** entry here as a schema change unless that change has been incorporated into `DB_ARCHITECTURE.md`.

**Decision key:** Adopt = implement in MVP · Defer = do not implement; reserved for a later phase · Reject = not needed.

---

## 1. Amendment register

| ID | Collection | Change | Decision | Reason |
|---|---|---|---|---|
| A1 | `startups` | Add `spendCommitted: number`, `spendReserved: number` (integer paise, default 0, min 0). Redefine `apiSpendCap` as **integer paise** | **Adopt** | Atomic budget (Backend §10) |
| A2 | `startups` | Add `settings: { calendarLink?: string, senderName?: string, senderTitle?: string, productSummary?: string }` | **Adopt** | Personalized drafts, meeting-link text |
| A3 | `startups` | Add `trial_expired` to `status` enum (values: `active`, `trial_expired`, `suspended`) | **Adopt** | Lazy expiry, read-only mode |
| A4 | `leadScores` | Add `hot` to `category` enum (`hot`, `high`, `medium`, `low`) | **Adopt** | Tech spec bands: 90–100 / 70–89 / 50–69 / <50 |
| A5 | `leadScores` | Add `breakdown: object` (component → points, bounded), `coverage: number (0–1)`, `explanationSource: 'rules'|'ai'` | **Adopt** | Deterministic score, explicit missing-data handling |
| A6 | `leadScores` | Add index `{ startupId, prospectId, icpId, scoredAt: -1 }` | **Adopt** | Latest score per prospect-ICP pair |
| A7 | `prospects` | Add `firmographics: { industry?, employeeCount?, country?, region?, revenueRange?, technologies?: string[], keywords?: string[] }` (bounded sizes) | **Adopt** | Scoring and filtering inputs |
| A8 | `prospects` | Clarify: `icpId` = **origin ICP**, immutable after creation | **Adopt** (doc change only) | Backend D10 |
| A9 | `prospects` | Add `researchSummary?`, `researchedAt?` | **Defer** | Company research is post-MVP in the tech spec |
| A10 | `prospects` | Add index `{ startupId, status, updatedAt: -1 }` | **Adopt (provisional)** | Validate against final list queries before creating |
| A11 | `decisionMakers` | Add `source: 'apollo'|'manual'` (required, default `apollo`) | **Adopt** | Manual-contact fallback |
| A12 | `outreachMessages` | Add `step: number` (default 1, min 1, max 5) | **Adopt** | Follow-up drafts per contact |
| A13 | `outreachMessages` | Extend `status` enum with `handed_off`, `user_reported_sent` | **Adopt** | Honest `mailto:` states |
| A14 | `outreachMessages` | Add `send_unknown` to `status`; add `lastError` | **Defer** | No server-side send in MVP |
| A15 | `outreachMessages` | Unique index `{ startupId, idempotencyKey }` with key `draft:{campaignId}:{decisionMakerId}:{step}` | **Adopt** | Already in baseline; key format defined here |
| A16 | `salesActivities` | Add `metadata?: object` (per-type allowlisted keys, ≤ 2 KB) and `classification?: { intent: string, confidence: number }` | **Adopt** | Reply classification, `source:'manual'` |
| A17 | `salesActivities` | Add activity types: `handoff_requested`, `message_user_reported_sent`, `reply_logged`, `reply_classified` | **Adopt** | Real product/user actions only |
| A18 | `salesActivities` | Add types `message_queued`, `draft_opened` | **Reject** | Not observable / duplicate of A17 |
| A19 | `nextBestActions` | Add `reason: string` (required), `decisionMakerId?`, `dueAt?`, `expiresAt?` | **Adopt** | Explainability, follow-up timing, lazy expiry |
| A20 | `usageRecords` | Add `costType: 'estimated'|'reported'`, `errorCode?`, `requestId?`, `entityRef?: { kind, id }` | **Adopt** | Distinguish estimates; debugging |
| A21 | `outreachCampaigns` | Add `settings` (sequence steps) | **Defer** | Part of Apollo execution model (Backend §18) |
| A22 | new `integrations` collection | Per-startup Apollo OAuth | **Defer** | Needed only when D1 moves to OAuth |

---

## 2. Enum registry after amendments

Values marked *(reserved)* exist in the enum but **MVP code never writes them**.

| Field | Values |
|---|---|
| `startups.status` | `active`, `trial_expired`, `suspended` |
| `startups.plan` | `trial`, `starter`, `growth`, `pro` |
| `startupMembers.role` | `owner`, `admin`, `member` |
| `startupMembers.status` | `invited`, `active`, `removed` |
| `prospects.status` | `discovered`, `qualified`, `disqualified`, `do_not_contact`, *(reserved)* `enriched`, `in_sequence`, `replied`, `meeting` |
| `decisionMakers.outreachStatus` | `not_contacted`, `drafted`, `approved`, `do_not_contact`, *(reserved)* `in_sequence`, `replied` |
| `leadScores.category` | `hot`, `high`, `medium`, `low` |
| `outreachCampaigns.status` | `draft`, `pending_approval`, `approved`, `active`, `paused`, `completed`, `cancelled` |
| `outreachMessages.approvalStatus` | `pending`, `approved`, `rejected`, `revision_requested` |
| `outreachMessages.status` | `draft`, `ready`, `handed_off`, `user_reported_sent`, `cancelled`, *(reserved)* `queued`, `sent`, `delivered`, `replied`, `bounced`, `failed` |
| `salesActivities.activityType` | `prospect_discovered`, `contact_enriched`, `score_updated`, `signal_detected`, `message_approved`, `handoff_requested`, `message_user_reported_sent`, `reply_logged`, `reply_classified`, `status_changed`, `integration_error`, *(reserved)* `sequence_added`, `message_sent`, `message_replied`, `meeting_opportunity` |
| `classification.intent` | `interested`, `buying_interest`, `not_now`, `wrong_person`, `referral`, `objection`, `unsubscribe`, `out_of_office`, `other` |
| `nextBestActions.actionType` | `follow_up`, `send_reply`, `share_information`, `book_meeting`, `nurture`, `stop_outreach`, `review_prospect` |
| `usageRecords.provider` | `apollo`, `llm` |
| `usageRecords.status` | `success`, `failed`, `blocked` |

---

## 3. Index checklist (after amendments)

- [ ] `users {email}` unique
- [ ] `startupMembers {startupId,userId}` unique; `{userId,status}`
- [ ] `prospects {startupId,apolloOrganizationId}` unique partial (non-empty string)
- [ ] `prospects {startupId,icpId,status}`, `{startupId,domain}`, `{startupId,status,updatedAt:-1}` (A10, provisional)
- [ ] `decisionMakers {startupId,apolloPersonId}` unique partial; `{startupId,prospectId}`; `{startupId,businessEmail}`
- [ ] `leadScores {startupId,prospectId,scoredAt:-1}`, `{startupId,icpId,score:-1}`, `{startupId,prospectId,icpId,scoredAt:-1}` (A6)
- [ ] `outreachMessages {startupId,idempotencyKey}` unique; `{startupId,campaignId,status}`; `{startupId,approvalStatus}`
- [ ] `salesActivities {startupId,occurredAt:-1}`, `{startupId,prospectId,occurredAt:-1}`
- [ ] `nextBestActions {startupId,status,priority:-1}`
- [ ] `usageRecords {startupId,occurredAt:-1}`, `{startupId,provider,operation,occurredAt:-1}`

Create through migration scripts, not auto-index (per `DB_ARCHITECTURE.md §3.3`).

---

## 4. Infrastructure requirement

MongoDB must run as a **replica set** (a single-node replica set is sufficient) because workspace creation and usage commit use multi-document transactions.

---

## 5. Approval checklist

- [ ] Every **Adopt** item reviewed by the DB owner
- [ ] Enum registry (§2) matches `config/constants.js`
- [ ] Reserved values documented as unused
- [ ] `DB_ARCHITECTURE.md` updated and version bumped
- [ ] Mongoose models written from the merged document, not from this file alone