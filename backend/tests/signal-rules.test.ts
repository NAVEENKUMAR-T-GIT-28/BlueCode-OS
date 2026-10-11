import { describe, expect, it } from 'vitest';
import { detectSignalCandidates, signalEvidenceSignature } from '../src/services/signal-rules.js';

describe('Conservative evidence-backed signal rules', () => {
  it('does not infer a signal from missing or empty technology data', () => {
    expect(detectSignalCandidates(undefined)).toEqual([]);
    expect(detectSignalCandidates({ technologies: [] })).toEqual([]);
    expect(detectSignalCandidates({ technologies: [' ', null, 123] })).toEqual([]);
  });

  it('creates a technology-context signal with evidence copied from stored fields', () => {
    const [candidate] = detectSignalCandidates({ technologies: [' React ', 'Node.js', 'React'] });
    expect(candidate?.signalType).toBe('technology');
    expect(candidate?.confidence).toBe(0.5);
    expect(candidate?.evidence).toEqual([
      { field: 'firmographics.technologies', value: 'React' },
      { field: 'firmographics.technologies', value: 'Node.js' },
    ]);
    expect(candidate?.description).toContain('not a confirmed buying-intent event');
  });

  it('bounds evidence and removes duplicate technology strings', () => {
    const values = Array.from({ length: 20 }, (_, i) => `Tech${i}`);
    const [candidate] = detectSignalCandidates({ technologies: values });
    expect(candidate?.evidence).toHaveLength(10);
    expect(candidate?.evidence.every(item => item.value.length <= 200)).toBe(true);
  });

  it('deduplicates identical evidence signatures regardless of evidence order', () => {
    const a = { signalType: 'technology', evidence: [
      { field: 'firmographics.technologies', value: 'React' },
      { field: 'firmographics.technologies', value: 'Node.js' },
    ] };
    const b = { signalType: 'technology', evidence: [...a.evidence].reverse() };
    expect(signalEvidenceSignature(a)).toBe(signalEvidenceSignature(b));
  });
});
