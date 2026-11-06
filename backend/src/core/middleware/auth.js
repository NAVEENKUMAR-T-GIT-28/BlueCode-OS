import jwt from 'jsonwebtoken';
import { HttpError } from '../errors/HttpError.js';
import { db } from '../../infrastructure/database/supabase.js';
import { mapDatabaseError } from '../../shared/helpers.js';

const issuer = process.env.JWT_ISSUER || 'bluecode-os-api';
const audience = process.env.JWT_AUDIENCE || 'bluecode-os-client';

export const signToken = (user) => jwt.sign(
  { sid: user.startup_id, role: user.role }, process.env.JWT_SECRET,
  { subject: String(user.id), expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer, audience, algorithm: 'HS256' },
);

// Verify the token cryptographically, then refresh authorization state from Postgres on
// every request. This prevents stale 7-day role claims and blocks suspended/expired tenants.
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next(new HttpError(401, 'Authentication required', undefined, 'AUTH_REQUIRED'));
  const token = header.slice(7).trim();
  if (!token) return next(new HttpError(401, 'Authentication required', undefined, 'AUTH_REQUIRED'));

  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer, audience });
    if (!claims.sub || !claims.sid) throw new Error('Missing required claims');
  } catch {
    return next(new HttpError(401, 'Invalid or expired access token', undefined, 'AUTH_INVALID_TOKEN'));
  }

  try {
    const { data: user, error: userError } = await db.from('users')
      .select('id,startup_id,role').eq('id', claims.sub).eq('startup_id', claims.sid).maybeSingle();
    if (userError) throw mapDatabaseError(userError);
    if (!user) throw new HttpError(401, 'User session is no longer valid', undefined, 'AUTH_SESSION_INVALID');

    const { data: startup, error: startupError } = await db.from('startups')
      .select('id,status').eq('id', user.startup_id).maybeSingle();
    if (startupError) throw mapDatabaseError(startupError);
    if (!startup) throw new HttpError(401, 'Workspace no longer exists', undefined, 'AUTH_SESSION_INVALID');
    if (startup.status !== 'active') throw new HttpError(403, 'This workspace is suspended', undefined, 'WORKSPACE_SUSPENDED');

    const { data: subscription, error: subscriptionError } = await db.from('subscriptions')
      .select('status,ends_at').eq('startup_id', user.startup_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (subscriptionError) throw mapDatabaseError(subscriptionError);
    if (!subscription || ['expired', 'cancelled'].includes(subscription.status) ||
      (subscription.status === 'trialing' && subscription.ends_at && Date.parse(subscription.ends_at) <= Date.now())) {
      throw new HttpError(403, 'Your trial or subscription has expired', undefined, 'SUBSCRIPTION_EXPIRED');
    }

    req.user = { id: user.id, startupId: user.startup_id, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Authentication required', undefined, 'AUTH_REQUIRED'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action', undefined, 'AUTH_FORBIDDEN'));
  next();
};
