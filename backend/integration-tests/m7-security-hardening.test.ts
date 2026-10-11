import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';

const TEST_DB_NAME = 'bluecode_os_m7_test';
const JWT_TEST_SECRET = 'bluecode-os-m7-integration-secret-at-least-32-chars';
const CLIENT_ORIGIN = 'http://localhost:5173';

process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGIN = CLIENT_ORIGIN;
process.env.JWT_ACTIVE_SECRET = JWT_TEST_SECRET;
process.env.JWT_PREVIOUS_SECRETS = '';
process.env.JWT_TTL_SECONDS = '3600';
process.env.COOKIE_SECURE = 'false';
process.env.APOLLO_MODE = 'mock';
process.env.LLM_MODE = 'mock';
process.env.TRIAL_SPEND_CAP_PAISE = '100000';

const tenantQueryMethods = [
  'countDocuments', 'deleteMany', 'deleteOne', 'find', 'findOne',
  'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate', 'replaceOne',
  'updateMany', 'updateOne',
] as const;

function registerTenantScopeGuard() {
  mongoose.plugin(schema => {
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
let User: any, Startup: any, StartupMember: any, Icp: any, Prospect: any;
let DecisionMaker: any, OutreachCampaign: any, OutreachMessage: any;
let SalesActivity: any, NextBestAction: any, UsageRecord: any, usageService: any;

async function seedTenant(label: string, prospectCount = 1) {
  const suffix = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 10)}`;
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
    apiSpendCap: 10_000,
    spendCommitted: 0,
    spendReserved: 0,
    settings: { senderName: `${label} Founder`, productSummary: `${label} workflow product` },
  });
  await StartupMember.create({ startupId: startup._id, userId: user._id, role: 'owner', status: 'active' });
  const token = jwt.sign({ sub: String(user._id) }, JWT_TEST_SECRET, {
    algorithm: 'HS256', expiresIn: '1h', keyid: '0',
  });
  const icp = await Icp.create({
    startupId: startup._id,
    name: `${label} ICP`,
    criteria: { industries: ['Software'] },
    createdBy: user._id,
  });
  const resources: any[] = [];
  for (let index = 1; index <= prospectCount; index++) {
    const prospect = await Prospect.create({
      startupId: startup._id,
      icpId: icp._id,
      name: `${label} Prospect ${index}`,
      domain: `${suffix}-${index}.example.test`,
      status: 'qualified',
    });
    const contact = await DecisionMaker.create({
      startupId: startup._id,
      prospectId: prospect._id,
      fullName: `${label} Contact ${index}`,
      businessEmail: `${suffix}-${index}@example.test`,
      source: 'manual',
      emailVerified: false,
      outreachStatus: 'not_contacted',
    });
    const campaign = await OutreachCampaign.create({
      startupId: startup._id,
      icpId: icp._id,
      name: `${label} Campaign ${index}`,
      channel: 'email',
      status: 'draft',
      createdBy: user._id,
    });
    const message = await OutreachMessage.create({
      startupId: startup._id,
      campaignId: campaign._id,
      prospectId: prospect._id,
      decisionMakerId: contact._id,
      step: 1,
      revision: 1,
      subject: `${label} subject`,
      body: `${label} draft body`,
      approvalStatus: 'pending',
      status: 'draft',
      idempotencyKey: `draft:${campaign._id}:${contact._id}:1`,
      createdBy: user._id,
    });
    const activity = await SalesActivity.create({
      startupId: startup._id,
      prospectId: prospect._id,
      activityType: 'prospect_discovered',
      summary: `${label} prospect was discovered in the test fixture.`,
      occurredAt: new Date(),
    });
    const action = await NextBestAction.create({
      startupId: startup._id,
      prospectId: prospect._id,
      decisionMakerId: contact._id,
      actionType: 'review_prospect',
      title: `Review ${label} prospect`,
      reason: 'Test fixture recommendation backed by a same-tenant activity.',
      priority: 'medium',
      status: 'pending',
      basedOnActivityIds: [activity._id],
    });
    resources.push({ prospect, contact, campaign, message, activity, action });
  }
  return { user, startup, token, icp, resources };
}

function workspaceGet(path: string, tenant: any) {
  return request(app).get(path)
    .set('Cookie', `bc_session=${tenant.token}`)
    .set('x-startup-id', String(tenant.startup._id));
}

function workspacePost(path: string, tenant: any, body: unknown = {}) {
  return request(app).post(path)
    .set('Cookie', `bc_session=${tenant.token}`)
    .set('x-startup-id', String(tenant.startup._id))
    .set('origin', CLIENT_ORIGIN)
    .set('x-requested-with', 'XMLHttpRequest')
    .send(body);
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    binary: { version: '7.0.14' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  process.env.MONGODB_URI = replicaSet.getUri(TEST_DB_NAME);
  registerTenantScopeGuard();

  const [appModule, userModule, startupModule, memberModule, icpModule, prospectModule,
    decisionMakerModule, campaignModule, messageModule, activityModule, actionModule,
    usageRecordModule, usageServiceModule] = await Promise.all([
    import('../src/app.js'),
    import('../src/models/user.model.js'),
    import('../src/models/startup.model.js'),
    import('../src/models/startup-member.model.js'),
    import('../src/models/icp.model.js'),
    import('../src/models/prospect.model.js'),
    import('../src/models/decision-maker.model.js'),
    import('../src/models/outreach-campaign.model.js'),
    import('../src/models/outreach-message.model.js'),
    import('../src/models/sales-activity.model.js'),
    import('../src/models/next-best-action.model.js'),
    import('../src/models/usage-record.model.js'),
    import('../src/services/usage.service.js'),
  ]);
  app = appModule.createApp();
  User = userModule.User;
  Startup = startupModule.Startup;
  StartupMember = memberModule.StartupMember;
  Icp = icpModule.Icp;
  Prospect = prospectModule.Prospect;
  DecisionMaker = decisionMakerModule.DecisionMaker;
  OutreachCampaign = campaignModule.OutreachCampaign;
  OutreachMessage = messageModule.OutreachMessage;
  SalesActivity = activityModule.SalesActivity;
  NextBestAction = actionModule.NextBestAction;
  UsageRecord = usageRecordModule.UsageRecord;
  usageService = usageServiceModule.usageService;

  await mongoose.connect(replicaSet.getUri(TEST_DB_NAME));
  await mongoose.connection.dropDatabase();
}, 600_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect().catch(() => undefined);
  await replicaSet?.stop();
});

afterEach(() => { vi.restoreAllMocks(); });

describe('M7 security and hardening release blockers', () => {
  it('TI-01/02: tenant B cannot read or mutate tenant A resources by guessing IDs', async () => {
    const tenantA = await seedTenant('Tenant A', 2);
    const tenantB = await seedTenant('Tenant B', 1);
    const a = tenantA.resources[0];

    await workspaceGet(`/api/v1/prospects/${a.prospect._id}`, tenantB).expect(404)
      .expect(res => expect(res.body.error.code).toBe('NOT_FOUND'));
    await workspaceGet(`/api/v1/campaigns/${a.campaign._id}`, tenantB).expect(404)
      .expect(res => expect(res.body.error.code).toBe('NOT_FOUND'));
    await workspaceGet(`/api/v1/messages/${a.message._id}`, tenantB).expect(404)
      .expect(res => expect(res.body.error.code).toBe('NOT_FOUND'));
    await workspacePost(`/api/v1/messages/${a.message._id}/cancel`, tenantB).expect(404)
      .expect(res => expect(res.body.error.code).toBe('NOT_FOUND'));
    await workspacePost(`/api/v1/next-actions/${a.action._id}/complete`, tenantB).expect(404)
      .expect(res => expect(res.body.error.code).toBe('NOT_FOUND'));

    expect((await OutreachMessage.findOne({ _id: a.message._id, startupId: tenantA.startup._id }).lean())?.status).toBe('draft');
    expect((await NextBestAction.findOne({ _id: a.action._id, startupId: tenantA.startup._id }).lean())?.status).toBe('pending');
  });

  it('TI-03/05: lists and dashboard aggregate only the active tenant data', async () => {
    const tenantA = await seedTenant('List A', 2);
    const tenantB = await seedTenant('List B', 1);

    const campaigns = await workspaceGet('/api/v1/campaigns', tenantB).expect(200);
    expect(campaigns.body.meta.total).toBe(1);
    expect(campaigns.body.data.every((row: any) => row.name.startsWith('List B'))).toBe(true);

    const messages = await workspaceGet('/api/v1/messages', tenantB).expect(200);
    expect(messages.body.meta.total).toBe(1);
    expect(messages.body.data.every((row: any) => row.body.startsWith('List B'))).toBe(true);

    const activities = await workspaceGet('/api/v1/activities', tenantB).expect(200);
    expect(activities.body.data).toHaveLength(1);
    expect(activities.body.data[0].summary).toContain('List B');

    const actions = await workspaceGet('/api/v1/next-actions?status=pending', tenantB).expect(200);
    expect(actions.body.meta.total).toBe(1);
    expect(actions.body.data.every((row: any) => row.title.startsWith('Review List B'))).toBe(true);

    const dashboard = await workspaceGet('/api/v1/dashboard', tenantB).expect(200);
    expect(dashboard.body.data.funnel.discovered).toBe(1);
    expect(dashboard.body.data.topActions.every((row: any) => row.title.startsWith('Review List B'))).toBe(true);
    expect(await Prospect.countDocuments({ startupId: tenantA.startup._id })).toBe(2);
  });

  it('TI-33/34: cross-tenant body references fail without creating messages or activities', async () => {
    const tenantA = await seedTenant('Reference A', 1);
    const tenantB = await seedTenant('Reference B', 1);
    const a = tenantA.resources[0];
    const b = tenantB.resources[0];

    await workspacePost('/api/v1/messages/draft', tenantA, {
      campaignId: String(a.campaign._id),
      decisionMakerId: String(b.contact._id),
      step: 1,
      regenerate: false,
    }).expect(422).expect(res => expect(res.body.error.code).toBe('VALIDATION_FAILED'));

    const repliesBefore = await SalesActivity.countDocuments({ startupId: tenantA.startup._id, activityType: 'reply_logged' });
    await workspacePost('/api/v1/activities/replies', tenantA, {
      prospectId: String(a.prospect._id),
      messageId: String(b.message._id),
      text: 'A reply that must not be linked across tenants.',
    }).expect(422).expect(res => expect(res.body.error.code).toBe('VALIDATION_FAILED'));

    expect(await OutreachMessage.countDocuments({ startupId: tenantA.startup._id })).toBe(1);
    expect(await SalesActivity.countDocuments({ startupId: tenantA.startup._id, activityType: 'reply_logged' })).toBe(repliesBefore);
  });

  it('DR-02: twenty concurrent identical draft requests create one message and one mock usage row', async () => {
    const tenant = await seedTenant('Draft Race', 1);
    const resource = tenant.resources[0];
    // seedTenant creates a draft with the same idempotency key.
    // Remove that fixture so this test exercises concurrent creation.
    const deleted = await OutreachMessage.deleteOne({
      _id: resource.message._id,
      startupId: tenant.startup._id,
    });
    expect(deleted.deletedCount).toBe(1);
    const responses = await Promise.all(Array.from({ length: 20 }, () => workspacePost('/api/v1/messages/draft', tenant, {
      campaignId: String(resource.campaign._id),
      decisionMakerId: String(resource.contact._id),
      step: 1,
      regenerate: false,
    })));

    expect(responses.every(res => [200, 201].includes(res.status))).toBe(true);
    const messageIds = new Set(responses.map(res => res.body.data?.id));
    expect(messageIds.size).toBe(1);
    expect(responses.filter(res => res.status === 201)).toHaveLength(1);
    expect(await OutreachMessage.countDocuments({ startupId: tenant.startup._id })).toBe(1);
    expect(await UsageRecord.countDocuments({ startupId: tenant.startup._id, operation: 'llm.draft_message@1', status: 'success' })).toBe(1);
  });

  it('BG/NF-05: provider timeout records estimated spend and clears reserved spend exactly once', async () => {
    const tenant = await seedTenant('Timeout Budget', 1);
    await expect(usageService.withUsage(
      { startupId: String(tenant.startup._id), requestId: 'm7-timeout-regression' },
      'llm.classify_reply@1',
      25,
      async () => { throw Object.assign(new Error('private provider key must not leak'), { code: 'ETIMEDOUT' }); },
    )).rejects.toMatchObject({ status: 502, code: 'PROVIDER_FAILED' });

    const updated = await Startup.findOne({ _id: tenant.startup._id }).lean();
    expect(updated).toMatchObject({ spendCommitted: 25, spendReserved: 0 });
    const record = await UsageRecord.findOne({ startupId: tenant.startup._id, requestId: 'm7-timeout-regression' }).lean();
    expect(record).toMatchObject({ status: 'failed', costAmount: 25, costType: 'estimated', errorCode: 'PROVIDER_TIMEOUT' });
    expect(JSON.stringify(record)).not.toContain('private provider key');
  });

  it('AU-20/21: unsafe origin or missing X-Requested-With marker is rejected before route handling', async () => {
    await request(app).post('/api/v1/activities/replies')
      .set('origin', CLIENT_ORIGIN).send({}).expect(403);
    await request(app).post('/api/v1/activities/replies')
      .set('origin', 'https://attacker.invalid')
      .set('x-requested-with', 'XMLHttpRequest').send({}).expect(403);
  });
});
