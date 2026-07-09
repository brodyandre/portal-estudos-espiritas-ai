import { Router } from "express";

import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { listSummaries } from "./summaries.service";

export const summariesRouter = Router();

summariesRouter.get(
  "/",
  asyncHandler((request, response) => {
    const groupId =
      typeof request.query.groupId === "string" ? request.query.groupId : undefined;
    const items = listSummaries(groupId);

    return sendSuccess(response, {
      message: "Resumos carregados com sucesso.",
      data: items,
      meta: { count: items.length },
    });
  }),
);
