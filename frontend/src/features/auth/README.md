# Authentication feature

Sprint 2 begins the feature-by-feature migration by moving the existing `AuthPage` implementation out of `App.tsx`.

Rules:
- Keep existing routes (`/login`, `/register`) and API paths unchanged.
- Keep cookie-based session handling and existing UI classes.
- Keep provider credentials and provider calls out of the browser.
- Do not change the backend contract as part of this frontend extraction.
- Add tests or further split components only when the existing tooling supports it.
