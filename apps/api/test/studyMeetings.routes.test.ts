import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import {
  createMemoryStudyMeetingGroupsRepository,
  createMemoryStudyMeetingsAuditRepository,
  createMemoryStudyMeetingsRepository,
  createMemoryStudyMeetingsState,
  createMemoryStudyMeetingsTransactionRunner,
  type MemoryStudyMeetingsState,
} from "../src/modules/study-meetings/study-meetings.repository";
import {
  getMemoryStudyMeetingsAuditLogsForTesting,
  resetStudyMeetingsAdminServiceDependenciesForTesting,
  setStudyMeetingsAdminServiceDependenciesForTesting,
} from "../src/modules/study-meetings/study-meetings.service";
import { resetAuthRateLimitStore } from "../src/security/auth-rate-limit";

const NOW = new Date("2026-07-20T12:00:00.000Z");

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const buildState = () =>
  createMemoryStudyMeetingsState({
    groups: [
      { id: "emmanuel", name: "Emmanuel", status: "active" },
      { id: "a-caminho-da-luz", name: "A Caminho da Luz", status: "active" },
      { id: "grupo-inativo", name: "Grupo Inativo", status: "inactive" },
    ],
    meetings: [
      {
        id: "meeting-future",
        groupId: "emmanuel",
        title: "Encontro futuro",
        description: "Descricao futura",
        startsAt: "2026-07-21T20:00:00.000Z",
        endsAt: "2026-07-21T21:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "meeting-ended",
        groupId: "emmanuel",
        title: "Encontro encerrado",
        description: null,
        startsAt: "2026-07-19T20:00:00.000Z",
        endsAt: "2026-07-19T21:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "meeting-canceled",
        groupId: "emmanuel",
        title: "Encontro cancelado",
        description: "Cancelado",
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
        canceledAt: "2026-07-18T10:00:00.000Z",
        cancellationReason: "Recesso",
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-18T10:00:00.000Z",
      },
      {
        id: "meeting-other-group",
        groupId: "a-caminho-da-luz",
        title: "Outro grupo",
        description: null,
        startsAt: "2026-07-23T20:00:00.000Z",
        endsAt: "2026-07-23T21:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "meeting-inactive-group",
        groupId: "grupo-inativo",
        title: "Grupo inativo",
        description: null,
        startsAt: "2026-07-24T20:00:00.000Z",
        endsAt: "2026-07-24T21:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
    ],
  });

const useState = (state: MemoryStudyMeetingsState) => {
  const nowProvider = () => new Date(NOW);

  setStudyMeetingsAdminServiceDependenciesForTesting({
    readContext: {
      meetingsRepository: createMemoryStudyMeetingsRepository({ state, nowProvider }),
      groupsRepository: createMemoryStudyMeetingGroupsRepository({ state }),
      auditRepository: createMemoryStudyMeetingsAuditRepository(state),
    },
    transactionRunner: createMemoryStudyMeetingsTransactionRunner(state, { nowProvider }),
    nowProvider,
    memoryState: state,
  });
};

describe("admin study meetings routes", () => {
  let state: MemoryStudyMeetingsState;
  let adminToken: string;

  beforeEach(async () => {
    resetAuthStore();
    resetAuthRateLimitStore();
    resetStudyMeetingsAdminServiceDependenciesForTesting();
    state = buildState();
    useState(state);
    adminToken = (await loginAs("admin.demo@example.com", "AdminDemo@123")) ?? "";
  });

  it("lista encontros com paginacao, ordenacao, cancelados opcionais e presenter seguro", async () => {
    const response = await request(app)
      .get("/api/admin/groups/emmanuel/meetings")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ includeCanceled: "true", sortOrder: "desc", pageSize: "2" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Encontros listados com sucesso.",
      meta: {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      },
    });
    expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
      "meeting-canceled",
      "meeting-future",
    ]);
    expect(Object.keys(response.body.data.items[0]).sort()).toEqual([
      "canceledAt",
      "cancellationReason",
      "createdAt",
      "description",
      "endsAt",
      "groupId",
      "id",
      "startsAt",
      "title",
      "updatedAt",
    ]);
    expect(JSON.stringify(response.body)).not.toContain("meetUrl");
    expect(JSON.stringify(response.body)).not.toContain("auditLogs");
    expect(getMemoryStudyMeetingsAuditLogsForTesting()).toHaveLength(0);
  });

  it("consulta encontro existente, permite cancelado e nao revela outro grupo", async () => {
    const response = await request(app)
      .get("/api/admin/groups/emmanuel/meetings/meeting-canceled")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "meeting-canceled",
      startsAt: "2026-07-22T20:00:00.000Z",
      canceledAt: "2026-07-18T10:00:00.000Z",
    });
    expect(JSON.stringify(response.body)).not.toContain("meetUrl");

    const otherGroup = await request(app)
      .get("/api/admin/groups/emmanuel/meetings/meeting-other-group")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(otherGroup.status).toBe(404);
    expect(otherGroup.body.error.code).toBe("STUDY_MEETING_NOT_FOUND");
  });

  it("cria, atualiza e cancela encontro por rotas administrativas com auditoria", async () => {
    const createResponse = await request(app)
      .post("/api/admin/groups/emmanuel/meetings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "  Novo encontro  ",
        description: "   ",
        startsAt: "2026-07-25T17:00:00-03:00",
        endsAt: "2026-07-25T21:00:00Z",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toMatchObject({
      groupId: "emmanuel",
      title: "Novo encontro",
      description: null,
      startsAt: "2026-07-25T20:00:00.000Z",
      endsAt: "2026-07-25T21:00:00.000Z",
      canceledAt: null,
    });

    const updateResponse = await request(app)
      .patch("/api/admin/groups/emmanuel/meetings/meeting-future")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Encontro revisado", description: null });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toMatchObject({
      id: "meeting-future",
      title: "Encontro revisado",
      description: null,
    });

    const cancelResponse = await request(app)
      .post("/api/admin/groups/emmanuel/meetings/meeting-future/cancel")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cancellationReason: "  Pausa administrativa  " });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.data).toMatchObject({
      id: "meeting-future",
      canceledAt: NOW.toISOString(),
      cancellationReason: "Pausa administrativa",
    });
    expect(getMemoryStudyMeetingsAuditLogsForTesting().map((entry) => entry.action)).toEqual([
      "Encontro cancelado por admin",
      "Encontro atualizado por admin",
      "Encontro criado por admin",
    ]);
    expect(JSON.stringify(cancelResponse.body)).not.toContain("meetUrl");
  });

  it("retorna erros HTTP esperados para validacao e regras do service", async () => {
    const invalidQuery = await request(app)
      .get("/api/admin/groups/emmanuel/meetings?search=aula")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(invalidQuery.status).toBe(400);
    expect(invalidQuery.body.error.code).toBe("INVALID_STUDY_MEETING_LIST_INPUT");

    const invalidBody = await request(app)
      .post("/api/admin/groups/emmanuel/meetings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Sem timezone",
        startsAt: "2026-07-25T20:00:00",
        endsAt: "2026-07-25T21:00:00Z",
      });
    expect(invalidBody.status).toBe(400);
    expect(invalidBody.body.error.code).toBe("INVALID_STUDY_MEETING_INPUT");

    const inactiveGroup = await request(app)
      .post("/api/admin/groups/grupo-inativo/meetings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Grupo inativo",
        startsAt: "2026-07-25T20:00:00Z",
        endsAt: "2026-07-25T21:00:00Z",
      });
    expect(inactiveGroup.status).toBe(409);
    expect(inactiveGroup.body.error.code).toBe("STUDY_GROUP_INACTIVE");

    const immutableField = await request(app)
      .patch("/api/admin/groups/emmanuel/meetings/meeting-future")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ groupId: "outro" });
    expect(immutableField.status).toBe(400);
    expect(immutableField.body.error.code).toBe("INVALID_STUDY_MEETING_UPDATE_INPUT");
  });
});
