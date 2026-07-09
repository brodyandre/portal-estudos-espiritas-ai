import type { RequestHandler } from "express";

import { AppError } from "../lib/app-error";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: `Rota nao encontrada: ${request.method} ${request.originalUrl}`,
    }),
  );
};
