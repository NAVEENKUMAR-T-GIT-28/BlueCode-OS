import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema, createStartupSchema } from '../src/validators/auth.validator.js';

describe('M1 request validation', () => {
  it('rejects unknown fields (mass-assignment guard)', () => {
    expect(registerSchema.safeParse({ name: 'N', email: 'n@example.com', password: 'long-password-123', status: 'disabled' }).success).toBe(false);
  });
  it('rejects short passwords', () => {
    expect(registerSchema.safeParse({ name: 'N', email: 'n@example.com', password: 'short' }).success).toBe(false);
  });
  it('normalizes whitespace in names and emails', () => {
    const parsed = registerSchema.parse({ name: ' Naveen ', email: 'n@example.com ', password: 'long-password-123' });
    expect(parsed.name).toBe('Naveen');
    expect(parsed.email).toBe('n@example.com');
  });
  it('rejects unknown workspace fields', () => {
    expect(createStartupSchema.safeParse({ name: 'Workspace', apiSpendCap: 25000 }).success).toBe(false);
  });
  it('accepts valid login input', () => {
    expect(loginSchema.safeParse({ email: 'n@example.com', password: 'x' }).success).toBe(true);
  });
});
