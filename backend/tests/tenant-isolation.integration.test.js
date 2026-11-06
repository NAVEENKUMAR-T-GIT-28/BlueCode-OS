import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.RUN_DB_INTEGRATION === 'true');

test('tenant-scoped repository helper cannot return another startup record', { skip: !enabled }, async () => {
  process.env.JWT_SECRET ||= 'integration-test-secret-that-is-at-least-thirty-two-characters';
  const [{ db }, { findOwned }] = await Promise.all([
    import('../src/infrastructure/database/supabase.js'),
    import('../src/shared/helpers.js'),
  ]);
  const { data: startupA, error: aError } = await db.from('startups').insert({ company_name: 'Tenant isolation test A' }).select('id').single();
  assert.ifError(aError);
  const { data: startupB, error: bError } = await db.from('startups').insert({ company_name: 'Tenant isolation test B' }).select('id').single();
  assert.ifError(bError);
  try {
    const { data: prospect, error } = await db.from('prospects').insert({ startup_id: startupB.id, company: 'Tenant B private prospect' }).select('id').single();
    assert.ifError(error);
    await assert.rejects(() => findOwned('prospects', prospect.id, startupA.id), (err) => err.status === 404);
    assert.equal((await findOwned('prospects', prospect.id, startupB.id)).id, prospect.id);
  } finally {
    await db.from('startups').delete().in('id', [startupA.id, startupB.id]);
  }
});
