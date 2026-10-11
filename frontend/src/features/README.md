# Feature modules

Feature modules own feature-specific UI, state/hooks, API functions and types. Create subfolders only when a feature has a real need for them. Prefer feature-local modules over a generic global `services/` directory.

Planned owners:
- `auth`: login, registration, session-related UI
- `workspaces`: workspace picker and active workspace selection
- `dashboard`
- `icps`
- `prospects`
- `contacts`
- `signals`
- `campaigns`
- `messages`
- `activities`
- `next-actions`
- `usage`
- `settings`

Do not add provider credentials or direct Apollo/LLM HTTP requests to the browser. The frontend continues to call BlueCode OS backend endpoints through the shared API client.
