# BlueCode OS — Decision Log

One row per decision. Never delete rows; supersede them. Dates are ISO.

| ID | Date | Decision | Status | Reason | Revisit when |
|---|---|---|---|---|---|
| D1 | 2026-10-10 | Pilot uses one server-side Apollo key behind a `credentialProvider` | **Proposed (risk open)** | Fastest for pilot | Before any non-founder customer; needs Apollo answers C1–C3 (`APOLLO_INTEGRATION.md §4`) |
| D2 | 2026-10-10 | Outbound is `mailto:` handoff only; no server-side sending | **Proposed, needs product owner confirmation** | Observable, low-risk; sequences unverified. Narrows tech spec Phase 1 (sequences, auto-scheduling) | Apollo sequence capability VERIFIED and licensed |
| D3 | 2026-10-10 | No job queue and no scheduled jobs; time rules evaluated lazily | Accepted | Smaller MVP, fewer failure modes | Activity sync or multi-instance deployment |
| D4 | 2026-10-10 | Money stored as integer paise (INR) | Accepted | No float errors | Multi-currency billing |
| D5 | 2026-10-10 | Trial cap from config, default ₹250 (25000 paise) | Accepted | Docs conflict (₹1,000 vs ₹250); config makes it trivial to change | Pilot cost data |
| D6 | 2026-10-10 | Lead score is deterministic; LLM writes explanation only | Accepted | Reproducible, cheap, comparable | Evidence AI adjustment improves outcomes |
| D7 | 2026-10-10 | JWT in httpOnly cookie, 24 h, key-rotation list, membership checked every request | Accepted | No extra collection | Mobile/SSO |
| D8 | 2026-10-10 | MongoDB runs as a (single-node) replica set | Accepted | Transactions for workspace creation and usage commit | n/a |
| D9 | 2026-10-10 | API base `/api/v1`; one error registry; 402 for plan/budget, 429 for request rate only | Accepted | Consistency across backend, API doc, frontend | If product prefers 429 for budget, change registry + tests only |
| D10 | 2026-10-10 | One prospect per company per startup; `prospects.icpId` is the immutable origin ICP; scores are per-ICP | Accepted | Fits current schema without a many-to-many collection | Per-ICP pipeline tracking needed (Growth/Pro multi-ICP) |
| D11 | 2026-10-10 | Missing score components are excluded and rescaled; `coverage` stored; coverage < 0.5 caps category at `medium` | Accepted | Fair to sparse data, honest about confidence | Scoring review after pilot |
| D12 | 2026-10-10 | Reply handling in MVP is founder-pasted (`logReply`); no automatic reply retrieval | Accepted | `reply_read` capability unverified | `reply_read` VERIFIED |
| D13 | 2026-10-10 | Estimated spend after provider timeout is committed (conservative) | Accepted | Provider may have charged | If Apollo exposes reliable usage reads |