import type { StudyGroupId } from "./studies";

export interface StudentProgress {
  id: string;
  studentId: string;
  studentName: string;
  groupId: StudyGroupId;
  completedLessons: number;
  totalLessons: number;
  attendanceRate: number;
  currentStreakWeeks: number;
  questionsSent: number;
  lastAccessedAt: string;
  nextGoal: string;
  encouragement: string;
}

export const progress: StudentProgress[] = [
  {
    id: "progress-student-001-emmanuel",
    studentId: "student-001",
    studentName: "Joao Pedro",
    groupId: "emmanuel",
    completedLessons: 8,
    totalLessons: 10,
    attendanceRate: 0.9,
    currentStreakWeeks: 4,
    questionsSent: 3,
    lastAccessedAt: "2026-07-09T07:45:00-03:00",
    nextGoal: "Ler o material demonstrativo de apoio e levar uma pergunta curta para a aula.",
    encouragement:
      "Seu progresso esta constante. Continue com passos simples e presenca atenta no encontro.",
  },
  {
    id: "progress-student-001-a-caminho-da-luz",
    studentId: "student-001",
    studentName: "Joao Pedro",
    groupId: "a-caminho-da-luz",
    completedLessons: 5,
    totalLessons: 7,
    attendanceRate: 0.86,
    currentStreakWeeks: 2,
    questionsSent: 2,
    lastAccessedAt: "2026-07-08T22:12:00-03:00",
    nextGoal: "Revisar o resumo da ultima aula antes do encontro de quarta-feira.",
    encouragement:
      "Voce esta avancando bem. Revisar com calma antes da aula pode ajudar bastante.",
  },
];

export const progressOverview = {
  studentId: "student-001",
  studentName: "Joao Pedro",
  totalCompletedLessons: 13,
  totalPlannedLessons: 17,
  averageAttendanceRate: 0.88,
  assistantPrompt:
    "Pergunte ao assistente de estudo quando quiser revisar um ponto ou preparar uma duvida com clareza.",
};
