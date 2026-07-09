import type { Response } from "express";

export interface ResponseMeta {
  count?: number;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: ResponseMeta;
}

export const sendSuccess = <T>(
  response: Response,
  options: {
    status?: number;
    message: string;
    data: T;
    meta?: ResponseMeta;
  },
) => {
  const body: ApiSuccessBody<T> = {
    success: true,
    message: options.message,
    data: options.data,
  };

  if (options.meta) {
    body.meta = options.meta;
  }

  return response.status(options.status ?? 200).json(body);
};
