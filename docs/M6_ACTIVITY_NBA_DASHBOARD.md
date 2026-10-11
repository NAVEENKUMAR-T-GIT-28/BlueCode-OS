# M6 — Activity, Reply Logging, Lazy Next-Best Actions, Dashboard

## Implemented within the frozen MVP

- `GET /api/v1/activities` provides a tenant-scoped, append-only timeline with the contract's prospect/message/type/date/sort filters.
- `POST /api/v1/activities/replies` records a founder-pasted reply as `reply_logged`, validates any supplied message against the selected prospect and tenant, and then attempts classification.
- The local `LLM_MODE=mock` reply classifier is explicitly a deterministic keyword fixture, not a live LLM. Mock execution is recorded as zero-cost usage (`llm.classify_reply@1`) without a spend reservation.
- Live classification remains fail-closed because there is no live adapter or owner-approved cost estimate. In that case the reply still returns `201`, `classification: null`, and deterministic unsubscribe handling still executes.
- Unsubscribe keyword detection runs independently of classification, marks the prospect and its contacts do-not-contact through the existing prospect service, and cancels unsent `draft`/`ready` messages. It never implies a reply was synchronized from an inbox.
- Positive mock-classified replies create an explainable `book_meeting` recommendation; low-confidence/unknown replies become `other` and create `review_prospect`. Other mappings follow `BACKEND_ARCHITECTURE.md` §7.8.
- `GET /api/v1/next-actions` lazily computes overdue follow-up recommendations from recorded handoff or founder-reported-sent activity and an absence of a later logged reply. It does not schedule or send anything.
- Accept, dismiss, and complete only update recommendation status. Accept returns a route hint to the relevant message (or the message list); it does not perform outbound activity.
- `GET /api/v1/dashboard` returns today-strip metrics, recorded funnel activity, top pending actions, and the existing usage summary. No delivery/open/inbox data is inferred.
- The declared partial unique index supports the existing invariant of at most one pending action per tenant/prospect/action type. Because `autoIndex=false`, deploy it through the approved index migration procedure before relying on multi-worker concurrency.

## Frozen-contract gaps intentionally not papered over

1. `salesActivities.summary` is capped at 500 characters and its approved metadata allowlist has no `replyText` field. The implementation keeps a 500-character excerpt in `reply_logged.summary`; the full pasted body is used for the immediate classification attempt but is not persisted. Persisting full replies needs an explicit schema amendment.
2. The API accepts a dismissal `reason`, but `nextBestActions` has no reason/note field for the dismissal decision. The input is validated but not persisted rather than adding an unapproved field.
3. The architecture mentions a qualified-prospect-with-no-draft recommendation after “N days” but does not freeze N. This patch does not invent that threshold. No-reply follow-up uses only the documented `FOLLOWUP_DAYS` default of 3.
4. Live `classify_reply` remains unavailable until an adapter and owner-approved cost estimate for `llm.classify_reply@1` exist. `LLM_MODE=mock` fixture outputs must not be represented as real AI analysis.

## Validation

Run from `backend/` after applying the patch:

```powershell
pnpm typecheck
pnpm test
pnpm build
git diff --check
pnpm test:integration
```

Do not commit M6 until all checks pass and staged changes contain only the intended M6 files.
