export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(options: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(options.message);
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}
