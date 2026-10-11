import { describe, expect, it } from 'vitest';
import { classifyMockReply, detectUnsubscribe } from '../src/providers/ai/mock-reply-classifier.js';

describe('M6 mock reply classifier', () => {
  it('detects unsubscribe language without an LLM', () => {
    expect(detectUnsubscribe('Please stop emailing me.')).toBe(true);
    expect(detectUnsubscribe('Please remove my email from your mailing list.')).toBe(true);
    expect(detectUnsubscribe('I do not want any more emails.')).toBe(true);
    expect(detectUnsubscribe('Sounds good, let us talk next week.')).toBe(false);
  });
  it('classifies positive replies into the meeting path', () => {
    expect(classifyMockReply('Sounds good. Can we schedule a meeting?').intent).toBe('buying_interest');
    expect(classifyMockReply('Sounds interesting. Can we talk next Tuesday?').intent).toBe('buying_interest');
  });
  it('classifies timing deferrals', () => {
    expect(classifyMockReply('Maybe next quarter; please check back.').intent).toBe('not_now');
  });
  it('falls back to low-confidence other for unrecognized text', () => {
    const result = classifyMockReply('Thanks for the update.');
    expect(result.intent).toBe('other');
    expect(result.confidence).toBeLessThan(0.6);
  });
  it('does not mistake ordinary use of the word stop for an unsubscribe', () => {
    expect(detectUnsubscribe('We should stop the current project for now.')).toBe(false);
  });
});
