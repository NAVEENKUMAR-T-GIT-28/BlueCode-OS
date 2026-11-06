// Backwards-compatible export; new modules should import from infrastructure/database.
export { db, audit } from './infrastructure/database/supabase.js';
