import {
  createMockQuestion,
  groups,
  listMockQuestions,
  summaries,
  type DemoQuestion,
} from "../mocks";
import type { StudyGroupId } from "../types/studyGroup";
import { isDemoGroupSlug } from "../types/studyGroup";
import { loadWithFallback } from "./api";
import { buildLessonTitleLookup, sortQuestionsByDate } from "./formatters";

export type StudyQuestion = Omit<DemoQuestion, "groupSlug"> & {
  groupSlug: StudyGroupId;
};

interface ApiQuestion {
  id: string;
  groupId: string;
  lessonId: string;
  authorName: string;
  question: string;
  status: "new" | "reviewing" | "answered";
  createdAt: string;
  visibility: "group" | "teacher";
}

export interface CreateQuestionInput {
  groupId: StudyGroupId;
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
  groups.flatMap((group) =>
    group.nextLesson
      ? [{
          id: group.nextLesson.id,
          title: group.nextLesson.title,
        }]
      : [],
  ),
);

const groupNameLookup = new Map<string, string>(groups.map((group) => [group.slug, group.name]));

const mapQuestion = (question: ApiQuestion): StudyQuestion => {
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
  groupSlug?: StudyGroupId;
  status?: DemoQuestion["status"];
}) => {
  return loadWithFallback<ApiQuestion[], StudyQuestion[]>({
    path: "/api/questions",
    query: {
      groupId: filters?.groupSlug,
      status: filters?.status,
    },
    fallback: () =>
      listMockQuestions({
        groupSlug:
          filters?.groupSlug && isDemoGroupSlug(filters.groupSlug)
            ? filters.groupSlug
            : undefined,
        status: filters?.status,
      }),
    mapData: (items) => sortQuestionsByDate(items.map(mapQuestion)),
    friendlyMessage:
      "As duvidas nao puderam ser atualizadas pelo servidor agora. Exibimos a lista demonstrativa para voce continuar.",
  });
};

export const createQuestion = (input: CreateQuestionInput) => {
  return loadWithFallback<ApiQuestion, StudyQuestion>({
    path: "/api/questions",
    init: {
      method: "POST",
      body: JSON.stringify(input),
    },
    fallback: () =>
      isDemoGroupSlug(input.groupId)
        ? createMockQuestion({
            groupSlug: input.groupId,
            lessonId: input.lessonId,
            authorName: input.authorName,
            question: input.question,
            visibility: input.visibility,
          })
        : {
            id: `question-${Date.now()}`,
            authorName: input.authorName,
            groupSlug: input.groupId,
            lessonId: input.lessonId,
            lessonTitle: "Aula recente do grupo selecionado",
            question: input.question,
            status: "new",
            createdAt: new Date().toISOString(),
            visibility: input.visibility ?? "teacher",
          },
    mapData: mapQuestion,
    friendlyMessage:
      "A duvida foi registrada em modo demonstrativo. Quando o servidor estiver ativo, ela podera ser enviada para a API.",
  });
};
