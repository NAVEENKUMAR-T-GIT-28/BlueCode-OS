import { ZodError } from 'zod';

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  let status = Number(err.status || err.statusCode) || 500;
  let code = err.code || `HTTP_${status}`;
  if (status === 400 && code === 'HTTP_400') code = 'VALIDATION_ERROR';
  if (status === 404 && code === 'HTTP_404') code = 'RESOURCE_NOT_FOUND';
  if (status === 409 && code === 'HTTP_409') code = 'RESOURCE_CONFLICT';
  let message = status >= 500 ? 'An unexpected server error occurred' : (err.message || 'Request failed');
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Request validation failed';
    details = err.flatten();
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request payload is too large';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Request body contains invalid JSON';
  } else if (err.code === '23505' || err.code === 'PGRST116' || err.code === '23503' || err.code === '23502' || err.code === '22P02') {
    status = ['23505', '23503'].includes(err.code) ? 409 : (err.code === 'PGRST116' ? 404 : 400);
    code = err.code === '23505' ? 'RESOURCE_CONFLICT' : err.code === '23503' ? 'FOREIGN_KEY_CONFLICT' : err.code === 'PGRST116' ? 'RESOURCE_NOT_FOUND' : 'VALIDATION_ERROR';
    message = err.code === '23505' ? 'A record with these details already exists' : err.code === '23503' ? 'This operation conflicts with related records' : err.code === 'PGRST116' ? 'Requested resource was not found' : 'Invalid database input';
  }

  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.id, method: req.method, path: req.originalUrl, error: err?.stack || String(err) }));
  res.status(status).json({
    success: false,
    error: message,
    code,
    ...(details ? { details } : {}),
    requestId: req.id,
  });
}
