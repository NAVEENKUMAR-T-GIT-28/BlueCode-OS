import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../shared/api-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method) || req.path === '/health') return next();
  const origin = req.header('origin');
  const marker = req.header('x-requested-with');
  if (origin !== env.CLIENT_ORIGIN || marker !== 'XMLHttpRequest') {
    return next(new ApiError(403, 'FORBIDDEN', 'Request origin could not be verified'));
  }
  next();
};
