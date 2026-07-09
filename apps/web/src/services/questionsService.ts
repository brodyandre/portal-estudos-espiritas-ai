import {
  createMockQuestion,
  groups,
  listMockQuestions,
  summaries,
  type DemoQuestion,
  type GroupSlug,
} from "../mocks";
import { loadWithFallback } from "./api";
import { buildLessonTitleLookup, sortQuestionsByDate } from "./formatters";

interface ApiQuestion {
  id: string;
  groupId: GroupSlug;
  lessonId: string;
  authorName: string;
  question: string;
  status: "new" | "reviewing" | "answered";
  createdAt: string;
  visibility: "group" | "teacher";
}

export interface CreateQuestionInput {
  groupId: GroupSlug;
  lessonId: string;
  authorName: string;
  question: string;
  visibility?: "group" | "teacher";
}

const lessonTitleLookup = buildLessonTitleLookup(
  summaries.map((summary) => ({
    lessonId: summary.lessonId,
    lessonTitle: summary.lessonTitle,
  })),
  groups.map((group) => ({
    id: group.nextLesson.id,
    title: group.nextLesson.title,
  })),
);

const groupNameLookup = new Map(groups.map((group) => [group.slug, group.name]));

const mapQuestion = (question: ApiQuestion): DemoQuestion => {
  return {
    id: question.id,
    authorName: question.authorName,
    groupSlug: question.groupId,
    lessonId: question.lessonId,
    lessonTitle:
      lessonTitleLookup.get(question.lessonId) ??
      `Aula recente do grupo ${groupNameLookup.get(question.groupId) ?? "selecionado"}`,
    question: question.question,
    status: question.status,
    createdAt: question.createdAt,
    visibility: question.visibility,
  };
};

export const listQuestions = (filters?: {
  groupSlug?: GroupSlug;
  status?: DemoQuestion["status"];
}) => {
  return loadWithFallback<ApiQuestion[], DemoQuestion[]>({
    path: "/api/questions",
    query: {
      groupId: filters?.groupSlug,
      status: filters?.status,
    },
    fallback: () => listMockQuestions(filters),
    mapData: (items) => sortQuestionsByDate(items.map(mapQuestion)),
    friendlyMessage:
      "As duvidas nao puderam ser atualizadas pelo servidor agora. Exibimos a lista demonstrativa para voce continuar.",
  });
};

export const createQuestion = (input: CreateQuestionInput) => {
  return loadWithFallback<ApiQuestion, DemoQuestion>({
    path: "/api/questions",
    init: {
      method: "POST",
      body: JSON.stringify(input),
    },
    fallback: () =>
      createMockQuestion({
        groupSlug: input.groupId,
        lessonId: input.lessonId,
        authorName: input.authorName,
        question: input.question,
        visibility: input.visibility,
      }),
    mapData: mapQuestion,
    friendlyMessage:
      "A duvida foi registrada em modo demonstrativo. Quando o servidor estiver ativo, ela podera ser enviada para a API.",
  });
};
