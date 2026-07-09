import { Router } from "express";

import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { getProgress } from "./progress.service";

export const progressRouter = Router();

progressRouter.get(
  "/",
  asyncHandler((request, response) => {
    const studentId =
      typeof request.query.studentId === "string" ? request.query.studentId : undefined;
    const groupId =
      typeof request.query.groupId === "string" ? request.query.groupId : undefined;
    const result = getProgress({ studentId, groupId });

    return sendSuccess(response, {
      message: "Progresso carregado com sucesso.",
      data: result,
      meta: { count: result.items.length },
    });
  }),
);
