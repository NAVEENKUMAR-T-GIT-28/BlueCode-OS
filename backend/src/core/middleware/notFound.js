import { HttpError } from '../errors/HttpError.js';
export function notFound(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`, undefined, 'ROUTE_NOT_FOUND'));
}
