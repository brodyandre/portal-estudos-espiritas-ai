import type { UserStudyMeetingsResult } from "../types/userStudyMeetings";

export const mockUserStudyMeetings: UserStudyMeetingsResult = {
  group: {
    id: "emmanuel",
    name: "Emmanuel",
    status: "active",
  },
  items: [
    {
      id: "demo-meeting-current",
      title: "Encontro demonstrativo em andamento",
      description: "Agenda ficticia para validar a experiencia visual sem expor links reais.",
      startsAt: "2026-07-15T20:00:00.000-03:00",
      endsAt: "2026-07-15T21:00:00.000-03:00",
      status: "ongoing",
      meetUrl: null,
    },
    {
      id: "demo-meeting-next",
      title: "Proximo encontro demonstrativo",
      description: "Preparacao da semana no grupo autenticado demonstrativo.",
      startsAt: "2026-07-22T20:00:00.000-03:00",
      endsAt: "2026-07-22T21:00:00.000-03:00",
      status: "scheduled",
      meetUrl: null,
    },
  ],
  limit: 3,
  source: "mock",
  notice:
    "Modo demonstrativo: a agenda real do grupo fica disponivel apenas no ambiente local autenticado.",
};

export const getMockUserStudyMeetings = (limit: number): UserStudyMeetingsResult => ({
  ...mockUserStudyMeetings,
  items: mockUserStudyMeetings.items.slice(0, limit),
  limit,
});
