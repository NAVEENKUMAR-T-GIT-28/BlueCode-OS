import jwt from 'jsonwebtoken';
import { HttpError } from '../errors/HttpError.js';

const issuer = process.env.JWT_ISSUER || 'bluecode-os-api';
const audience = process.env.JWT_AUDIENCE || 'bluecode-os-client';

export const signToken = (user) => jwt.sign(
  { sid: user.startup_id, role: user.role }, process.env.JWT_SECRET,
  { subject: String(user.id), expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer, audience, algorithm: 'HS256' },
);

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next(new HttpError(401, 'Authentication required', undefined, 'AUTH_REQUIRED'));
  const token = header.slice(7).trim();
  if (!token) return next(new HttpError(401, 'Authentication required', undefined, 'AUTH_REQUIRED'));
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer, audience });
    if (!claims.sub || !claims.sid || !claims.role) throw new Error('Missing required claims');
    req.user = { id: claims.sub, startupId: claims.sid, role: claims.role };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired access token', undefined, 'AUTH_INVALID_TOKEN'));
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Authentication required', undefined, 'AUTH_REQUIRED'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action', undefined, 'AUTH_FORBIDDEN'));
  next();
};
