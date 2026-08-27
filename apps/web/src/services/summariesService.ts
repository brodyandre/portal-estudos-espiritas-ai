import { listMockSummaries, type DemoSummary } from "../mocks";
import type { StudyGroupId } from "../types/studyGroup";
import { isDemoGroupSlug } from "../types/studyGroup";
import { formatReadingTimeLabel } from "./formatters";
import { loadWithFallback } from "./api";

export type StudySummary = Omit<DemoSummary, "groupSlug"> & {
  groupSlug: StudyGroupId;
};

interface ApiSummary {
  id: string;
  groupId: string;
  lessonId: string;
  title: string;
  lessonTitle: string;
  createdAt: string;
  readingTimeMinutes: number;
  content: string;
  takeaways: string[];
}

const mapSummary = (summary: ApiSummary): StudySummary => {
  return {
    id: summary.id,
    groupSlug: summary.groupId,
    lessonId: summary.lessonId,
    title: summary.title,
    lessonTitle: summary.lessonTitle,
    createdAt: summary.createdAt,
    readingTimeMinutes: summary.readingTimeMinutes,
    readingTimeLabel: formatReadingTimeLabel(summary.readingTimeMinutes),
    content: summary.content,
    takeaways: [...summary.takeaways],
  };
};

export const listSummaries = (groupSlug?: StudyGroupId) => {
  return loadWithFallback<ApiSummary[], StudySummary[]>({
    path: "/api/summaries",
    query: groupSlug ? { groupId: groupSlug } : undefined,
    fallback: () =>
      listMockSummaries(groupSlug && isDemoGroupSlug(groupSlug) ? groupSlug : undefined),
    mapData: (items) => items.map(mapSummary),
    friendlyMessage:
      "Os resumos mais recentes nao puderam ser atualizados agora. Exibimos a versao demonstrativa para manter o estudo fluindo.",
  });
};
