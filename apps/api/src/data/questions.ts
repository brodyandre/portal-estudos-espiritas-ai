import type { StudyGroupId } from "./studies";

export interface StudentQuestion {
  id: string;
  groupId: StudyGroupId;
  lessonId: string;
  authorName: string;
  question: string;
  status: "new" | "reviewing" | "answered";
  createdAt: string;
  visibility: "group" | "teacher";
}

export const questions: StudentQuestion[] = [
  {
    id: "question-001",
    groupId: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-13",
    authorName: "Ana Clara",
    question: "Como posso manter o estudo durante uma semana mais corrida?",
    status: "new",
    createdAt: "2026-07-09T09:10:00-03:00",
    visibility: "group",
  },
  {
    id: "question-002",
    groupId: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-13",
    authorName: "Paulo Henrique",
    question: "Vale a pena anotar uma ideia principal depois de cada leitura?",
    status: "answered",
    createdAt: "2026-07-08T18:42:00-03:00",
    visibility: "group",
  },
  {
    id: "question-003",
    groupId: "a-caminho-da-luz",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    authorName: "Marina Lopes",
    question: "Como participar mais sem interromper quem esta falando?",
    status: "reviewing",
    createdAt: "2026-07-09T08:55:00-03:00",
    visibility: "teacher",
  },
  {
    id: "question-004",
    groupId: "a-caminho-da-luz",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    authorName: "Rafael Costa",
    question: "Posso pedir um resumo curto antes da proxima aula?",
    status: "new",
    createdAt: "2026-07-08T22:05:00-03:00",
    visibility: "group",
  },
  {
    id: "question-005",
    groupId: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-06",
    authorName: "Luciana Melo",
    question: "Qual e a melhor forma de levar uma duvida pessoal para o grupo?",
    status: "answered",
    createdAt: "2026-07-06T21:28:00-03:00",
    visibility: "teacher",
  },
];
