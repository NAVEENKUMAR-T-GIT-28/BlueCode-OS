/** Normalize a supplied domain without fetching it. Returns undefined instead of guessing. */
export function normalizeDomain(input?: string | null): string | undefined {
  if (typeof input !== 'string') return undefined;
  let value = input.trim().toLowerCase();
  if (!value) return undefined;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  value = value.split(/[/?#]/, 1)[0] ?? '';
  value = value.replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\d*\./, '');
  if (!value || /\s/.test(value) || !value.includes('.')) return undefined;
  if (!/^[a-z0-9.-]+$/.test(value) || value.startsWith('.') || value.endsWith('.') || value.includes('..')) return undefined;
  return value;
}
