import { Router } from "express";

import type {
  AnswerRequest,
  LessonPlanRequest,
  ReflectionQuestionsRequest,
  SummarizeRequest,
} from "../../agent/types";
import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { isStudyGroupId } from "../studies/studies.service";
import {
  createAnswerResponse,
  createLessonPlanDraft,
  createReflectionQuestionsDraft,
  createSummaryDraft,
} from "./agent.service";
import { normalizeInputText } from "../../agent/safety";

const ensureBodyObject = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== "object") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_REQUEST_BODY",
      message: "Envie um corpo JSON valido.",
    });
  }

  return body as Record<string, unknown>;
};

const readRequiredString = (
  candidate: Record<string, unknown>,
  field: string,
  message: string,
  minLength = 1,
): string => {
  const value = candidate[field];

  if (typeof value !== "string") {
    throw new AppError({
      statusCode: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message,
    });
  }

  const normalized = normalizeInputText(value);

  if (normalized.length < minLength) {
    throw new AppError({
      statusCode: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message,
    });
  }

  return normalized;
};

const readOptionalString = (
  candidate: Record<string, unknown>,
  field: string,
  maxLength = 2000,
): string | undefined => {
  const value = candidate[field];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError({
      statusCode: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message: `Informe o campo ${field} como texto.`,
    });
  }

  const normalized = normalizeInputText(value);

  if (normalized.length > maxLength) {
    throw new AppError({
      statusCode: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message: `O campo ${field} ficou longo demais para esta etapa.`,
    });
  }

  return normalized;
};

const readOptionalInteger = (
  candidate: Record<string, unknown>,
  field: string,
  options: { min: number; max: number },
): number | undefined => {
  const value = candidate[field];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError({
      statusCode: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message: `Informe o campo ${field} como numero inteiro.`,
    });
  }

  if (value < options.min || value > options.max) {
    throw new AppError({
      statusCode: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message: `O campo ${field} deve ficar entre ${options.min} e ${options.max}.`,
    });
  }

  return value;
};

const readGroupId = (candidate: Record<string, unknown>) => {
  const groupId = readRequiredString(
    candidate,
    "groupId",
    "Informe um groupId valido.",
  );

  if (!isStudyGroupId(groupId)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_GROUP_ID",
      message: "Informe um groupId valido.",
    });
  }

  return groupId;
};

const parseLessonPlanBody = (body: unknown): LessonPlanRequest => {
  const candidate = ensureBodyObject(body);

  return {
    groupId: readGroupId(candidate),
    theme: readRequiredString(
      candidate,
      "theme",
      "Informe o tema da aula com pelo menos 3 caracteres.",
      3,
    ),
    bookTitle: readOptionalString(candidate, "bookTitle", 180),
    context: readOptionalString(candidate, "context"),
    teacherNote: readOptionalString(candidate, "teacherNote", 400),
    durationMinutes: readOptionalInteger(candidate, "durationMinutes", {
      min: 20,
      max: 180,
    }),
  };
};

const parseReflectionQuestionsBody = (
  body: unknown,
): ReflectionQuestionsRequest => {
  const candidate = ensureBodyObject(body);

  return {
    groupId: readGroupId(candidate),
    theme: readRequiredString(
      candidate,
      "theme",
      "Informe o tema com pelo menos 3 caracteres.",
      3,
    ),
    bookTitle: readOptionalString(candidate, "bookTitle", 180),
    context: readOptionalString(candidate, "context"),
    questionCount: readOptionalInteger(candidate, "questionCount", {
      min: 3,
      max: 7,
    }),
  };
};

const parseSummarizeBody = (body: unknown): SummarizeRequest => {
  const candidate = ensureBodyObject(body);

  return {
    groupId: readGroupId(candidate),
    theme: readOptionalString(candidate, "theme", 180),
    bookTitle: readOptionalString(candidate, "bookTitle", 180),
    sourceText: readRequiredString(
      candidate,
      "sourceText",
      "Envie um texto autorizado para resumir com pelo menos 20 caracteres.",
      20,
    ),
  };
};

const parseAnswerBody = (body: unknown): AnswerRequest => {
  const candidate = ensureBodyObject(body);

  return {
    groupId: readGroupId(candidate),
    theme: readOptionalString(candidate, "theme", 180),
    bookTitle: readOptionalString(candidate, "bookTitle", 180),
    context: readOptionalString(candidate, "context"),
    question: readRequiredString(
      candidate,
      "question",
      "Envie uma pergunta com pelo menos 10 caracteres.",
      10,
    ),
  };
};

const buildSuccessMessage = (usedFallback: boolean, successMessage: string) => {
  return usedFallback
    ? "Ollama indisponivel. Conteudo de apoio gerado pelo modo de contingencia."
    : successMessage;
};

export const agentRouter = Router();

agentRouter.post(
  "/lesson-plan",
  asyncHandler(async (request, response) => {
    const input = parseLessonPlanBody(request.body);
    const draft = await createLessonPlanDraft(input);

    return sendSuccess(response, {
      message: buildSuccessMessage(
        draft.usedFallback,
        "Roteiro inicial gerado com sucesso.",
      ),
      data: draft,
      meta: {
        provider: draft.provider,
        usedFallback: draft.usedFallback,
      },
    });
  }),
);

agentRouter.post(
  "/reflection-questions",
  asyncHandler(async (request, response) => {
    const input = parseReflectionQuestionsBody(request.body);
    const draft = await createReflectionQuestionsDraft(input);

    return sendSuccess(response, {
      message: buildSuccessMessage(
        draft.usedFallback,
        "Perguntas de reflexao geradas com sucesso.",
      ),
      data: draft,
      meta: {
        provider: draft.provider,
        usedFallback: draft.usedFallback,
      },
    });
  }),
);

agentRouter.post(
  "/summarize",
  asyncHandler(async (request, response) => {
    const input = parseSummarizeBody(request.body);
    const draft = await createSummaryDraft(input);

    return sendSuccess(response, {
      message: buildSuccessMessage(
        draft.usedFallback,
        "Resumo inicial gerado com sucesso.",
      ),
      data: draft,
      meta: {
        provider: draft.provider,
        usedFallback: draft.usedFallback,
      },
    });
  }),
);

agentRouter.post(
  "/answer",
  asyncHandler(async (request, response) => {
    const input = parseAnswerBody(request.body);
    const answerResponse = await createAnswerResponse(input);

    return sendSuccess(response, {
      message: buildSuccessMessage(
        answerResponse.usedFallback,
        "Resposta inicial gerada com sucesso.",
      ),
      data: answerResponse,
      meta: {
        provider: answerResponse.provider,
        usedFallback: answerResponse.usedFallback,
      },
    });
  }),
);
