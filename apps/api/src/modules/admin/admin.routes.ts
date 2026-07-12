import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { requireRole } from "../auth/auth.middleware";
import { resetPasswordByAdmin } from "../auth/auth.service";

const getRouteParam = (value: string | string[] | undefined): string => {
  return Array.isArray(value) ? value[0] ?? "" : (value ?? "");
};

export const adminRouter = Router();

adminRouter.post(
  "/users/:userId/reset-password",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await resetPasswordByAdmin(request.authUser, getRouteParam(request.params.userId));

    return sendSuccess(response, {
      message: "Senha temporária redefinida com sucesso.",
      data: result,
    });
  }),
);
