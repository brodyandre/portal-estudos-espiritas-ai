import { listMockSummaries, type DemoSummary, type GroupSlug } from "../mocks";
import { formatReadingTimeLabel } from "./formatters";
import { loadWithFallback } from "./api";

interface ApiSummary {
  id: string;
  groupId: GroupSlug;
  lessonId: string;
  title: string;
  lessonTitle: string;
  createdAt: string;
  readingTimeMinutes: number;
  content: string;
  takeaways: string[];
}

const mapSummary = (summary: ApiSummary): DemoSummary => {
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

export const listSummaries = (groupSlug?: GroupSlug) => {
  return loadWithFallback<ApiSummary[], DemoSummary[]>({
    path: "/api/summaries",
    query: groupSlug ? { groupId: groupSlug } : undefined,
    fallback: () => listMockSummaries(groupSlug),
    mapData: (items) => items.map(mapSummary),
    friendlyMessage:
      "Os resumos mais recentes nao puderam ser atualizados agora. Exibimos a versao demonstrativa para manter o estudo fluindo.",
  });
};
