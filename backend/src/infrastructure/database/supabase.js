import { createClient } from '@supabase/supabase-js';

const timeoutMs = Math.max(1000, Number(process.env.SUPABASE_TIMEOUT_MS || 5000));
const timedFetch = (input, init = {}) => {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(input, { ...init, signal });
};

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: timedFetch } },
);

export const audit = (userId, action, meta = {}) =>
  db.from('audit_events').insert({ user_id: userId, action, meta }).then(() => {}, () => {});
