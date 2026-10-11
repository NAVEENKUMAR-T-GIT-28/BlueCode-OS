import { describe, expect, it } from 'vitest';
import { getMaxUsersForPlan } from '../src/config/plan-limits.js';

describe('Frozen plan limits', () => {
  it('enforces the documented pilot maxUsers constraint', () => {
    expect(getMaxUsersForPlan('trial')).toBe(1);
  });

  it('does not invent limits for undocumented plans', () => {
    expect(getMaxUsersForPlan('starter')).toBeUndefined();
    expect(getMaxUsersForPlan('growth')).toBeUndefined();
    expect(getMaxUsersForPlan('pro')).toBeUndefined();
  });
});
