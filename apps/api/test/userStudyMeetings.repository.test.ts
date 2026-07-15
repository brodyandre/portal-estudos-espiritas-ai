import { describe, expect, it } from "vitest";

import {
  createMemoryUserStudyMeetingsRepository,
  createMemoryUserStudyMeetingsState,
} from "../src/modules/me/study-meetings.repository";

const NOW = new Date("2026-07-20T20:30:00.000Z");

const buildRepository = () =>
  createMemoryUserStudyMeetingsRepository(
    createMemoryUserStudyMeetingsState({
      users: [
        { id: "student-1", groupName: "Emmanuel", groupSlug: "emmanuel" },
        { id: "student-empty", groupName: null, groupSlug: null },
      ],
      groups: [
        {
          id: "emmanuel",
          name: "Emmanuel",
          status: "active",
          meetUrl: "https://meet.google.com/emmanuel",
        },
      ],
      meetings: [
        {
          id: "ended",
          groupId: "emmanuel",
          title: "Encerrado",
          description: null,
          startsAt: "2026-07-20T18:00:00.000Z",
          endsAt: "2026-07-20T19:00:00.000Z",
          canceledAt: null,
        },
        {
          id: "future-2",
          groupId: "emmanuel",
          title: "Futuro 2",
          description: null,
          startsAt: "2026-07-22T20:00:00.000Z",
          endsAt: "2026-07-22T21:00:00.000Z",
          canceledAt: null,
        },
        {
          id: "same-start-b",
          groupId: "emmanuel",
          title: "Mesmo horario B",
          description: null,
          startsAt: "2026-07-23T20:00:00.000Z",
          endsAt: "2026-07-23T21:00:00.000Z",
          canceledAt: null,
        },
        {
          id: "same-start-a",
          groupId: "emmanuel",
          title: "Mesmo horario A",
          description: null,
          startsAt: "2026-07-23T20:00:00.000Z",
          endsAt: "2026-07-23T21:00:00.000Z",
          canceledAt: null,
        },
        {
          id: "ends-now",
          groupId: "emmanuel",
          title: "Termina agora",
          description: null,
          startsAt: "2026-07-20T19:30:00.000Z",
          endsAt: NOW.toISOString(),
          canceledAt: null,
        },
        {
          id: "ongoing",
          groupId: "emmanuel",
          title: "Em andamento",
          description: "Aberto agora",
          startsAt: "2026-07-20T20:00:00.000Z",
          endsAt: "2026-07-20T21:00:00.000Z",
          canceledAt: null,
        },
        {
          id: "canceled",
          groupId: "emmanuel",
          title: "Cancelado",
          description: null,
          startsAt: "2026-07-21T20:00:00.000Z",
          endsAt: "2026-07-21T21:00:00.000Z",
          canceledAt: "2026-07-19T10:00:00.000Z",
        },
        {
          id: "future-1",
          groupId: "emmanuel",
          title: "Futuro 1",
          description: null,
          startsAt: "2026-07-21T20:00:00.000Z",
          endsAt: "2026-07-21T21:00:00.000Z",
          canceledAt: null,
        },
        {
          id: "other-group",
          groupId: "a-caminho-da-luz",
          title: "Outro grupo",
          description: null,
          startsAt: "2026-07-21T19:00:00.000Z",
          endsAt: "2026-07-21T20:00:00.000Z",
          canceledAt: null,
        },
      ],
    }),
  );

describe("user study meetings repository", () => {
  it("resolve grupo do usuario pelo id autenticado", async () => {
    const repository = buildRepository();

    await expect(repository.findUserGroupByUserId("student-1")).resolves.toEqual({
      groupName: "Emmanuel",
      groupSlug: "emmanuel",
    });
    await expect(repository.findUserGroupByUserId("missing")).resolves.toBeNull();
  });

  it("lista apenas encontros atuais e futuros do grupo, ordenados e limitados", async () => {
    const repository = buildRepository();
    const meetings = await repository.listCurrentAndFutureMeetings({
      groupId: "emmanuel",
      now: NOW,
      limit: 2,
    });

    expect(meetings.map((meeting) => meeting.id)).toEqual(["ongoing", "future-1"]);
    expect(JSON.stringify(meetings)).not.toContain("meet.google.com");
    expect(JSON.stringify(meetings)).not.toContain("cancellationReason");
  });

  it("exclui encontro terminando exatamente agora", async () => {
    const repository = buildRepository();
    const meetings = await repository.listCurrentAndFutureMeetings({
      groupId: "emmanuel",
      now: NOW,
      limit: 10,
    });

    expect(meetings.map((meeting) => meeting.id)).not.toContain("ends-now");
  });

  it("usa id asc como desempate deterministico para mesmo startsAt", async () => {
    const repository = buildRepository();
    const meetings = await repository.listCurrentAndFutureMeetings({
      groupId: "emmanuel",
      now: NOW,
      limit: 10,
    });

    expect(meetings.map((meeting) => meeting.id)).toEqual([
      "ongoing",
      "future-1",
      "future-2",
      "same-start-a",
      "same-start-b",
    ]);
  });
});
