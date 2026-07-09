import {
  getMockStudyBySlug,
  listMockStudies,
  type DemoGroup,
  type GroupSlug,
} from "../mocks";
import {
  formatMeetingDay,
  formatScheduledLabel,
  getLessonStatus,
} from "./formatters";
import { loadWithFallback } from "./api";

interface ApiStudyGroup {
  id: GroupSlug;
  name: string;
  meetingDay: string;
  meetingTime: string;
  participantCount: number;
  bookTitle: string;
  meetUrl: string;
  description: string;
  nextLesson: {
    id: string;
    title: string;
    theme: string;
    scheduledAt: string;
    meetUrl: string;
    status: "scheduled" | "published";
    teacherNote: string;
  };
}

const mapStudyGroup = (study: ApiStudyGroup): DemoGroup => {
  return {
    slug: study.id,
    name: study.name,
    meetingDay: formatMeetingDay(study.meetingDay),
    meetingTime: study.meetingTime,
    participantCount: study.participantCount,
    meetUrl: study.meetUrl,
    bookTitle: study.bookTitle,
    description: study.description,
    nextLesson: {
      id: study.nextLesson.id,
      title: study.nextLesson.title,
      theme: study.nextLesson.theme,
      scheduledAt: study.nextLesson.scheduledAt,
      scheduledLabel: formatScheduledLabel(study.nextLesson.scheduledAt),
      status: getLessonStatus(study.nextLesson.scheduledAt),
      teacherNote: study.nextLesson.teacherNote,
    },
  };
};

export const listStudies = () => {
  return loadWithFallback<ApiStudyGroup[], DemoGroup[]>({
    path: "/api/studies",
    fallback: () => listMockStudies(),
    mapData: (items) => items.map(mapStudyGroup),
    friendlyMessage:
      "Nao foi possivel carregar os grupos pelo servidor agora. Estamos mostrando os grupos demonstrativos para voce seguir.",
  });
};

export const getStudyBySlug = (slug: GroupSlug) => {
  return loadWithFallback<ApiStudyGroup, DemoGroup | null>({
    path: `/api/studies/${slug}`,
    fallback: () => getMockStudyBySlug(slug) ?? null,
    mapData: mapStudyGroup,
    friendlyMessage:
      "Nao foi possivel atualizar este grupo pelo servidor agora. O conteudo demonstrativo continua disponivel.",
  });
};
