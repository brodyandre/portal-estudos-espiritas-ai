import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../lib/app-error";
import type { UserRole } from "../../auth/types";
import {
  getAuthenticatedUserFromTokenPayload,
  userHasAnyRole,
  verifyAuthToken,
} from "./auth.service";
import type { AuthTokenPayload, AuthUser, StoredAuthSession } from "./auth.types";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser;
    authSession?: StoredAuthSession;
    authTokenPayload?: AuthTokenPayload;
  }
}

const UNAUTHORIZED_MESSAGE = "Faça login no ambiente local para continuar.";
const PASSWORD_CHANGE_MESSAGE = "Troque sua senha temporária para continuar.";
const isPasswordChangeAllowedRoute = (routeKey: string) => {
  if (routeKey === "GET:/api/auth/me") {
    return true;
  }

  if (routeKey === "POST:/api/auth/logout") {
    return true;
  }

  return routeKey === "PATCH:/api/auth/change-password";
};

const getBearerToken = (request: Request) => {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
};

export const requireAuth = async (request: Request, _response: Response, next: NextFunction) => {
  const token = getBearerToken(request);

  if (!token) {
    return next(
      new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: UNAUTHORIZED_MESSAGE,
      }),
    );
  }

  try {
    const payload = verifyAuthToken(token);
    const routeKey = `${request.method.toUpperCase()}:${request.baseUrl}${request.path}`;
    const authenticatedContext = await getAuthenticatedUserFromTokenPayload(payload, {
      allowRevokedSession: routeKey === "POST:/api/auth/logout",
    });

    if (!authenticatedContext) {
      return next(
        new AppError({
          statusCode: 401,
          code: "AUTH_REQUIRED",
          message: UNAUTHORIZED_MESSAGE,
        }),
      );
    }

    const { user, session } = authenticatedContext;

    if (user.mustChangePassword && !isPasswordChangeAllowedRoute(routeKey)) {
      return next(
        new AppError({
          statusCode: 403,
          code: "PASSWORD_CHANGE_REQUIRED",
          message: PASSWORD_CHANGE_MESSAGE,
        }),
      );
    }

    request.authUser = user;
    request.authSession = session;
    request.authTokenPayload = payload;
    return next();
  } catch (_error) {
    return next(
      new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: UNAUTHORIZED_MESSAGE,
      }),
    );
  }
};

export const requireRole = (roles: UserRole[]) => {
  return [
    requireAuth,
    (request: Request, _response: Response, next: NextFunction) => {
      if (!request.authUser) {
        return next(
          new AppError({
            statusCode: 401,
            code: "AUTH_REQUIRED",
            message: UNAUTHORIZED_MESSAGE,
          }),
        );
      }

      if (!userHasAnyRole(request.authUser, roles)) {
        return next(
          new AppError({
            statusCode: 403,
            code: "FORBIDDEN",
            message: "Seu perfil não tem acesso a este recurso.",
          }),
        );
      }

      return next();
    },
  ];
};
