import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/core/errors/HttpError.js';
import { mapDatabaseError, HttpError as SharedHttpError } from '../src/shared/helpers.js';

test('database unique violations map to HTTP 409', () => {
  const error = mapDatabaseError({ code: '23505' });
  assert.ok(error instanceof HttpError);
  assert.equal(error.status, 409);
  assert.equal(error.code, 'RESOURCE_CONFLICT');
});

test('missing database rows map to HTTP 404', () => {
  const error = mapDatabaseError({ code: 'PGRST116' });
  assert.equal(error.status, 404);
  assert.equal(error.code, 'RESOURCE_NOT_FOUND');
});

test('database connectivity failures map to HTTP 503', () => {
  const error = mapDatabaseError({ code: '08006' });
  assert.equal(error.status, 503);
  assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE');
});

test('shared helper re-exports HttpError for all feature modules', () => {
  assert.equal(SharedHttpError, HttpError);
});
