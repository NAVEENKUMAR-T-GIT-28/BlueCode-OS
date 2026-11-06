import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  req.id = req.get('x-request-id')?.slice(0, 128) || randomUUID();
  res.setHeader('x-request-id', req.id);
  res.setHeader('Cache-Control', 'no-store');
  next();
}
