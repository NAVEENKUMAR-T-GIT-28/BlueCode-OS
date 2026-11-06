# Security Checklist

- [ ] Rotate JWT secret and Supabase service-role key if they have ever been committed or shared.
- [ ] Keep `.env` out of version control.
- [ ] Confirm production CORS origins are exact HTTPS origins.
- [ ] Set `TRUST_PROXY=true` only behind a trusted proxy.
- [ ] Use a shared rate-limit store before running multiple API instances.
- [ ] Add server-side token revocation/refresh-token rotation before requiring immediate logout revocation.
- [ ] Verify every query and nested mutation has startup/tenant scope.
- [ ] Apply `requireRole` to privileged operations.
- [ ] Configure Supabase backups and review migration policy.
- [ ] Add integration tests using a dedicated non-production Supabase project.
- [ ] Verify Scalar `/reference` is protected or disabled in production if public API discovery is not desired.
- [ ] Configure structured log shipping, alerting and error monitoring.
