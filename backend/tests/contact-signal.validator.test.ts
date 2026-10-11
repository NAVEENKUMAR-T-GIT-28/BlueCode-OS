import { describe, expect, it } from 'vitest';
import {
  addDecisionMakerSchema, decisionMakerIdParamsSchema, listSignalsQuerySchema,
} from '../src/validators/contact-signal.validator.js';

describe('Contact and signal request validation', () => {
  it('accepts manual contact data and trims normalizable fields', () => {
    const value = addDecisionMakerSchema.parse({
      fullName: ' Pat Lee ',
      businessEmail: ' PAT@EXAMPLE.COM ',
      jobTitle: ' CTO ',
      linkedinUrl: 'https://www.linkedin.com/in/pat',
    });
    expect(value.fullName).toBe('Pat Lee');
    expect(value.businessEmail).toBe('PAT@EXAMPLE.COM');
    expect(value.jobTitle).toBe('CTO');
  });

  it('rejects client-provided protected fields', () => {
    expect(addDecisionMakerSchema.safeParse({
      fullName: 'Pat Lee',
      businessEmail: 'pat@example.com',
      source: 'apollo',
      emailVerified: true,
      startupId: '507f1f77bcf86cd799439011',
    }).success).toBe(false);
  });

  it('requires an email and restricts URLs to HTTP(S)', () => {
    expect(addDecisionMakerSchema.safeParse({ fullName: 'Pat Lee' }).success).toBe(false);
    expect(addDecisionMakerSchema.safeParse({ fullName: 'Pat Lee', businessEmail: 'pat@example.com', linkedinUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(addDecisionMakerSchema.safeParse({ fullName: 'Pat Lee', businessEmail: 'pat@example.com', linkedinUrl: 'https://linkedin.com/in/pat' }).success).toBe(true);
  });

  it('validates signal statuses and ObjectIds', () => {
    expect(listSignalsQuerySchema.safeParse({ status: 'stale' }).success).toBe(true);
    expect(listSignalsQuerySchema.safeParse({ status: 'all' }).success).toBe(false);
    expect(decisionMakerIdParamsSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
    expect(decisionMakerIdParamsSchema.safeParse({ id: 'bad' }).success).toBe(false);
  });
});
