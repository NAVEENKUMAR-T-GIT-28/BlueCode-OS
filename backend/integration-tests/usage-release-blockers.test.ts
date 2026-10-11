import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { Express } from 'express';

const TEST_DB_NAME = 'bluecode_os_m8_test';
const JWT_TEST_SECRET = 'bluecode-os-integration-test-secret-at-least-32-chars';

// Configure env before dynamically importing application modules that parse it.
process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.JWT_ACTIVE_SECRET = JWT_TEST_SECRET;
process.env.JWT_PREVIOUS_SECRETS = '';
process.env.JWT_TTL_SECONDS = '3600';
process.env.COOKIE_SECURE = 'false';
process.env.TRIAL_SPEND_CAP_PAISE = '100000';

const tenantQueryMethods = [
  'countDocuments', 'deleteMany', 'deleteOne', 'find', 'findOne',
  'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate', 'replaceOne',
  'updateMany', 'updateOne',
] as const;

function registerTenantScopeGuard() {
  mongoose.plugin(schema => {
    // `startupId` marks the 11 tenant-owned schemas. User and Startup are intentionally excluded.
    if (!schema.path('startupId')) return;

    for (const method of tenantQueryMethods) {
      schema.pre(method as never, function (this: any) {
        const filter = this.getFilter() as Record<string, unknown>;
        if (!Object.prototype.hasOwnProperty.call(filter, 'startupId')) {
          throw new Error(`TENANT_SCOPE_GUARD: ${method} on ${this.model?.modelName ?? 'tenant model'} is missing startupId`);
        }
      });
    }

    schema.pre('aggregate', function (this: any) {
      const firstStage = this.pipeline()[0] as { $match?: Record<string, unknown> } | undefined;
      if (!firstStage?.$match || !Object.prototype.hasOwnProperty.call(firstStage.$match, 'startupId')) {
        throw new Error('TENANT_SCOPE_GUARD: aggregate must start with $match containing startupId');
      }
    });
  });
}

let replicaSet: MongoMemoryReplSet;
let app: Express;
let User: any;
let Startup: any;
let StartupMember: any;
let UsageRecord: any;
let Prospect: any;
let usageService: any;

async function seedTenant(label: string, options: {
  cap?: number;
  committed?: number;
  reserved?: number;
} = {}) {
  const suffix = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID()}`;
  const user = await User.create({
    name: label,
    email: `${suffix}@example.test`,
    passwordHash: 'integration-test-only-not-used-for-login',
    status: 'active',
  });
  const startup = await Startup.create({
    ownerUserId: user._id,
    name: label,
    plan: 'trial',
    status: 'active',
    trialEndsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    apiSpendCap: options.cap ?? 10_000,
    spendCommitted: options.committed ?? 0,
    spendReserved: options.reserved ?? 0,
  });
  await StartupMember.create({
    startupId: startup._id,
    userId: user._id,
    role: 'owner',
    status: 'active',
  });
  const token = jwt.sign({ sub: String(user._id) }, JWT_TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    keyid: '0',
  });
  return { user, startup, token };
}

function workspaceRequest(method: 'get', path: string, tenant: { startup: any; token: string }) {
  return request(app)[method](path)
    .set('Cookie', `bc_session=${tenant.token}`)
    .set('x-startup-id', String(tenant.startup._id));
}

async function createLedgerRow(startupId: unknown, input: {
  costAmount: number;
  status?: 'success' | 'failed' | 'blocked';
  operation?: string;
}) {
  return UsageRecord.create({
    startupId,
    provider: 'apollo',
    operation: input.operation ?? 'apollo.org_search',
    status: input.status ?? 'success',
    costAmount: input.costAmount,
    costType: 'reported',
    occurredAt: new Date(),
  });
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    binary: { version: '7.0.14' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  process.env.MONGODB_URI = replicaSet.getUri(TEST_DB_NAME);

  // Register before models are compiled so the guard wraps every tenant-owned schema.
  registerTenantScopeGuard();
  const [appModule, userModule, startupModule, startupMemberModule, usageRecordModule,
    prospectModule, usageServiceModule] = await Promise.all([
    import('../src/app.js'),
    import('../src/models/user.model.js'),
    import('../src/models/startup.model.js'),
    import('../src/models/startup-member.model.js'),
    import('../src/models/usage-record.model.js'),
    import('../src/models/prospect.model.js'),
    import('../src/services/usage.service.js'),
  ]);
  app = appModule.createApp();
  User = userModule.User;
  Startup = startupModule.Startup;
  StartupMember = startupMemberModule.StartupMember;
  UsageRecord = usageRecordModule.UsageRecord;
  Prospect = prospectModule.Prospect;
  usageService = usageServiceModule.usageService;

  await mongoose.connect(replicaSet.getUri(TEST_DB_NAME));
  // The URI is hard-coded to a disposable in-memory database, never a developer database.
  await mongoose.connection.dropDatabase();
}, 600_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect().catch(() => undefined);
  await replicaSet?.stop();
});

afterEach(async () => {
  vi.restoreAllMocks();
});

describe('M8 release-blocking MongoDB integration tests', () => {
  it('TI/BG structural guard rejects tenant queries and aggregates without startupId', async () => {
    await expect(Prospect.find({ name: 'unscoped query' }).exec())
      .rejects.toThrow('TENANT_SCOPE_GUARD');
    await expect(UsageRecord.aggregate([{ $group: { _id: null, total: { $sum: '$costAmount' } } }]).exec())
      .rejects.toThrow('TENANT_SCOPE_GUARD');

    // Positive controls: both valid tenant-scoped query forms execute against MongoDB.
    expect(await Prospect.find({ startupId: new mongoose.Types.ObjectId() }).exec()).toHaveLength(0);
    expect(await UsageRecord.aggregate([
      { $match: { startupId: new mongoose.Types.ObjectId() } },
      { $group: { _id: null, total: { $sum: '$costAmount' } } },
    ]).exec()).toHaveLength(0);
  });

  it('TI-05 usage routes reject foreign workspace access and return only the active tenant ledger', async () => {
    const tenantA = await seedTenant('Tenant A', { cap: 1_000, committed: 40 });
    const tenantB = await seedTenant('Tenant B', { cap: 2_000, committed: 70 });
    await createLedgerRow(tenantA.startup._id, { costAmount: 25 });
    await createLedgerRow(tenantA.startup._id, { costAmount: 15 });
    await createLedgerRow(tenantB.startup._id, { costAmount: 70 });

    const aRows = await workspaceRequest('get', '/api/v1/usage/records', tenantA).expect(200);
    expect(aRows.body.meta.total).toBe(2);
    expect(aRows.body.data.map((row: any) => row.costPaise).sort((a: number, b: number) => a - b)).toEqual([15, 25]);

    const bRows = await workspaceRequest('get', '/api/v1/usage/records', tenantB).expect(200);
    expect(bRows.body.meta.total).toBe(1);
    expect(bRows.body.data[0]).toMatchObject({ costPaise: 70, status: 'success' });

    const foreignSummary = await request(app).get('/api/v1/usage/summary')
      .set('Cookie', `bc_session=${tenantB.token}`)
      .set('x-startup-id', String(tenantA.startup._id))
      .expect(403);
    expect(foreignSummary.body.error).toMatchObject({ code: 'NOT_A_MEMBER' });

    const bSummary = await workspaceRequest('get', '/api/v1/usage/summary', tenantB).expect(200);
    expect(bSummary.body.data.spend).toMatchObject({
      capPaise: 2_000,
      committedPaise: 70,
      reservedPaise: 0,
      remainingPaise: 1_930,
    });
  });

  it('BG-01 real MongoDB atomic reservation lets exactly N concurrent calls fit the cap', async () => {
    const tenant = await seedTenant('Budget Race', { cap: 100 });
    const outcomes = await Promise.allSettled(
      Array.from({ length: 50 }, () => usageService.reserve(
        { startupId: String(tenant.startup._id), requestId: 'm8-budget-race' },
        'apollo.org_search',
        10,
      )),
    );
    const accepted = outcomes.filter((result: PromiseSettledResult<unknown>) => result.status === 'fulfilled') as PromiseFulfilledResult<string>[];
    const rejected = outcomes.filter((result: PromiseSettledResult<unknown>) => result.status === 'rejected');

    expect(accepted).toHaveLength(10);
    expect(rejected).toHaveLength(40);
    let startup = await Startup.findById(tenant.startup._id).lean();
    expect(startup).toMatchObject({ spendCommitted: 0, spendReserved: 100, apiSpendCap: 100 });
    expect(await UsageRecord.countDocuments({ startupId: tenant.startup._id, status: 'blocked' })).toBe(40);

    // Finalize sequentially to keep this test focused on concurrent reservation admission.
    for (const item of accepted) {
      expect(await usageService.commit(item.value, { actualCostPaise: 10, costType: 'estimated' })).toBe(true);
    }
    startup = await Startup.findById(tenant.startup._id).lean();
    expect(startup).toMatchObject({ spendCommitted: 100, spendReserved: 0, apiSpendCap: 100 });
    expect(await UsageRecord.countDocuments({ startupId: tenant.startup._id, status: 'success' })).toBe(10);
  });

  it('BG-12 failed ledger insertion rolls back counter updates in the MongoDB transaction', async () => {
    const tenant = await seedTenant('Atomic Commit', { cap: 100 });
    const reservationId = await usageService.reserve(
      { startupId: String(tenant.startup._id), requestId: 'm8-atomic-rollback' },
      'llm.signal_interpret',
      10,
    );

    const createSpy = vi.spyOn(UsageRecord, 'create');
    createSpy.mockRejectedValueOnce(new Error('M8 injected ledger insert failure'));
    await expect(usageService.commit(reservationId, { actualCostPaise: 10, costType: 'reported' }))
      .rejects.toThrow('M8 injected ledger insert failure');
    createSpy.mockRestore();

    const afterRollback = await Startup.findById(tenant.startup._id).lean();
    expect(afterRollback).toMatchObject({ spendCommitted: 0, spendReserved: 10 });
    expect(await UsageRecord.countDocuments({ startupId: tenant.startup._id })).toBe(0);

    // Clear the in-memory reservation registry and restore the counters after proving rollback.
    expect(await usageService.release(reservationId, 'M8_TEST_CLEANUP')).toBe(true);
    const afterRelease = await Startup.findById(tenant.startup._id).lean();
    expect(afterRelease).toMatchObject({ spendCommitted: 0, spendReserved: 0 });
    expect(await UsageRecord.countDocuments({ startupId: tenant.startup._id, status: 'failed' })).toBe(1);
  });

  it('BG-07 reconciliation reports drift and --fix restores committed spend from the ledger', async () => {
    const tenant = await seedTenant('Reconciliation', { cap: 2_000, committed: 999 });
    await createLedgerRow(tenant.startup._id, { costAmount: 10, status: 'success' });
    await createLedgerRow(tenant.startup._id, { costAmount: 5, status: 'failed' });
    await createLedgerRow(tenant.startup._id, { costAmount: 0, status: 'blocked' });

    const tsxEntrypoint = resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const scriptPath = resolve(process.cwd(), 'src', 'scripts', 'reconcile-usage.ts');
    const env = { ...process.env, MONGODB_URI: replicaSet.getUri(TEST_DB_NAME) };
    const dryRun = spawnSync(process.execPath, [tsxEntrypoint, scriptPath], {
      cwd: process.cwd(), env, encoding: 'utf8', timeout: 30_000,
    });
    expect(dryRun.error).toBeUndefined();
    expect(dryRun.status).toBe(2);
    expect(dryRun.stdout).toContain('"event":"usage_reconciliation_drift"');
    expect(dryRun.stdout).toContain('"driftPaise":-984');
    expect((await Startup.findById(tenant.startup._id).lean())?.spendCommitted).toBe(999);

    const fixRun = spawnSync(process.execPath, [tsxEntrypoint, scriptPath, '--fix'], {
      cwd: process.cwd(), env, encoding: 'utf8', timeout: 30_000,
    });
    expect(fixRun.error).toBeUndefined();
    expect(fixRun.status).toBe(0);
    expect(fixRun.stdout).toContain('"event":"usage_reconciliation_complete"');
    expect(fixRun.stdout).toContain('"fixed":true');
    expect((await Startup.findById(tenant.startup._id).lean())?.spendCommitted).toBe(15);
  });
});
