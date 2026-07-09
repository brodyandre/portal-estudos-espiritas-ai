import type { RequestHandler } from "express";

import { isDevelopment } from "../config/env";

export const requestLogger: RequestHandler = (request, response, next) => {
  if (!isDevelopment) {
    return next();
  }

  const startedAt = Date.now();

  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[api] ${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`,
    );
  });

  return next();
};
