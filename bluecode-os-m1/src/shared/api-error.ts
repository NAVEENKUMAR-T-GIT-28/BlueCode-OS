export type ErrorCode =
  | 'MALFORMED_REQUEST' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_A_MEMBER'
  | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_STATE' | 'VALIDATION_FAILED'
  | 'PLAN_LIMIT_REACHED' | 'TRIAL_EXPIRED'
  | 'RATE_LIMITED' | 'PROVIDER_FAILED' | 'CAPABILITY_DISABLED' | 'INTERNAL';

export type ApiErrorDetails =
  | Array<{ path: string; issue: string }>
  | Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
