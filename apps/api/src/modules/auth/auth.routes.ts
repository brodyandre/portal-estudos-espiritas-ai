import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "./auth.middleware";
import {
  changePassword,
  getAuthenticatedUser,
  loginUser,
  logoutAllSessions,
  logoutCurrentSession,
} from "./auth.service";
import type { ChangePasswordInput, LoginInput } from "./auth.types";

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object";
};

const parseLoginBody = (body: unknown): LoginInput => {
  if (!isObjectRecord(body)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_REQUEST_BODY",
      message: "Envie um corpo JSON válido.",
    });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_LOGIN_INPUT",
      message: "Informe e-mail e senha para continuar.",
    });
  }

  return { email, password };
};

export const authRouter = Router();

const parseChangePasswordBody = (body: unknown): ChangePasswordInput => {
  if (!isObjectRecord(body)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_REQUEST_BODY",
      message: "Envie um corpo JSON válido.",
    });
  }

  return {
    currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
    newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
    confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
  };
};

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const result = await loginUser(parseLoginBody(request.body), {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return sendSuccess(response, {
      status: 200,
      message: "Login local realizado com sucesso.",
      data: result,
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const authUser = request.authUser;

    if (!authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const currentUser = await getAuthenticatedUser(authUser.id);

    if (!currentUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    return sendSuccess(response, {
      message: "Perfil carregado com sucesso.",
      data: currentUser,
    });
  }),
);

authRouter.patch(
  "/change-password",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    if (!request.authSession) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await changePassword(request.authUser, request.authSession, parseChangePasswordBody(request.body), {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return sendSuccess(response, {
      message: "Senha atualizada com sucesso.",
      data: result,
    });
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!request.authUser || !request.authSession) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    await logoutCurrentSession(request.authUser, request.authSession.id);

    return sendSuccess(response, {
      message: "Sessão encerrada com sucesso.",
      data: {
        revokedCurrentSession: true,
      },
    });
  }),
);

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const revokedSessions = await logoutAllSessions(request.authUser);

    return sendSuccess(response, {
      message: "Todas as sessões locais foram encerradas.",
      data: {
        revokedSessions,
      },
    });
  }),
);
