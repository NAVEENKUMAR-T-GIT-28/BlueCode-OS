# Startup module

HTTP routes are currently composed in [0m`routes/index.js`. New logic should be extracted into this module's `controllers/`, `services/`, `repositories/` and `validators/` directories. Keep HTTP concerns in controllers, business rules in services, Supabase queries in repositories, and request schemas in validators. Preserve tenant scoping from the verified request context.
