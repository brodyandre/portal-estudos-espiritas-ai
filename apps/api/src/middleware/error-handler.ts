import type { ErrorRequestHandler } from "express";

import { env } from "../config/env";
import { AppError } from "../lib/app-error";
import type { ApiErrorBody } from "../lib/api-response";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof SyntaxError && "body" in error
        ? new AppError({
            statusCode: 400,
            code: "INVALID_JSON",
            message: "O corpo da requisicao contem JSON invalido.",
          })
        : new AppError({
            statusCode: 500,
            code: "INTERNAL_SERVER_ERROR",
            message: "Nao foi possivel concluir a solicitacao.",
          });

  if (env.nodeEnv !== "test" && appError.statusCode >= 500) {
    console.error("[api:error]", error);
  }

  if (appError.headers) {
    for (const [headerName, headerValue] of Object.entries(appError.headers)) {
      response.setHeader(headerName, headerValue);
    }
  }

  const body: ApiErrorBody = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  if (appError.details) {
    body.error.details = appError.details;
  }

  return response.status(appError.statusCode).json(body);
};
