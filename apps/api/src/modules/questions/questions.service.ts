import { questions as seededQuestions, type StudentQuestion } from "../../data/questions";

export interface CreateQuestionInput {
  groupId: StudentQuestion["groupId"];
  lessonId: string;
  authorName: string;
  question: string;
  visibility: StudentQuestion["visibility"];
}

const questionStore: StudentQuestion[] = [...seededQuestions];

export const listQuestions = (filters?: {
  groupId?: string;
  status?: StudentQuestion["status"];
}): StudentQuestion[] => {
  return questionStore.filter((question) => {
    if (filters?.groupId && question.groupId !== filters.groupId) {
      return false;
    }

    if (filters?.status && question.status !== filters.status) {
      return false;
    }

    return true;
  });
};

export const createQuestion = (input: CreateQuestionInput): StudentQuestion => {
  const createdQuestion: StudentQuestion = {
    id: `question-${Date.now()}`,
    groupId: input.groupId,
    lessonId: input.lessonId,
    authorName: input.authorName,
    question: input.question,
    status: "new",
    visibility: input.visibility,
    createdAt: new Date().toISOString(),
  };

  questionStore.unshift(createdQuestion);

  return createdQuestion;
};

export const resetQuestionStore = (): void => {
  questionStore.splice(0, questionStore.length, ...seededQuestions);
};
