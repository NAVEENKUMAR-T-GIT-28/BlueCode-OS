import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../shared/api-error.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: { code: 'MALFORMED_REQUEST', message: 'Malformed JSON', requestId: req.requestId } });
  }
  if (error instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: error.issues.map(issue => ({ path: issue.path.join('.'), issue: issue.message })),
        requestId: req.requestId,
      },
    });
  }
  if (error instanceof ApiError) {
    const payload: Record<string, unknown> = { code: error.code, message: error.message, requestId: req.requestId };
    if (error.details) payload.details = error.details;
    return res.status(error.status).json({ error: payload });
  }
  // Never return raw internal error messages or secrets to clients.
  console.error(JSON.stringify({ level: 'error', requestId: req.requestId, name: error instanceof Error ? error.name : 'UnknownError' }));
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'An unexpected error occurred', requestId: req.requestId } });
};
