import type {
  AdminStudyMeeting,
  AdminStudyMeetingListParams,
  AdminStudyMeetingListResult,
} from "../types/adminStudyMeetings";

const cloneMeeting = (meeting: AdminStudyMeeting): AdminStudyMeeting => ({
  ...meeting,
});

const seededMeetings: AdminStudyMeeting[] = [
  {
    id: "meeting-emmanuel-001",
    groupId: "emmanuel",
    title: "Estudo introdutório de Emmanuel",
    description: "Encontro demonstrativo para organização da agenda administrativa.",
    startsAt: "2099-07-15T23:00:00.000Z",
    endsAt: "2099-07-16T00:00:00.000Z",
    canceledAt: null,
    cancellationReason: null,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
  },
  {
    id: "meeting-emmanuel-002",
    groupId: "emmanuel",
    title: "Revisão de perguntas da semana",
    description: null,
    startsAt: "2099-07-22T23:00:00.000Z",
    endsAt: "2099-07-23T00:00:00.000Z",
    canceledAt: null,
    cancellationReason: null,
    createdAt: "2026-07-02T12:00:00.000Z",
    updatedAt: "2026-07-02T12:00:00.000Z",
  },
  {
    id: "meeting-emmanuel-canceled-001",
    groupId: "emmanuel",
    title: "Encontro demonstrativo cancelado",
    description: "Registro mantido para validar a consulta de cancelados.",
    startsAt: "2099-07-29T23:00:00.000Z",
    endsAt: "2099-07-30T00:00:00.000Z",
    canceledAt: "2026-07-03T12:00:00.000Z",
    cancellationReason: "Recesso demonstrativo do grupo.",
    createdAt: "2026-07-03T11:00:00.000Z",
    updatedAt: "2026-07-03T12:00:00.000Z",
  },
  {
    id: "meeting-emmanuel-ended-001",
    groupId: "emmanuel",
    title: "Encontro demonstrativo encerrado",
    description: "Registro passado para validar estados derivados na interface.",
    startsAt: "2026-07-01T23:00:00.000Z",
    endsAt: "2026-07-02T00:00:00.000Z",
    canceledAt: null,
    cancellationReason: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "meeting-a-caminho-da-luz-001",
    groupId: "a-caminho-da-luz",
    title: "A Caminho da Luz: roteiro da semana",
    description: "Encontro demonstrativo do segundo grupo.",
    startsAt: "2099-07-17T23:00:00.000Z",
    endsAt: "2099-07-18T00:00:00.000Z",
    canceledAt: null,
    cancellationReason: null,
    createdAt: "2026-07-04T12:00:00.000Z",
    updatedAt: "2026-07-04T12:00:00.000Z",
  },
];

const normalizePositiveInteger = (value: number | undefined, fallback: number) => {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
};

export const listMockAdminStudyMeetings = (
  groupId: string,
  params: AdminStudyMeetingListParams = {},
): AdminStudyMeetingListResult => {
  const page = normalizePositiveInteger(params.page, 1);
  const pageSize = normalizePositiveInteger(params.pageSize, 10);
  const sortOrder = params.sortOrder ?? "asc";
  const includeCanceled = params.includeCanceled ?? false;
  const filteredMeetings = seededMeetings
    .filter((meeting) => meeting.groupId === groupId)
    .filter((meeting) => includeCanceled || meeting.canceledAt === null)
    .sort((first, second) => {
      const comparison = first.startsAt.localeCompare(second.startsAt);
      return sortOrder === "asc" ? comparison : -comparison;
    });
  const total = filteredMeetings.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;

  return {
    items: filteredMeetings.slice(startIndex, startIndex + pageSize).map(cloneMeeting),
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
};

export const getMockAdminStudyMeeting = (
  groupId: string,
  meetingId: string,
): AdminStudyMeeting | null => {
  const meeting = seededMeetings.find(
    (item) => item.groupId === groupId && item.id === meetingId,
  );

  return meeting ? cloneMeeting(meeting) : null;
};
