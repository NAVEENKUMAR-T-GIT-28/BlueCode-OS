import test from 'node:test';
import assert from 'node:assert/strict';
import { openApiSpec } from '../src/docs-openapi.js';

test('OpenAPI spec exposes core MVP API groups and bearer auth', () => {
  assert.equal(openApiSpec.openapi, '3.0.3');
  assert.ok(openApiSpec.paths['/api/auth/login']);
  assert.ok(openApiSpec.paths['/api/prospects']);
  assert.ok(openApiSpec.paths['/api/outreach']);
  assert.ok(openApiSpec.components.securitySchemes.bearerAuth);
});
