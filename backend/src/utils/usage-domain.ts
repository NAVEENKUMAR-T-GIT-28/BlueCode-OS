export function assertPositiveIntegerPaise(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('estimate must be a positive safe integer number of paise');
  }
}

export function assertNonNegativeIntegerPaise(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('cost must be a non-negative safe integer number of paise');
  }
}

export function remainingPaise(capPaise: number, committedPaise: number, reservedPaise: number): number {
  return Math.max(0, capPaise - committedPaise - reservedPaise);
}

export function isProviderOutcomeUnknown(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as { code?: unknown; unknownOutcome?: unknown };
  return record.unknownOutcome === true ||
    record.code === 'ETIMEDOUT' ||
    record.code === 'ECONNABORTED' ||
    record.code === 'PROVIDER_TIMEOUT';
}

export function sanitizeErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z0-9_:-]{1,100}$/.test(code)) return code;
  }
  return 'PROVIDER_FAILED';
}
