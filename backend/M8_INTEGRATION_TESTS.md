# M8 — Release-blocking integration tests

M8 adds a separate database-backed release gate without changing the MVP architecture or the existing fast unit-test command.

## Coverage

- **TI/BG structural scope guard:** a test-only global Mongoose plugin fails tenant-owned queries without `startupId` and aggregates whose first `$match` lacks `startupId`; positive controls prove correctly scoped forms execute.
- **TI-05 tenant isolation:** usage record lists are tenant-scoped, foreign workspace IDs are rejected, and the selected workspace summary uses only that workspace's counters.
- **BG-01 budget concurrency:** 50 parallel real MongoDB reservation requests against a ₹1.00 cap accept exactly 10 reservations of 10 paise, reject 40, and retain `committed + reserved <= cap`.
- **BG-12 atomicity:** a deliberately failed usage-ledger insert inside `finalizeReservation` must roll back both committed and reserved counter changes.
- **BG-07 reconciliation:** the actual CLI is tested in dry-run and `--fix` modes; it must report drift without mutation first, then reconcile the committed counter to successful/failed ledger cost.

## Run

From `backend/`:

```powershell
pnpm install
pnpm test:integration
pnpm typecheck
pnpm test
pnpm build
```

`pnpm install` is needed once to resolve the new dev dependency and update `pnpm-lock.yaml`. The first integration run downloads the MongoDB binary used by `mongodb-memory-server`; subsequent runs can use its local cache. The integration suite uses a single-node **MongoDB replica set**, not a standalone server, because the usage commit/ledger write uses transactions.

The integration tests create and drop only the hard-coded disposable database `bluecode_os_m8_test` on the in-memory process. They do not connect to the application's `.env` database. Do not replace the in-memory URI with a developer or production database.

## Limits

These tests cover the selected M8 release blockers listed above. They do not claim that every test in `docs/SECURITY_AND_TESTING.md` has been implemented; the broader authentication, draft concurrency, DNC, and AI safety matrices remain governed by that document.
