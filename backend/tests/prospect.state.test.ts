import { describe, expect, it } from 'vitest';
import { canTransitionProspect } from '../src/services/prospect-state.js';

describe('Prospect state transitions', () => {
  it('allows qualification, disqualification, and re-opening a disqualified prospect', () => {
    expect(canTransitionProspect('discovered', 'qualified')).toBe(true);
    expect(canTransitionProspect('discovered', 'disqualified')).toBe(true);
    expect(canTransitionProspect('qualified', 'disqualified')).toBe(true);
    expect(canTransitionProspect('disqualified', 'qualified')).toBe(true);
  });
  it('allows DNC from every state and only clears DNC to qualified', () => {
    for (const state of ['discovered', 'qualified', 'disqualified', 'do_not_contact'] as const) {
      expect(canTransitionProspect(state, 'do_not_contact')).toBe(true);
    }
    expect(canTransitionProspect('do_not_contact', 'qualified')).toBe(true);
    expect(canTransitionProspect('do_not_contact', 'disqualified')).toBe(false);
    expect(canTransitionProspect('do_not_contact', 'discovered')).toBe(false);
  });
});
