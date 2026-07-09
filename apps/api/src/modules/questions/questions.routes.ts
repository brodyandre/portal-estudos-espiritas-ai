import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { isStudyGroupId } from "../studies/studies.service";
import { createQuestion, listQuestions, type CreateQuestionInput } from "./questions.service";

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const parseCreateQuestionBody = (body: unknown): CreateQuestionInput => {
  if (!body || typeof body !== "object") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_REQUEST_BODY",
      message: "Envie um corpo JSON valido.",
    });
  }

  const candidate = body as Record<string, unknown>;
  const groupId = candidate.groupId;
  const lessonId = candidate.lessonId;
  const authorName = candidate.authorName;
  const question = candidate.question;
  const visibility = candidate.visibility ?? "group";

  if (!isNonEmptyString(groupId) || !isStudyGroupId(groupId)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_GROUP_ID",
      message: "Informe um groupId valido.",
    });
  }

  if (!isNonEmptyString(lessonId)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_LESSON_ID",
      message: "Informe o lessonId da aula.",
    });
  }

  if (!isNonEmptyString(authorName) || authorName.trim().length < 2) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_AUTHOR_NAME",
      message: "Informe um nome com pelo menos 2 caracteres.",
    });
  }

  if (!isNonEmptyString(question) || question.trim().length < 10) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_QUESTION",
      message: "Envie uma duvida com pelo menos 10 caracteres.",
    });
  }

  if (visibility !== "group" && visibility !== "teacher") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_VISIBILITY",
      message: "O campo visibility deve ser group ou teacher.",
    });
  }

  return {
    groupId,
    lessonId: lessonId.trim(),
    authorName: authorName.trim(),
    question: question.trim(),
    visibility,
  };
};

export const questionsRouter = Router();

questionsRouter.get(
  "/",
  asyncHandler((request, response) => {
    const groupId =
      typeof request.query.groupId === "string" ? request.query.groupId : undefined;
    const status =
      typeof request.query.status === "string"
        ? (request.query.status as "new" | "reviewing" | "answered")
        : undefined;

    const items = listQuestions({ groupId, status });

    return sendSuccess(response, {
      message: "Duvidas carregadas com sucesso.",
      data: items,
      meta: { count: items.length },
    });
  }),
);

questionsRouter.post(
  "/",
  asyncHandler((request, response) => {
    const input = parseCreateQuestionBody(request.body);
    const createdQuestion = createQuestion(input);

    return sendSuccess(response, {
      status: 201,
      message: "Duvida criada com sucesso.",
      data: createdQuestion,
    });
  }),
);
