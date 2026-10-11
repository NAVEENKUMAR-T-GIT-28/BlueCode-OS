export type ErrorCode =
  | 'MALFORMED_REQUEST' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_A_MEMBER'
  | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_STATE' | 'VALIDATION_FAILED'
  | 'RATE_LIMITED' | 'PROVIDER_FAILED' | 'CAPABILITY_DISABLED' | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Array<{ path: string; issue: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
