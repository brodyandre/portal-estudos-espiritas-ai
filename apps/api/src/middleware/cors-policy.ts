import type { CorsOptions } from "cors";
import type { RequestHandler } from "express";

import { env, type ApiEnv } from "../config/env";
import { AppError } from "../lib/app-error";

export const isCorsOriginAllowed = (config: ApiEnv, origin: string | undefined): boolean => {
  if (!origin) {
    return true;
  }

  return config.corsOrigins.includes(origin);
};

export const createCorsOptions = (config: ApiEnv = env): CorsOptions => ({
  origin(origin, callback) {
    return callback(null, isCorsOriginAllowed(config, origin));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "Accept"],
  exposedHeaders: ["X-Request-Id"],
  optionsSuccessStatus: 204,
});

export const createCorsOriginGuard = (config: ApiEnv = env): RequestHandler => {
  return (request, _response, next) => {
    if (isCorsOriginAllowed(config, request.headers.origin)) {
      return next();
    }

    return next(
      new AppError({
        statusCode: 403,
        code: "CORS_ORIGIN_FORBIDDEN",
        message: "Origem não permitida para esta API.",
      }),
    );
  };
};
