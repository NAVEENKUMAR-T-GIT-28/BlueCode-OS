export type SignalEvidence = { field: string; value: string };
export type SignalCandidate = {
  signalType: 'technology';
  description: string;
  evidence: SignalEvidence[];
  confidence: number;
};

const MAX_EVIDENCE = 10;
const MAX_EVIDENCE_VALUE = 200;

/**
 * Rule-only signal proposal. A technology stack is a recorded firmographic fact,
 * not proof of purchase intent, so this creates only a low-confidence technology signal.
 * It never derives growth/funding claims from a single snapshot.
 */
export function detectSignalCandidates(firmographics: {
  technologies?: unknown;
} | null | undefined): SignalCandidate[] {
  const raw = firmographics?.technologies;
  if (!Array.isArray(raw)) return [];

  const unique = [...new Set(raw
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length <= MAX_EVIDENCE_VALUE))].slice(0, MAX_EVIDENCE);

  if (unique.length === 0) return [];

  const evidence = unique.map(value => ({
    field: 'firmographics.technologies',
    value,
  }));
  const label = unique.slice(0, 5).join(', ');
  const suffix = unique.length > 5 ? ` and ${unique.length - 5} more` : '';

  return [{
    signalType: 'technology',
    description: `Stored technology footprint: ${label}${suffix}. This is firmographic context, not a confirmed buying-intent event.`,
    evidence,
    confidence: 0.5,
  }];
}

export function signalEvidenceSignature(candidate: { signalType: string; evidence: SignalEvidence[] }): string {
  const stableEvidence = [...candidate.evidence]
    .map(item => `${item.field}\u0000${item.value}`)
    .sort();
  return `${candidate.signalType}\u0001${stableEvidence.join('\u0002')}`;
}
