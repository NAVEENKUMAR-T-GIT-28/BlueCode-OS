import { describe, expect, it } from 'vitest';
import { activityListQuerySchema, replyLogSchema } from '../src/validators/activity.validator.js';

const prospectId = '65f000000000000000000001';
const messageId = '65f000000000000000000002';

describe('M6 activity validators', () => {
  it('accepts a reply log with a prospect and bounded text', () => {
    expect(replyLogSchema.safeParse({ prospectId, messageId, text: 'Can we talk next week?' }).success).toBe(true);
  });
  it('rejects a missing prospect reference', () => {
    expect(replyLogSchema.safeParse({ text: 'Hello' }).success).toBe(false);
  });
  it('rejects text longer than the contract limit', () => {
    expect(replyLogSchema.safeParse({ prospectId, text: 'x'.repeat(5001) }).success).toBe(false);
  });
  it('rejects client-controlled tenant fields', () => {
    expect(replyLogSchema.safeParse({ prospectId, text: 'Hello', startupId: prospectId }).success).toBe(false);
  });
  it('accepts activity filters with comma-separated known types', () => {
    const parsed = activityListQuerySchema.parse({ type: 'reply_logged,reply_classified', sort: 'occurredAt' });
    expect(parsed.type).toEqual(['reply_logged', 'reply_classified']);
  });
  it('rejects invalid activity types and reversed date ranges', () => {
    expect(activityListQuerySchema.safeParse({ type: 'made_up' }).success).toBe(false);
    expect(activityListQuerySchema.safeParse({ from: '2026-10-12T00:00:00Z', to: '2026-10-11T00:00:00Z' }).success).toBe(false);
  });
});
