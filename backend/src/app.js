import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { apiReference } from '@scalar/express-api-reference';
import { requestContext } from './core/middleware/requestContext.js';
import { errorHandler } from './core/middleware/errorHandler.js';
import { notFound } from './core/middleware/notFound.js';
import { loadModules } from './bootstrap/modules.js';
import { openApiSpec } from './docs-openapi.js';
import { db } from './infrastructure/database/supabase.js';

export function createApp(config) {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      if (config.nodeEnv !== 'production' && config.corsOrigins.length === 0) return callback(null, true);
      return callback(Object.assign(new Error('Origin not allowed by CORS'), { status: 403, code: 'CORS_ORIGIN_DENIED' }));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.API_RATE_LIMIT || 300), standardHeaders: 'draft-7', legacyHeaders: false, handler: (req, res) => res.status(429).json({ success: false, error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED', requestId: req.id }) });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT || 20), standardHeaders: 'draft-7', legacyHeaders: false, handler: (req, res) => res.status(429).json({ success: false, error: 'Too many authentication attempts. Please try again later.', code: 'AUTH_RATE_LIMITED', requestId: req.id }) });

  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', service: 'bluecode-os-api' }));
  app.get('/api/ready', async (_req, res, next) => {
    try {
      const { error } = await db.from('startups').select('id', { head: true, count: 'exact' }).limit(1);
      if (error) throw error;
      res.json({ success: true, status: 'ready', dependencies: { supabase: 'connected' } });
    } catch (error) { next(Object.assign(new Error('Database readiness check failed'), { cause: error, status: 503, code: 'DEPENDENCY_UNAVAILABLE' })); }
  });

  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));
  app.use('/reference', apiReference({ content: openApiSpec }));

  app.use('/api', globalLimiter);
  loadModules(app, { auth: authLimiter });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
