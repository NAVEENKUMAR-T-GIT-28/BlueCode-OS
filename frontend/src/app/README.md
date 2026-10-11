# Application layer

This folder is the target home for app-wide composition, routing, guards and layouts. Sprint 1 keeps the existing runtime in `src/App.tsx` while the migration plan is staged. Move only code that has been checked for behavior parity.

## Rules
- App-wide session/workspace lifecycle belongs in `app/`.
- The shared shell belongs in `app/layouts/`.
- Route paths and navigation belong in `app/routing/`.
- Keep existing paths, query strings, history behavior, and workspace selection semantics stable.
