import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().url(),
  MONGODB_URI: z.string().min(1),
  JWT_ACTIVE_SECRET: z.string().min(32),
  JWT_PREVIOUS_SECRETS: z.string().default(''),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  // Deliberately no default: D5 requires an explicit owner-frozen value.
  TRIAL_SPEND_CAP_PAISE: z.coerce.number().int().nonnegative().safe(),
}).passthrough();

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  COOKIE_SECURE: parsed.data.COOKIE_SECURE === 'true',
  JWT_SECRETS: [parsed.data.JWT_ACTIVE_SECRET, ...parsed.data.JWT_PREVIOUS_SECRETS.split(',').map(s => s.trim()).filter(Boolean)],
};
