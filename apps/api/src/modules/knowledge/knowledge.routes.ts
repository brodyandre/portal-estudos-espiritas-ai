import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import {
  getKnowledgeGroupDetails,
  listKnowledgeFilesByGroup,
  listKnowledgeGroups,
  listKnowledgeOverview,
  parseKnowledgeGroup,
  searchKnowledge,
} from "./knowledge.service";

export const knowledgeRouter = Router();

const getFirstString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const firstString = value.find((item) => typeof item === "string");

    return typeof firstString === "string" ? firstString : undefined;
  }

  return undefined;
};

const requireKnowledgeGroup = (rawGroup: string) => {
  const parsedGroup = parseKnowledgeGroup(rawGroup);

  if (!parsedGroup) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_GROUP_NOT_FOUND",
      message: "Grupo da base de conhecimento nao encontrado.",
      details: {
        group: rawGroup,
        acceptedGroups: ["emmanuel", "a_caminho_da_luz"],
      },
    });
  }

  return parsedGroup;
};

const requireGroupParam = (rawGroup: unknown): string => {
  const group = getFirstString(rawGroup);

  if (!group) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_GROUP_NOT_FOUND",
      message: "Grupo da base de conhecimento nao encontrado.",
      details: {
        group: null,
        acceptedGroups: ["emmanuel", "a_caminho_da_luz"],
      },
    });
  }

  return group;
};

knowledgeRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const overview = await listKnowledgeOverview();

    return sendSuccess(response, {
      message: "Base de conhecimento carregada com sucesso.",
      data: overview,
      meta: {
        totalFiles: overview.totalFiles,
        totalGroups: overview.totalGroups,
      },
    });
  }),
);

knowledgeRouter.get(
  "/groups",
  asyncHandler(async (_request, response) => {
    const groups = await listKnowledgeGroups();

    return sendSuccess(response, {
      message: "Grupos da base de conhecimento carregados com sucesso.",
      data: groups,
      meta: { count: groups.length },
    });
  }),
);

knowledgeRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const rawQuery = getFirstString(request.query.q);
    const rawGroup = getFirstString(request.query.group);

    if (!rawQuery || rawQuery.trim().length < 2) {
      throw new AppError({
        statusCode: 400,
        code: "INVALID_KNOWLEDGE_QUERY",
        message: "Informe um termo de busca com pelo menos 2 caracteres.",
      });
    }

    if (rawGroup) {
      requireKnowledgeGroup(rawGroup);
    }

    const result = await searchKnowledge(rawQuery, rawGroup);

    return sendSuccess(response, {
      message:
        result.items.length > 0
          ? "Busca na base de conhecimento concluida com sucesso."
          : "Nenhum material curto foi encontrado para esta busca.",
      data: result,
      meta: {
        count: result.items.length,
        query: result.query,
        group: rawGroup ?? null,
      },
    });
  }),
);

knowledgeRouter.get(
  "/:group/files",
  asyncHandler(async (request, response) => {
    const rawGroup = requireGroupParam(request.params.group);
    const group = requireKnowledgeGroup(rawGroup);
    const files = await listKnowledgeFilesByGroup(group.id);

    return sendSuccess(response, {
      message: `Arquivos do grupo ${group.name} carregados com sucesso.`,
      data: files ?? [],
      meta: { count: files?.length ?? 0, group: group.id },
    });
  }),
);

knowledgeRouter.get(
  "/:group",
  asyncHandler(async (request, response) => {
    const rawGroup = requireGroupParam(request.params.group);
    const group = requireKnowledgeGroup(rawGroup);
    const details = await getKnowledgeGroupDetails(group.id);

    return sendSuccess(response, {
      message: `Base do grupo ${group.name} carregada com sucesso.`,
      data: details,
      meta: { group: group.id, count: details?.featuredFiles.length ?? 0 },
    });
  }),
);
