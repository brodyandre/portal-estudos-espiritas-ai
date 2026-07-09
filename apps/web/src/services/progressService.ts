import {
  getMockProgress,
  type DemoProgressResponse,
  type GroupSlug,
} from "../mocks";
import { formatPercentLabel } from "./formatters";
import { loadWithFallback } from "./api";

interface ApiProgressItem {
  id: string;
  studentId: string;
  studentName: string;
  groupId: GroupSlug;
  completedLessons: number;
  totalLessons: number;
  attendanceRate: number;
  currentStreakWeeks: number;
  questionsSent: number;
  lastAccessedAt: string;
  nextGoal: string;
  encouragement: string;
}

interface ApiProgressResponse {
  overview: {
    studentId: string;
    studentName: string;
    totalCompletedLessons: number;
    totalPlannedLessons: number;
    averageAttendanceRate: number;
    assistantPrompt: string;
  };
  items: ApiProgressItem[];
}

export interface ProgressHighlight {
  label: string;
  value: string;
  note: string;
  percentage: number;
}

const mapProgress = (payload: ApiProgressResponse): DemoProgressResponse => {
  return {
    overview: { ...payload.overview },
    items: payload.items.map((item) => ({
      ...item,
      groupSlug: item.groupId,
    })),
  };
};

export const getProgress = (filters?: { studentId?: string; groupSlug?: GroupSlug }) => {
  return loadWithFallback<ApiProgressResponse, DemoProgressResponse>({
    path: "/api/progress",
    query: {
      studentId: filters?.studentId,
      groupId: filters?.groupSlug,
    },
    fallback: () => getMockProgress(filters),
    mapData: mapProgress,
    friendlyMessage:
      "O progresso do aluno nao foi atualizado agora pelo servidor. O painel segue com os dados demonstrativos para apoiar seu estudo.",
  });
};

export const buildProgressHighlights = (progress: DemoProgressResponse): ProgressHighlight[] => {
  const totalQuestions = progress.items.reduce((sum, item) => sum + item.questionsSent, 0);
  const completedShare =
    progress.overview.totalPlannedLessons > 0
      ? (progress.overview.totalCompletedLessons / progress.overview.totalPlannedLessons) * 100
      : 0;

  return [
    {
      label: "Aulas concluidas",
      value: `${progress.overview.totalCompletedLessons} de ${progress.overview.totalPlannedLessons}`,
      note: "Ritmo constante e acompanhamento regular.",
      percentage: Math.min(Math.round(completedShare), 100),
    },
    {
      label: "Presenca media",
      value: formatPercentLabel(progress.overview.averageAttendanceRate),
      note: "Boa participacao nos encontros demonstrativos.",
      percentage: Math.min(Math.round(progress.overview.averageAttendanceRate * 100), 100),
    },
    {
      label: "Perguntas enviadas",
      value: String(totalQuestions),
      note: "Duvidas registradas com clareza ajudam o grupo todo.",
      percentage: Math.min(40 + totalQuestions * 12, 100),
    },
  ];
};
