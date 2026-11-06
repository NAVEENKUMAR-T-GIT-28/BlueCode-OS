import test from 'node:test';
import assert from 'node:assert/strict';

// Set environment before importing the application graph (including the Supabase client).
process.env.JWT_SECRET ||= 'test-only-secret-that-is-at-least-thirty-two-characters';
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { createApp } = await import('../src/app.js');

test('application imports and composes every module without startup import errors', async () => {
  const app = createApp({ port: 0, nodeEnv: 'test', corsOrigins: [], trustProxy: false });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    const address = server.address();
    const health = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');

    const missing = await fetch(`http://127.0.0.1:${address.port}/api/no-such-route`);
    assert.equal(missing.status, 404);
    const body = await missing.json();
    assert.equal(typeof body.error, 'string');
    assert.equal(body.code, 'ROUTE_NOT_FOUND');
    assert.ok(body.requestId);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
