import type { RequestHandler } from "express";

import { env, type ApiEnv } from "../config/env";

export const createSecurityHeadersMiddleware = (config: ApiEnv = env): RequestHandler => {
  return (request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );

    if (config.nodeEnv === "production" && config.trustProxyHops > 0 && request.secure) {
      response.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }

    return next();
  };
};

export const securityHeaders = createSecurityHeadersMiddleware();
