import type { ProspectStatus } from '../types/prospect.js';

export function canTransitionProspect(from: ProspectStatus, to: ProspectStatus): boolean {
  if (from === to) return true;
  if (to === 'do_not_contact') return true;
  if (from === 'do_not_contact') return to === 'qualified';
  return (
    (from === 'discovered' && (to === 'qualified' || to === 'disqualified')) ||
    (from === 'qualified' && to === 'disqualified') ||
    (from === 'disqualified' && to === 'qualified')
  );
}
