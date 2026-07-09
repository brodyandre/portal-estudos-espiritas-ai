import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { getStudyBySlug, listStudies } from "./studies.service";

export const studiesRouter = Router();

studiesRouter.get(
  "/",
  asyncHandler((_request, response) => {
    const studies = listStudies();

    return sendSuccess(response, {
      message: "Grupos de estudo carregados com sucesso.",
      data: studies,
      meta: { count: studies.length },
    });
  }),
);

studiesRouter.get(
  "/:slug",
  asyncHandler((request, response) => {
    const slug = Array.isArray(request.params.slug)
      ? request.params.slug[0]
      : request.params.slug;
    const study = slug ? getStudyBySlug(slug) : undefined;

    if (!study) {
      throw new AppError({
        statusCode: 404,
        code: "STUDY_NOT_FOUND",
        message: "Grupo de estudo nao encontrado.",
        details: { slug: slug ?? null },
      });
    }

    return sendSuccess(response, {
      message: "Grupo de estudo carregado com sucesso.",
      data: study,
    });
  }),
);
