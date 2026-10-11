import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const candidate = req.header('x-request-id');
  const safeCandidate = candidate && /^[a-zA-Z0-9._-]{1,80}$/.test(candidate) ? candidate : randomUUID();
  req.requestId = safeCandidate;
  res.setHeader('X-Request-Id', safeCandidate);
  next();
};
