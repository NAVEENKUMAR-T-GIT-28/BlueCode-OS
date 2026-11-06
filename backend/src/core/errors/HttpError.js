export class HttpError extends Error {
  constructor(status, message, details = undefined, code = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
    this.code = code || `HTTP_${status}`;
    Error.captureStackTrace?.(this, HttpError);
  }
}
