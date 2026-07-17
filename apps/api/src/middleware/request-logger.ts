import type { RequestHandler } from "express";

import { env, type ApiEnv } from "../config/env";

export type RequestLogSink = (message: string) => void;

const defaultRequestLogSink: RequestLogSink = (message) => console.log(message);

export const createRequestLogger = (
  config: ApiEnv = env,
  sink: RequestLogSink = defaultRequestLogSink,
): RequestHandler => {
  return (request, response, next) => {
    if (config.nodeEnv === "test" || (process.env.VITEST === "true" && sink === defaultRequestLogSink)) {
      return next();
    }

    const startedAt = Date.now();

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const path = request.path;

      if (config.nodeEnv === "production") {
        sink(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: response.statusCode >= 500 ? "error" : "info",
            requestId: request.requestId,
            method: request.method,
            path,
            status: response.statusCode,
            durationMs,
          }),
        );
        return;
      }

      sink(`[api] ${request.requestId} ${request.method} ${path} ${response.statusCode} ${durationMs}ms`);
    });

    return next();
  };
};

export const requestLogger = createRequestLogger();
