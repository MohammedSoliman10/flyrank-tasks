export class AdapterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class RateLimitError extends AdapterError {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = Math.max(1, Number(retryAfterSeconds) || 1);
  }
}
