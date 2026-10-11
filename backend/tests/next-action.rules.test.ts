import { describe, expect, it } from 'vitest';
import { actionForReply } from '../src/services/next-action.service.js';

const now = new Date('2026-10-11T00:00:00.000Z');

describe('M6 lazy next-action rules', () => {
  it('turns a positive reply into a human-reviewed meeting action', () => {
    const result = actionForReply('buying_interest', 0.9, now);
    expect(result?.actionType).toBe('book_meeting');
    expect(result?.priority).toBe('high');
  });
  it('forces low-confidence output into review_prospect', () => {
    const result = actionForReply('buying_interest', 0.59, now);
    expect(result?.actionType).toBe('review_prospect');
  });
  it('creates a dated nurture action for not-now replies using the frozen three-day default', () => {
    const result = actionForReply('not_now', 0.8, now);
    expect(result?.actionType).toBe('nurture');
    expect(result?.dueAt?.toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });
  it('does not create outreach for unsubscribe replies', () => {
    expect(actionForReply('unsubscribe', 0.99, now)).toBeNull();
  });
});
