import { ZodError } from 'zod';

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  let status = Number(err.status || err.statusCode) || 500;
  let code = err.code || `HTTP_${status}`;
  let message = status >= 500 ? 'An unexpected server error occurred' : (err.message || 'Request failed');
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Request validation failed';
    details = err.flatten();
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request payload is too large';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Request body contains invalid JSON';
  } else if (err.code === '23505' || err.code === 'PGRST116') {
    status = err.code === '23505' ? 409 : 404;
    code = err.code === '23505' ? 'RESOURCE_CONFLICT' : 'RESOURCE_NOT_FOUND';
    message = err.code === '23505' ? 'A record with these details already exists' : 'Requested resource was not found';
  }

  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.id, method: req.method, path: req.originalUrl, error: err?.stack || String(err) }));
  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    requestId: req.id,
  });
}
