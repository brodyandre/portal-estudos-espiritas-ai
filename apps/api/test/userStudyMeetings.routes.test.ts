import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import {
  createMemoryUserStudyMeetingsRepository,
  createMemoryUserStudyMeetingsState,
} from "../src/modules/me/study-meetings.repository";
import {
  resetUserStudyMeetingsServiceDependenciesForTesting,
  setUserStudyMeetingsServiceDependenciesForTesting,
} from "../src/modules/me/study-meetings.service";

const NOW = new Date("2026-07-20T20:30:00.000Z");

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const installState = (options: {
  studentGroupSlug?: string | null;
  teacherGroupSlug?: string | null;
  groupStatus?: "active" | "inactive";
} = {}) => {
  const studentGroupSlug = options.studentGroupSlug === undefined
    ? "emmanuel"
    : options.studentGroupSlug;
  const teacherGroupSlug = options.teacherGroupSlug === undefined
    ? "emmanuel"
    : options.teacherGroupSlug;
  const state = createMemoryUserStudyMeetingsState({
    users: [
      {
        id: "user-aluno-demo",
        groupName: studentGroupSlug ? "Emmanuel" : null,
        groupSlug: studentGroupSlug,
      },
      {
        id: "user-professor-demo",
        groupName: teacherGroupSlug ? "Emmanuel" : null,
        groupSlug: teacherGroupSlug,
      },
      {
        id: "user-admin-demo",
        groupName: null,
        groupSlug: null,
      },
    ],
    groups: [
      {
        id: "emmanuel",
        name: "Emmanuel",
        status: options.groupStatus ?? "active",
        meetUrl: "https://meet.google.com/emmanuel-real",
      },
      {
        id: "a-caminho-da-luz",
        name: "A Caminho da Luz",
        status: "active",
        meetUrl: "https://meet.google.com/caminho-real",
      },
    ],
    meetings: [
      {
        id: "meeting-ongoing",
        groupId: "emmanuel",
        title: "Encontro em andamento",
        description: "Agora",
        startsAt: "2026-07-20T20:00:00.000Z",
        endsAt: "2026-07-20T21:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "meeting-future-1",
        groupId: "emmanuel",
        title: "Encontro futuro 1",
        description: null,
        startsAt: "2026-07-21T20:00:00.000Z",
        endsAt: "2026-07-21T21:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "meeting-future-2",
        groupId: "emmanuel",
        title: "Encontro futuro 2",
        description: null,
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "meeting-ended",
        groupId: "emmanuel",
        title: "Encontro encerrado",
        description: null,
        startsAt: "2026-07-19T20:00:00.000Z",
        endsAt: "2026-07-19T21:00:00.000Z",
        canceledAt: null,
      },
      {
        id: "meeting-canceled",
        groupId: "emmanuel",
        title: "Encontro cancelado",
        description: null,
        startsAt: "2026-07-23T20:00:00.000Z",
        endsAt: "2026-07-23T21:00:00.000Z",
        canceledAt: "2026-07-20T10:00:00.000Z",
      },
      {
        id: "meeting-other-group",
        groupId: "a-caminho-da-luz",
        title: "Outro grupo",
        description: null,
        startsAt: "2026-07-20T19:00:00.000Z",
        endsAt: "2026-07-20T22:00:00.000Z",
        canceledAt: null,
      },
    ],
  });

  setUserStudyMeetingsServiceDependenciesForTesting({
    repository: createMemoryUserStudyMeetingsRepository(state),
    nowProvider: () => new Date(NOW),
  });
};

describe("GET /api/me/study-meetings/upcoming", () => {
  beforeEach(() => {
    resetAuthStore();
    resetUserStudyMeetingsServiceDependenciesForTesting();
    installState();
  });

  it("rejeita usuario nao autenticado", async () => {
    const response = await request(app).get("/api/me/study-meetings/upcoming");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("permite aluno e retorna envelope com limite padrao, status e meetUrl do proprio grupo", async () => {
    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get("/api/me/study-meetings/upcoming")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Encontros do seu grupo carregados com sucesso.",
      data: {
        group: {
          id: "emmanuel",
          name: "Emmanuel",
          status: "active",
        },
      },
      meta: {
        limit: 3,
      },
    });
    expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
      "meeting-ongoing",
      "meeting-future-1",
      "meeting-future-2",
    ]);
    expect(response.body.data.items[0]).toMatchObject({
      status: "ongoing",
      meetUrl: "https://meet.google.com/emmanuel-real",
    });
    expect(response.body.data.items[1]).toMatchObject({
      status: "scheduled",
    });
    expect(JSON.stringify(response.body)).not.toContain("caminho-real");
    expect(JSON.stringify(response.body)).not.toContain("Encontro cancelado");
    expect(JSON.stringify(response.body)).not.toContain("Encontro encerrado");
  });

  it("permite professor vinculado ao grupo", async () => {
    const token = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const response = await request(app)
      .get("/api/me/study-meetings/upcoming?limit=1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.meta.limit).toBe(1);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe("meeting-ongoing");
  });

  it("rejeita papel nao autorizado sem vazar link", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const response = await request(app)
      .get("/api/me/study-meetings/upcoming")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(JSON.stringify(response.body)).not.toContain("meet.google.com");
  });

  it("retorna sucesso vazio para usuario sem grupo", async () => {
    installState({ studentGroupSlug: null });
    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get("/api/me/study-meetings/upcoming")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      group: null,
      items: [],
    });
    expect(JSON.stringify(response.body)).not.toContain("meet.google.com");
  });

  it("retorna grupo inativo sem itens e sem meetUrl", async () => {
    installState({ groupStatus: "inactive" });
    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get("/api/me/study-meetings/upcoming")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      group: {
        id: "emmanuel",
        name: "Emmanuel",
        status: "inactive",
      },
      items: [],
    });
    expect(JSON.stringify(response.body)).not.toContain("meet.google.com");
  });

  it("rejeita tentativa de escolher grupo por query inesperada", async () => {
    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get("/api/me/study-meetings/upcoming?groupId=a-caminho-da-luz")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_USER_STUDY_MEETINGS_QUERY");
    expect(JSON.stringify(response.body)).not.toContain("caminho-real");
  });

  it.each([
    ["limite abaixo do minimo", "?limit=0"],
    ["limite acima do maximo", "?limit=11"],
    ["decimal", "?limit=1.5"],
    ["string invalida", "?limit=abc"],
    ["parametro repetido", "?limit=1&limit=2"],
  ])("rejeita query invalida: %s", async (_caseName, queryString) => {
    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get(`/api/me/study-meetings/upcoming${queryString}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_USER_STUDY_MEETINGS_QUERY");
  });
});
