import { describe, expect, it } from "vitest";

import type { AuthUser } from "../src/modules/auth/auth.types";
import {
  createMemoryUserStudyMeetingsRepository,
  createMemoryUserStudyMeetingsState,
} from "../src/modules/me/study-meetings.repository";
import { createUserStudyMeetingsService } from "../src/modules/me/study-meetings.service";

const NOW = new Date("2026-07-20T20:30:00.000Z");

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "student-1",
  fullName: "Aluno Teste",
  email: "aluno@example.com",
  role: "student",
  status: "active",
  mustChangePassword: false,
  permissions: [],
  ...overrides,
});

const createService = () => {
  const state = createMemoryUserStudyMeetingsState({
    users: [
      { id: "student-1", groupName: "Emmanuel", groupSlug: "emmanuel" },
      { id: "teacher-1", groupName: "Emmanuel", groupSlug: "emmanuel" },
      { id: "student-empty", groupName: null, groupSlug: null },
      { id: "student-inactive", groupName: "Grupo Inativo", groupSlug: "grupo-inativo" },
      { id: "student-invalid", groupName: "Fantasma", groupSlug: "fantasma" },
    ],
    groups: [
      {
        id: "emmanuel",
        name: "Emmanuel",
        status: "active",
        meetUrl: "https://meet.google.com/emmanuel-real",
      },
      {
        id: "grupo-inativo",
        name: "Grupo Inativo",
        status: "inactive",
        meetUrl: "https://meet.google.com/inativo",
      },
    ],
    meetings: [
      {
        id: "ongoing",
        groupId: "emmanuel",
        title: "Encontro em andamento",
        description: "Descricao",
        startsAt: "2026-07-20T20:00:00.000Z",
        endsAt: "2026-07-20T21:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "starts-now",
        groupId: "emmanuel",
        title: "Começa agora",
        description: null,
        startsAt: NOW.toISOString(),
        endsAt: "2026-07-20T21:30:00.000Z",
        canceledAt: null,
      },
      {
        id: "future",
        groupId: "emmanuel",
        title: "Encontro futuro",
        description: null,
        startsAt: "2026-07-21T20:00:00.000Z",
        endsAt: "2026-07-21T21:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "ended",
        groupId: "emmanuel",
        title: "Encerrado",
        description: null,
        startsAt: "2026-07-19T20:00:00.000Z",
        endsAt: "2026-07-19T21:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "canceled",
        groupId: "emmanuel",
        title: "Cancelado",
        description: null,
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
        canceledAt: "2026-07-20T10:00:00.000Z",
      },
      {
        id: "inactive-group-meeting",
        groupId: "grupo-inativo",
        title: "Inativo",
        description: null,
        startsAt: "2026-07-21T20:00:00.000Z",
        endsAt: "2026-07-21T21:00:00.000Z",
        canceledAt: null,
      },
    ],
  });

  return createUserStudyMeetingsService({
    repository: createMemoryUserStudyMeetingsRepository(state),
    nowProvider: () => new Date(NOW),
  });
};

describe("user study meetings service", () => {
  it("rejeita usuario ausente e papel nao autorizado", async () => {
    const service = createService();

    await expect(service.listUpcomingMeetings(undefined, { limit: 3 })).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      statusCode: 401,
    });
    await expect(
      service.listUpcomingMeetings(makeUser({ role: "admin" }), { limit: 3 }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("retorna encontros atuais e futuros com status derivado e meetUrl autorizado", async () => {
    const service = createService();
    const result = await service.listUpcomingMeetings(makeUser(), { limit: 3 });

    expect(result.group).toEqual({
      id: "emmanuel",
      name: "Emmanuel",
      status: "active",
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "ongoing",
        status: "ongoing",
        meetUrl: "https://meet.google.com/emmanuel-real",
      }),
      expect.objectContaining({
        id: "starts-now",
        status: "ongoing",
        meetUrl: "https://meet.google.com/emmanuel-real",
      }),
      expect.objectContaining({
        id: "future",
        status: "scheduled",
        meetUrl: "https://meet.google.com/emmanuel-real",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("Cancelado");
    expect(JSON.stringify(result)).not.toContain("Encerrado");
  });

  it("deriva ongoing para encontro começando exatamente agora", async () => {
    const service = createService();
    const result = await service.listUpcomingMeetings(makeUser(), { limit: 3 });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "ongoing",
        status: "ongoing",
      }),
      expect.objectContaining({
        id: "starts-now",
        status: "ongoing",
      }),
      expect.objectContaining({
        id: "future",
        status: "scheduled",
      }),
    ]);
  });

  it("autoriza professor vinculado ao proprio grupo", async () => {
    const service = createService();
    const result = await service.listUpcomingMeetings(
      makeUser({ id: "teacher-1", role: "teacher" }),
      { limit: 1 },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("ongoing");
  });

  it("retorna sucesso vazio para usuario sem grupo ou vinculo invalido", async () => {
    const service = createService();

    await expect(
      service.listUpcomingMeetings(makeUser({ id: "student-empty" }), { limit: 3 }),
    ).resolves.toEqual({ group: null, items: [], limit: 3 });
    await expect(
      service.listUpcomingMeetings(makeUser({ id: "student-invalid" }), { limit: 3 }),
    ).resolves.toEqual({ group: null, items: [], limit: 3 });
  });

  it("retorna grupo inativo sem itens e sem expor meetUrl", async () => {
    const service = createService();
    const result = await service.listUpcomingMeetings(
      makeUser({ id: "student-inactive" }),
      { limit: 3 },
    );

    expect(result).toEqual({
      group: {
        id: "grupo-inativo",
        name: "Grupo Inativo",
        status: "inactive",
      },
      items: [],
      limit: 3,
    });
    expect(JSON.stringify(result)).not.toContain("meet.google.com/inativo");
  });
});
