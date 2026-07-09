import { AppError } from "../../lib/app-error";
import { getStudyBySlug, isStudyGroupId } from "../studies/studies.service";
import {
  buildLessonPlanFallback,
  buildReflectionQuestionsFallback,
  buildSummarizeFallback,
} from "../../agent/fallbacks";
import { answerQuestionWithGraph } from "../../agent/answer-graph";
import { generateWithOllama } from "../../agent/llm";
import {
  buildLessonPlanPrompt,
  buildReflectionQuestionsPrompt,
  buildSummarizePrompt,
} from "../../agent/prompts";
import {
  AGENT_REVIEW_NOTE,
  AGENT_SOURCE_NOTE,
  type AgentAnswerResult,
  type AgentDraft,
  type LessonPlanRequest,
  type ReflectionQuestionsRequest,
  type SummarizeRequest,
  type AnswerRequest,
} from "../../agent/types";
import { extractListItems, formatList, sanitizeGeneratedText } from "../../agent/safety";

const resolveGroup = (groupId: string) => {
  if (!isStudyGroupId(groupId)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_GROUP_ID",
      message: "Informe um groupId valido.",
    });
  }

  const group = getStudyBySlug(groupId);

  if (!group) {
    throw new AppError({
      statusCode: 404,
      code: "STUDY_NOT_FOUND",
      message: "Grupo de estudo nao encontrado.",
      details: { groupId },
    });
  }

  return group;
};

const buildAgentDraft = (options: {
  kind: AgentDraft["kind"];
  title: string;
  content: string;
  items?: string[];
}): AgentDraft => {
  return {
    kind: options.kind,
    title: options.title,
    content: options.content,
    items: options.items,
    provider: "ollama",
    usedFallback: false,
    reviewNote: AGENT_REVIEW_NOTE,
    sourceNote: AGENT_SOURCE_NOTE,
  };
};

export const createLessonPlanDraft = async (
  input: LessonPlanRequest,
): Promise<AgentDraft> => {
  const group = resolveGroup(input.groupId);
  const prompt = buildLessonPlanPrompt();
  const messages = await prompt.formatMessages({
    groupName: group.name,
    bookTitle: input.bookTitle ?? group.bookTitle,
    theme: input.theme,
    durationMinutes: String(input.durationMinutes ?? 60),
    teacherNote: input.teacherNote ?? "Nao informado.",
    context: input.context ?? "Nao ha contexto adicional enviado.",
  });

  const llmResult = await generateWithOllama(messages);

  if (!llmResult.ok) {
    return buildLessonPlanFallback(
      input,
      { groupName: group.name, bookTitle: input.bookTitle ?? group.bookTitle },
      llmResult.reason,
    );
  }

  const safeText = sanitizeGeneratedText(llmResult.text, { maxLength: 1800 });

  if (!safeText.ok) {
    return buildLessonPlanFallback(
      input,
      { groupName: group.name, bookTitle: input.bookTitle ?? group.bookTitle },
      safeText.reason,
    );
  }

  return buildAgentDraft({
    kind: "lesson-plan",
    title: `Roteiro inicial para ${group.name}`,
    content: safeText.text,
  });
};

export const createReflectionQuestionsDraft = async (
  input: ReflectionQuestionsRequest,
): Promise<AgentDraft> => {
  const group = resolveGroup(input.groupId);
  const questionCount = Math.min(Math.max(input.questionCount ?? 5, 3), 7);
  const prompt = buildReflectionQuestionsPrompt();
  const messages = await prompt.formatMessages({
    groupName: group.name,
    bookTitle: input.bookTitle ?? group.bookTitle,
    theme: input.theme,
    questionCount: String(questionCount),
    context: input.context ?? "Nao ha contexto adicional enviado.",
  });

  const llmResult = await generateWithOllama(messages);

  if (!llmResult.ok) {
    return buildReflectionQuestionsFallback(
      { ...input, questionCount },
      { groupName: group.name, bookTitle: input.bookTitle ?? group.bookTitle },
      llmResult.reason,
    );
  }

  const safeText = sanitizeGeneratedText(llmResult.text, { maxLength: 1200 });

  if (!safeText.ok) {
    return buildReflectionQuestionsFallback(
      { ...input, questionCount },
      { groupName: group.name, bookTitle: input.bookTitle ?? group.bookTitle },
      safeText.reason,
    );
  }

  const items = extractListItems(safeText.text).slice(0, questionCount);

  if (items.length < 3) {
    return buildReflectionQuestionsFallback(
      { ...input, questionCount },
      { groupName: group.name, bookTitle: input.bookTitle ?? group.bookTitle },
      "O texto retornado nao trouxe perguntas suficientes para revisao.",
    );
  }

  return buildAgentDraft({
    kind: "reflection-questions",
    title: `Perguntas sugeridas para ${group.name}`,
    content: formatList(items),
    items,
  });
};

export const createSummaryDraft = async (
  input: SummarizeRequest,
): Promise<AgentDraft> => {
  const group = resolveGroup(input.groupId);
  const prompt = buildSummarizePrompt();
  const messages = await prompt.formatMessages({
    groupName: group.name,
    bookTitle: input.bookTitle ?? group.bookTitle,
    theme: input.theme ?? "Nao informado.",
    sourceText: input.sourceText,
  });

  const llmResult = await generateWithOllama(messages);

  if (!llmResult.ok) {
    return buildSummarizeFallback(
      input,
      { groupName: group.name, bookTitle: input.bookTitle ?? group.bookTitle },
      llmResult.reason,
    );
  }

  const safeText = sanitizeGeneratedText(llmResult.text, { maxLength: 1800 });

  if (!safeText.ok) {
    return buildSummarizeFallback(
      input,
      { groupName: group.name, bookTitle: input.bookTitle ?? group.bookTitle },
      safeText.reason,
    );
  }

  return buildAgentDraft({
    kind: "summarize",
    title: `Resumo inicial para ${group.name}`,
    content: safeText.text,
  });
};

export const createAnswerResponse = async (
  input: AnswerRequest,
): Promise<AgentAnswerResult> => {
  const group = resolveGroup(input.groupId);
  return answerQuestionWithGraph(input, group);
};
