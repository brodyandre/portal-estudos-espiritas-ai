export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(options: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
    headers?: Record<string, string>;
  }) {
    super(options.message);
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.headers = options.headers;
  }
}
