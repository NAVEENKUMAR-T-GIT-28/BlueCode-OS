const required = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
export function loadConfig() {
  for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  let supabaseUrl;
  try { supabaseUrl = new URL(process.env.SUPABASE_URL); } catch { throw new Error('SUPABASE_URL must be a valid URL'); }
  if (!['https:', 'http:'].includes(supabaseUrl.protocol)) throw new Error('SUPABASE_URL must use HTTP or HTTPS');
  const origins = (process.env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  return Object.freeze({
    port: Number(process.env.PORT || 4000),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins: origins,
    trustProxy: process.env.TRUST_PROXY === 'true',
    jwtSecret: process.env.JWT_SECRET,
    supabaseUrl: supabaseUrl.toString().replace(/\/$/, ''),
  });
}
