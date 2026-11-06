import { createClient } from "@supabase/supabase-js";
export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
export const audit = (userId, action, meta = {}) =>
  db.from("audit_events").insert({ user_id: userId, action, meta }).then(() => {}, () => {});
