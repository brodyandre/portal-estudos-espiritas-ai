import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { requireRole } from "../auth/auth.middleware";
import { presentBookAccessScope } from "../book-access/book-access.presenter";
import { resolveBookAccessScope } from "../book-access/book-access.service";
import { parseUpcomingUserStudyMeetingsQuery } from "./study-meetings.query";
import { presentUpcomingUserStudyMeetings } from "./study-meetings.presenter";
import { listUpcomingUserStudyMeetings } from "./study-meetings.service";

export const meRouter = Router();

meRouter.get(
  "/book-access",
  ...requireRole(["student", "teacher"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const scope = await resolveBookAccessScope(request.authUser);

    return sendSuccess(response, {
      message: "Acesso aos livros de estudo carregado com sucesso.",
      data: presentBookAccessScope(scope),
      meta: {
        count: scope.groups.length,
      },
    });
  }),
);

meRouter.get(
  "/study-meetings/upcoming",
  ...requireRole(["student", "teacher"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await listUpcomingUserStudyMeetings(
      request.authUser,
      parseUpcomingUserStudyMeetingsQuery(request.query),
    );

    return sendSuccess(response, {
      message: "Encontros do seu grupo carregados com sucesso.",
      data: presentUpcomingUserStudyMeetings(result),
      meta: {
        limit: result.limit,
      },
    });
  }),
);
