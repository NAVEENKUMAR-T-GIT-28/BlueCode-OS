import { describe, expect, it } from 'vitest';
import {
  inviteMemberSchema, memberIdParamsSchema, updateMemberRoleSchema, updateStartupSchema,
} from '../src/validators/startup.validator.js';

describe('Workspace request validation', () => {
  it('accepts name-only workspace updates', () => {
    expect(updateStartupSchema.safeParse({ name: ' New Name ' }).success).toBe(true);
  });

  it('accepts HTTPS calendar links and rejects HTTP', () => {
    expect(updateStartupSchema.safeParse({ settings: { calendarLink: 'https://example.com/book' } }).success).toBe(true);
    expect(updateStartupSchema.safeParse({ settings: { calendarLink: 'http://example.com/book' } }).success).toBe(false);
  });

  it('rejects empty patches and unknown fields', () => {
    expect(updateStartupSchema.safeParse({}).success).toBe(false);
    expect(updateStartupSchema.safeParse({ name: 'Acme', startupId: 'other-tenant' }).success).toBe(false);
  });

  it('only permits admin/member invite roles', () => {
    expect(inviteMemberSchema.safeParse({ email: 'team@example.com', role: 'member' }).success).toBe(true);
    expect(inviteMemberSchema.safeParse({ email: 'owner@example.com', role: 'owner' }).success).toBe(false);
  });

  it('validates member role updates and ObjectId parameters', () => {
    expect(updateMemberRoleSchema.safeParse({ role: 'owner' }).success).toBe(true);
    expect(memberIdParamsSchema.safeParse({ memberId: '507f1f77bcf86cd799439011' }).success).toBe(true);
    expect(memberIdParamsSchema.safeParse({ memberId: 'bad-id' }).success).toBe(false);
  });
});
