# M5 — Draft-first outreach implementation notes

This implementation covers the approved `outreachCampaigns` and `outreachMessages` collections and the `/campaigns` and `/messages` API contracts. It does not amend `DB_ARCHITECTURE.md` or introduce collections.

## Implemented

- Campaign creation for a tenant-owned active ICP, list/detail, rename while draft, submit/approve/pause/resume/complete/cancel state transitions.
- Campaign cancellation updates the campaign and cancels unsent `draft`/`ready` messages in one MongoDB transaction.
- Draft creation validates tenant ownership and contact/prospect relationships, business-email presence, DNC status and campaign state.
- Server-generated idempotency key `draft:{campaignId}:{decisionMakerId}:{step}`, unique per tenant; in-process single-flight coalesces concurrent identical requests.
- Any edit resets approval to `pending`, status to `draft`, and clears approver fields.
- Human approval, rejection/revision status, final DNC and campaign checks at handoff, repeat handoff logging, and founder-reported sent logging.
- `handoff` returns `{to, subject, body}` only. It does not open a browser, generate a `mailto:` URI on the server, send email, schedule a follow-up, or claim delivery.
- Local drafts are produced by a deterministic mock fixture while `LLM_MODE=mock`. `LLM_MODE=live` fails closed because no real LLM adapter and no approved `llm.draft_message@1` estimate exist.
- Versioned draft usage records count against the existing `emails` usage metric, with the matching zero-cost mock ledger entry.

## Frozen-schema limitation requiring an owner decision

The API contract accepts a `reason` on rejection and a `note` when requesting revision, but the frozen `outreachMessages` schema has no review-note fields and `salesActivities` has no rejection/revision event type. The implementation validates these inputs but does **not** persist them rather than adding an unapproved field or enum. Persisting reviewer notes would require an explicit architecture amendment before implementation.

## Operational note

Models use `autoIndex: false`, consistent with the existing database architecture. Apply the approved indexes through the project's controlled index/deployment procedure before relying on the unique `{ startupId, idempotencyKey }` index in production. The service still coalesces identical drafts in-process.
