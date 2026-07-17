import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

const readRequestIdHeader = (value: string | string[] | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  if (!REQUEST_ID_PATTERN.test(value)) {
    return null;
  }

  return value;
};

export const createRequestIdMiddleware = (): RequestHandler => {
  return (request, response, next) => {
    const requestId = readRequestIdHeader(request.headers["x-request-id"]) ?? randomUUID();

    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);

    return next();
  };
};

export const requestIdMiddleware = createRequestIdMiddleware();
