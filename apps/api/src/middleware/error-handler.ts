import type { ErrorRequestHandler } from "express";

import { env, type ApiEnv } from "../config/env";
import { AppError } from "../lib/app-error";
import type { ApiErrorBody } from "../lib/api-response";

const isKnowledgeCorpusRebuildNullBodyError = (error: unknown, requestPath: string, method: string) =>
  method.toUpperCase() === "POST" &&
  requestPath === "/api/admin/knowledge/corpus/rebuild" &&
  error instanceof SyntaxError &&
  "body" in error &&
    (error as { body?: unknown }).body === "null";

const isPayloadTooLargeError = (error: unknown) => {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    (error as { type?: unknown }).type === "entity.too.large" &&
    (error as { status?: unknown }).status === 413
  );
};

export const createErrorHandler = (
  config: ApiEnv = env,
  errorSink: (message: string, details?: unknown) => void = (message, details) => console.error(message, details),
): ErrorRequestHandler => {
  return (error, request, response, _next) => {
    const appError =
      error instanceof AppError
        ? error
        : isPayloadTooLargeError(error)
          ? new AppError({
              statusCode: 413,
              code: "PAYLOAD_TOO_LARGE",
              message: "O corpo da requisicao excede o limite permitido.",
            })
        : isKnowledgeCorpusRebuildNullBodyError(error, request.originalUrl.split("?")[0] ?? "", request.method)
          ? new AppError({
              statusCode: 400,
              code: "INVALID_KNOWLEDGE_CORPUS_REBUILD_INPUT",
              message: "Dados invalidos para reconstruir o corpus governado.",
            })
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

    if (config.nodeEnv !== "test" && process.env.VITEST !== "true" && appError.statusCode >= 500) {
      errorSink("[api:error]", {
        requestId: request.requestId,
        code: appError.code,
        error,
      });
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
};

export const errorHandler = createErrorHandler();
