import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestIdMiddleware } from '../src/middleware/request-id.js';

afterEach(() => { vi.restoreAllMocks(); });

describe('M7 error logging and response redaction', () => {
  it('does not expose raw provider error text, credential-like values, or stack traces', async () => {
    const secretText = 'apollo_key=private-api-key-value password=private-password-value';
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/forced-error', () => { throw new Error(secretText); });
    app.use(errorHandler);

    const response = await request(app).get('/forced-error').set('x-request-id', 'm7-safe-request-id').expect(500);
    expect(response.body).toMatchObject({
      error: { code: 'INTERNAL', message: 'An unexpected error occurred', requestId: 'm7-safe-request-id' },
    });
    expect(response.text).not.toContain(secretText);
    expect(response.text).not.toContain('private-api-key-value');
    expect(response.text).not.toContain('private-password-value');
    expect(response.text).not.toContain('Error: apollo_key');
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).toContain('m7-safe-request-id');
    expect(line).not.toContain('private-api-key-value');
    expect(line).not.toContain('private-password-value');
  });

  it('replaces malformed request IDs instead of reflecting arbitrary header content', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/request-id', (req, res) => res.json({ requestId: req.requestId }));
    const response = await request(app).get('/request-id')
      .set('x-request-id', 'bad request id with spaces').expect(200);
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    expect(response.body.requestId).not.toContain('leaked');
  });
});
