import cors from "cors";
import express from "express";

import { env, type ApiEnv } from "./config/env";
import { createCorsOptions, createCorsOriginGuard } from "./middleware/cors-policy";
import { createErrorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { createRequestIdMiddleware } from "./middleware/request-id";
import { createRequestLogger, type RequestLogSink } from "./middleware/request-logger";
import { createSecurityHeadersMiddleware } from "./middleware/security-headers";
import { apiRouter } from "./routes/api.routes";
import { healthRouter } from "./routes/health.routes";
import { readinessRouter } from "./routes/readiness.routes";

export interface CreateAppOptions {
  env?: ApiEnv;
  requestLogSink?: RequestLogSink;
  errorLogSink?: (message: string, details?: unknown) => void;
}

export const configureTrustProxy = (expressApp: express.Express, trustProxyHops: number) => {
  expressApp.set("trust proxy", trustProxyHops === 0 ? false : trustProxyHops);
};

export const createApp = (options: CreateAppOptions = {}) => {
  const appEnv = options.env ?? env;
  const expressApp = express();

  configureTrustProxy(expressApp, appEnv.trustProxyHops);
  expressApp.disable("x-powered-by");

  expressApp.use(createRequestIdMiddleware());
  expressApp.use(createRequestLogger(appEnv, options.requestLogSink));
  expressApp.use(createSecurityHeadersMiddleware(appEnv));
  expressApp.use(createCorsOriginGuard(appEnv));
  expressApp.use(cors(createCorsOptions(appEnv)));
  expressApp.use(express.json({ limit: "64kb" }));

  expressApp.use(healthRouter);
  expressApp.use(readinessRouter);
  expressApp.use("/api", apiRouter);

  expressApp.use(notFoundHandler);
  expressApp.use(createErrorHandler(appEnv, options.errorLogSink));

  return expressApp;
};

export const app = createApp();
