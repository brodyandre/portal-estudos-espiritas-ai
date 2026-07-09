import { Router } from "express";

import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { listMaterials } from "./materials.service";

export const materialsRouter = Router();

materialsRouter.get(
  "/",
  asyncHandler((request, response) => {
    const groupId =
      typeof request.query.groupId === "string" ? request.query.groupId : undefined;
    const type =
      typeof request.query.type === "string"
        ? (request.query.type as "reading" | "summary" | "guide" | "activity")
        : undefined;
    const items = listMaterials({ groupId, type });

    return sendSuccess(response, {
      message: "Materiais carregados com sucesso.",
      data: items,
      meta: { count: items.length },
    });
  }),
);
