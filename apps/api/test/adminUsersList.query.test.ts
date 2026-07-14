import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import { createMemoryAuthRepository, type AuthRepository } from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";

const DEFAULT_USERS = {
  admin: {
    id: "user-admin-demo",
    name: "Admin Demonstrativo",
    createdAt: "2026-07-10T09:00:00.000Z",
  },
  student: {
    id: "user-aluno-demo",
    name: "Aluno Demonstrativo",
    createdAt: "2026-07-10T09:10:00.000Z",
  },
  inactiveStudent: {
    id: "user-aluno-inativo-demo",
    name: "Aluno Inativo Demonstrativo",
    createdAt: "2026-07-10T09:15:00.000Z",
  },
  teacher: {
    id: "user-professor-demo",
    name: "Professor Demonstrativo",
    createdAt: "2026-07-10T09:05:00.000Z",
  },
} as const;

type SeededQueryUserKey = "marina" | "ana" | "joaoA" | "joaoB";

type SeededQueryUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });

  return response.body.data.token as string;
};

const getAdminUsers = (token: string, query: Record<string, string> = {}) =>
  request(app).get("/api/admin/users").query(query).set("Authorization", `Bearer ${token}`);

const seedExtraUsers = async (repository: AuthRepository) => {
  const timestampQueue = [
    Date.parse("2026-07-14T10:00:00.000Z"),
    Date.parse("2026-07-14T10:00:00.001Z"),
    Date.parse("2026-07-14T10:00:01.000Z"),
    Date.parse("2026-07-14T10:00:01.001Z"),
    Date.parse("2026-07-14T10:00:02.000Z"),
    Date.parse("2026-07-14T10:00:02.001Z"),
    Date.parse("2026-07-14T10:00:02.000Z"),
    Date.parse("2026-07-14T10:00:02.002Z"),
  ];
  const dateNowMock = vi.spyOn(Date, "now").mockImplementation(() => {
    const nextTimestamp = timestampQueue.shift();

    if (nextTimestamp === undefined) {
      throw new Error("Date.now called more times than expected while seeding admin users.");
    }

    return nextTimestamp;
  });

  try {
    const fixtures: Record<
      SeededQueryUserKey,
      {
        enrollmentId: string;
        fullName: string;
        email: string;
        groupName: string | null;
        groupSlug: string | null;
        createdAt: string;
      }
    > = {
      marina: {
        enrollmentId: "enrollment-marina",
        fullName: "Marina Singular",
        email: "contato.unico@example.com",
        groupName: "Emmanuel",
        groupSlug: "emmanuel",
        createdAt: "2026-07-14T10:00:00.000Z",
      },
      ana: {
        enrollmentId: "enrollment-ana",
        fullName: "Ana Clara",
        email: "ana.clara@example.com",
        groupName: "A Caminho da Luz",
        groupSlug: "a-caminho-da-luz",
        createdAt: "2026-07-14T10:00:01.000Z",
      },
      joaoA: {
        enrollmentId: "enrollment-joao-a",
        fullName: "Joao Empate",
        email: "joao.um@example.com",
        groupName: "Grupo Parcial",
        groupSlug: null,
        createdAt: "2026-07-14T10:00:02.000Z",
      },
      joaoB: {
        enrollmentId: "enrollment-joao-b",
        fullName: "Joao Empate",
        email: "joao.dois@example.com",
        groupName: null,
        groupSlug: null,
        createdAt: "2026-07-14T10:00:02.000Z",
      },
    };
    const seededUsers = {} as Record<SeededQueryUserKey, SeededQueryUser>;

    for (const [key, fixture] of Object.entries(fixtures) as [SeededQueryUserKey, typeof fixtures[SeededQueryUserKey]][]) {
      const result = await repository.prepareInvitedEnrollmentUser({
        enrollmentId: fixture.enrollmentId,
        fullName: fixture.fullName,
        email: fixture.email,
        whatsapp: "11999999999",
        groupName: fixture.groupName,
        groupSlug: fixture.groupSlug,
        actorName: "Admin Demonstrativo",
        actorRole: "admin",
        passwordHash: "hash",
      });

      seededUsers[key] = {
        id: result.user.id,
        name: fixture.fullName,
        email: fixture.email,
        createdAt: fixture.createdAt,
      };
    }

    return seededUsers;
  } finally {
    dateNowMock.mockRestore();
  }
};

type AdminUsersListItem = {
  id: string;
  name: string;
  role: string;
  status: string;
  activationStatus: string;
  createdAt: string;
  group: { slug: string } | null;
  email?: string;
};

type AdminUsersResponse = {
  body: {
    data: {
      items: AdminUsersListItem[];
    };
  };
};

const getItems = (response: AdminUsersResponse) => response.body.data.items;

const expectReturnedIds = (response: AdminUsersResponse, expectedIds: string[]) => {
  expect(getItems(response).map((item) => item.id)).toEqual(expectedIds);
};

const expectRepeatedPrimaryValue = (
  response: AdminUsersResponse,
  sortBy: "name" | "createdAt" | "role" | "status",
) => {
  const values = getItems(response).map((item) => item[sortBy]);
  expect(new Set(values).size).toBeLessThan(values.length);
};

const buildSortExpectations = (seededUsers: Record<SeededQueryUserKey, SeededQueryUser>) => [
  {
    sortBy: "name",
    sortOrder: "asc",
    expectedIds: [
      DEFAULT_USERS.admin.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.inactiveStudent.id,
      seededUsers.ana.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
      seededUsers.marina.id,
      DEFAULT_USERS.teacher.id,
    ],
  },
  {
    sortBy: "name",
    sortOrder: "desc",
    expectedIds: [
      DEFAULT_USERS.teacher.id,
      seededUsers.marina.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
      seededUsers.ana.id,
      DEFAULT_USERS.inactiveStudent.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.admin.id,
    ],
  },
  {
    sortBy: "createdAt",
    sortOrder: "asc",
    expectedIds: [
      DEFAULT_USERS.admin.id,
      DEFAULT_USERS.teacher.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.inactiveStudent.id,
      seededUsers.marina.id,
      seededUsers.ana.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
    ],
  },
  {
    sortBy: "createdAt",
    sortOrder: "desc",
    expectedIds: [
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
      seededUsers.ana.id,
      seededUsers.marina.id,
      DEFAULT_USERS.inactiveStudent.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.teacher.id,
      DEFAULT_USERS.admin.id,
    ],
  },
  {
    sortBy: "role",
    sortOrder: "asc",
    expectedIds: [
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.inactiveStudent.id,
      seededUsers.marina.id,
      seededUsers.ana.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
      DEFAULT_USERS.teacher.id,
      DEFAULT_USERS.admin.id,
    ],
  },
  {
    sortBy: "role",
    sortOrder: "desc",
    expectedIds: [
      DEFAULT_USERS.admin.id,
      DEFAULT_USERS.teacher.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.inactiveStudent.id,
      seededUsers.marina.id,
      seededUsers.ana.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
    ],
  },
  {
    sortBy: "status",
    sortOrder: "asc",
    expectedIds: [
      DEFAULT_USERS.admin.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.teacher.id,
      seededUsers.marina.id,
      seededUsers.ana.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
      DEFAULT_USERS.inactiveStudent.id,
    ],
  },
  {
    sortBy: "status",
    sortOrder: "desc",
    expectedIds: [
      DEFAULT_USERS.inactiveStudent.id,
      DEFAULT_USERS.admin.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.teacher.id,
      seededUsers.marina.id,
      seededUsers.ana.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
    ],
  },
] as const;

describe("admin users list query", () => {
  let repository: AuthRepository;
  let token: string;
  let seededUsers: Record<SeededQueryUserKey, SeededQueryUser>;

  beforeEach(async () => {
    resetAuthStore();
    repository = createMemoryAuthRepository();
    seededUsers = await seedExtraUsers(repository);
    token = await loginAsAdmin();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aplica defaults de paginacao e ordenacao", async () => {
    const response = await getAdminUsers(token);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 1,
      pageSize: 10,
      total: 8,
      totalPages: 1,
    });
    expect(response.body.data.items[0]).toEqual(
      expect.objectContaining({ name: "Joao Empate" }),
    );
  });

  it("pesquisa por nome", async () => {
    const response = await getAdminUsers(token, { search: "Singular" });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].name).toBe("Marina Singular");
    expect(response.body.data.items[0].id).toBe(seededUsers.marina.id);
  });

  it("pesquisa por e-mail sem retornar e-mail completo", async () => {
    const response = await getAdminUsers(token, { search: seededUsers.ana.email });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].name).toBe("Ana Clara");
    expect(response.body.data.items[0].email).toBeUndefined();
  });

  it("pesquisa de forma case-insensitive", async () => {
    const response = await getAdminUsers(token, { search: "sInGuLaR" });

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].name).toBe("Marina Singular");
  });

  it("filtra por papel", async () => {
    const response = await getAdminUsers(token, { role: "teacher" });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].role).toBe("teacher");
  });

  it("filtra por status", async () => {
    const response = await getAdminUsers(token, { status: "inactive" });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].status).toBe("inactive");
  });

  it("filtra por contas ativadas", async () => {
    const response = await getAdminUsers(token, { activationStatus: "activated" });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(4);
    expect(getItems(response).every((item) => item.activationStatus === "activated")).toBe(true);
    expect(getItems(response).some((item) => item.activationStatus === "not_activated")).toBe(false);
    expect(new Set(getItems(response).map((item) => item.activationStatus))).toEqual(
      new Set(["activated"]),
    );
  });

  it("filtra por contas nao ativadas", async () => {
    const response = await getAdminUsers(token, { activationStatus: "not_activated" });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(4);
    expect(getItems(response).every((item) => item.activationStatus === "not_activated")).toBe(true);
    expect(getItems(response).some((item) => item.activationStatus === "activated")).toBe(false);
    expect(new Set(getItems(response).map((item) => item.activationStatus))).toEqual(
      new Set(["not_activated"]),
    );
  });

  it("filtra por grupo normalizado", async () => {
    const response = await getAdminUsers(token, { group: " EMMANUEL " });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].group.slug).toBe("emmanuel");
  });

  it("combina filtros", async () => {
    const response = await getAdminUsers(token, {
      role: "student",
      activationStatus: "not_activated",
      group: "emmanuel",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].name).toBe("Marina Singular");
  });

  it("pagina resultados", async () => {
    const response = await getAdminUsers(token, { page: "2", pageSize: "2", sortBy: "name", sortOrder: "asc" });

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 2,
      pageSize: 2,
      total: 8,
      totalPages: 4,
    });
    expect(response.body.data.items).toHaveLength(2);
  });

  it("retorna pagina vazia quando offset excede o total", async () => {
    const response = await getAdminUsers(token, { page: "99" });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.meta.total).toBe(8);
  });

  it.each([
    ["query desconhecida", { unknown: "1" }],
    ["pagina zero", { page: "0" }],
    ["pagina negativa", { page: "-1" }],
    ["pagina nao numerica", { page: "abc" }],
    ["pageSize fora do limite", { pageSize: "51" }],
    ["role invalido", { role: "owner" }],
    ["status invalido", { status: "blocked" }],
    ["activationStatus invalido", { activationStatus: "enabled" }],
    ["sortBy invalido", { sortBy: "email" }],
    ["sortOrder invalido", { sortOrder: "up" }],
  ])("rejeita %s", async (_label, query) => {
    const response = await getAdminUsers(token, query);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_LIST_QUERY");
  });

  it("rejeita parametro repetido", async () => {
    const response = await request(app)
      .get("/api/admin/users?page=1&page=2")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_LIST_QUERY");
  });

  it("rejeita array de query", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .query({ role: ["admin", "student"] })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_LIST_QUERY");
  });

  it.each([
    ["name", "asc"],
    ["name", "desc"],
    ["createdAt", "asc"],
    ["createdAt", "desc"],
    ["role", "asc"],
    ["role", "desc"],
    ["status", "asc"],
    ["status", "desc"],
  ])("ordena por %s %s", async (sortBy, sortOrder) => {
    const expectation = buildSortExpectations(seededUsers).find(
      (entry) => entry.sortBy === sortBy && entry.sortOrder === sortOrder,
    );

    if (!expectation) {
      throw new Error(`Sort expectation missing for ${sortBy} ${sortOrder}.`);
    }

    const response = await getAdminUsers(token, { sortBy, sortOrder });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(8);
    expectRepeatedPrimaryValue(response, sortBy);
    expectReturnedIds(response, expectation.expectedIds);
  });

  it("mantem estabilidade entre leituras", async () => {
    const first = await getAdminUsers(token, { sortBy: "createdAt", sortOrder: "asc" });
    const second = await getAdminUsers(token, { sortBy: "createdAt", sortOrder: "asc" });

    expectReturnedIds(first, [
      DEFAULT_USERS.admin.id,
      DEFAULT_USERS.teacher.id,
      DEFAULT_USERS.student.id,
      DEFAULT_USERS.inactiveStudent.id,
      seededUsers.marina.id,
      seededUsers.ana.id,
      seededUsers.joaoA.id,
      seededUsers.joaoB.id,
    ]);
    expect(second.body.data.items.map((item: { id: string; createdAt: string }) => [item.id, item.createdAt]))
      .toEqual(first.body.data.items.map((item: { id: string; createdAt: string }) => [item.id, item.createdAt]));
  });
});
