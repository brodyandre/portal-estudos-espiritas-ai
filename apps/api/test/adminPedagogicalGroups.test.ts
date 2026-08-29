import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { createMemoryAuthRepository } from "../src/modules/auth/auth.repository";
import {
  resetAuthStore,
  setAuthRepositoryForTesting,
} from "../src/modules/auth/auth.service";
import {
  createMemoryAdminUserTeacherGroupsRepository,
  getMemoryAdminTeacherGroupAuditEntries,
  getMemoryAdminTeacherGroupsForTesting,
} from "../src/modules/admin/users/teacher-groups.repository";
import {
  resetAdminUserTeacherGroupsRepositoryForTesting,
  setAdminUserTeacherGroupsRepositoryForTesting,
} from "../src/modules/admin/users/teacher-groups.service";
import {
  createMemoryBookAccessRepository,
  createMemoryBookAccessState,
  type MemoryBookAccessGroup,
} from "../src/modules/book-access/book-access.repository";
import {
  resetBookAccessServiceDependenciesForTesting,
  setBookAccessServiceDependenciesForTesting,
} from "../src/modules/book-access/book-access.service";
import { resetAuthRateLimitStore } from "../src/security/auth-rate-limit";

const users = [
  {
    id: "user-admin-demo",
    role: "admin" as const,
    status: "active" as const,
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "user-professor-demo",
    role: "teacher" as const,
    status: "active" as const,
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "user-aluno-demo",
    role: "student" as const,
    status: "active" as const,
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
  },
];

const groups = [
  { name: "Emmanuel", slug: "emmanuel", status: "active" as const },
  { name: "A Caminho da Luz", slug: "a-caminho-da-luz", status: "active" as const },
  { name: "Grupo Inativo", slug: "grupo-inativo", status: "inactive" as const },
  { name: "Sem Livro", slug: "sem-livro", status: "active" as const, knowledgeBook: null },
];

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const activeBookAccessGroup = (id: string, name: string): MemoryBookAccessGroup => ({
  id,
  name,
  status: "active",
  knowledgeBook: {
    id: `book-${id}`,
    slug: id,
    title: name,
    status: "active",
  },
});

const installRepository = (
  memberships: Array<{ userId: string; groupId: string }> = [],
) => {
  const repository = createMemoryAdminUserTeacherGroupsRepository({
    users,
    groups,
    memberships,
  });
  setAdminUserTeacherGroupsRepositoryForTesting(repository);
};

const installBookAccessFromAdminTeacherGroups = () => {
  const state = createMemoryBookAccessState({
    users: [
      { id: "user-aluno-demo", groupSlug: "emmanuel" },
      { id: "user-professor-demo", groupSlug: null },
      { id: "user-admin-demo", groupSlug: null },
    ],
    groups: [
      activeBookAccessGroup("emmanuel", "Emmanuel"),
      activeBookAccessGroup("a-caminho-da-luz", "A Caminho da Luz"),
    ],
    teacherGroupMemberships: getMemoryAdminTeacherGroupsForTesting(),
  });

  setBookAccessServiceDependenciesForTesting({
    repository: createMemoryBookAccessRepository(state),
  });
};

describe("admin pedagogical groups", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAuthRateLimitStore();
    resetBookAccessServiceDependenciesForTesting();
    setAuthRepositoryForTesting(createMemoryAuthRepository());
    installRepository();
  });

  afterEach(() => {
    resetAuthStore();
    resetAdminUserTeacherGroupsRepositoryForTesting();
    resetBookAccessServiceDependenciesForTesting();
  });

  it("exige admin autenticado", async () => {
    const studentToken = await loginAs("aluno.demo@example.com", "AlunoDemo@123");

    const anonymous = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .send({ groupIds: ["emmanuel"] });
    expect(anonymous.status).toBe(401);

    const forbidden = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ groupIds: ["emmanuel"] });
    expect(forbidden.status).toBe(403);
  });

  it("permite escopo explicito para ADMIN sem alterar role", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel", "a-caminho-da-luz"] });

    expect(response.status).toBe(200);
    expect(response.body.data.user.groups.map((group: { slug: string }) => group.slug)).toEqual([
      "a-caminho-da-luz",
      "emmanuel",
    ]);
    expect(getMemoryAdminTeacherGroupAuditEntries()[0]).toEqual(
      expect.objectContaining({
        action: "Escopo pedagogico alterado por admin",
        entity: "User user-admin-demo",
      }),
    );
  });

  it("permite ADMIN revogar todos os grupos, audita e volta a negar BookAccess e Agent", async () => {
    installRepository([
      { userId: "user-admin-demo", groupId: "emmanuel" },
      { userId: "user-admin-demo", groupId: "a-caminho-da-luz" },
    ]);
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: [] });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({
      id: "user-admin-demo",
      groups: [],
    });
    expect(getMemoryAdminTeacherGroupsForTesting().filter((item) => item.userId === "user-admin-demo")).toEqual([]);
    expect(getMemoryAdminTeacherGroupAuditEntries()[0]).toEqual(
      expect.objectContaining({
        action: "Escopo pedagogico alterado por admin",
        entity: "User user-admin-demo",
      }),
    );
    expect(getMemoryAdminTeacherGroupAuditEntries()[0]?.note).toContain("Grupos removidos: emmanuel, a-caminho-da-luz");

    const profile = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.role).toBe("admin");

    installBookAccessFromAdminTeacherGroups();

    const bookAccess = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);
    expect(bookAccess.status).toBe(403);
    expect(bookAccess.body.error.code).toBe("BOOK_ACCESS_FORBIDDEN");

    const agent = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "emmanuel",
        question: "Como estudar com serenidade?",
      });
    expect(agent.status).toBe(403);
    expect(agent.body.error.code).toBe("BOOK_ACCESS_FORBIDDEN");
  });

  it("mantém revogação total de ADMIN idempotente", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const auditCountBefore = getMemoryAdminTeacherGroupAuditEntries().length;

    const response = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: [] });

    expect(response.status).toBe(200);
    expect(response.body.data.user.groups).toEqual([]);
    expect(getMemoryAdminTeacherGroupAuditEntries()).toHaveLength(auditCountBefore);
  });

  it("rejeita revogação total para TEACHER no contrato pedagogical-groups", async () => {
    installRepository([
      { userId: "user-professor-demo", groupId: "emmanuel" },
    ]);
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .put("/api/admin/users/user-professor-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: [] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_TEACHER_GROUPS_INPUT");
    expect(getMemoryAdminTeacherGroupsForTesting()).toContainEqual({
      userId: "user-professor-demo",
      groupId: "emmanuel",
    });
  });

  it("preserva contrato antigo de professores", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel"] });
    expect(response.status).toBe(200);

    const adminOnOldRoute = await request(app)
      .put("/api/admin/users/user-admin-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel"] });
    expect(adminOnOldRoute.status).toBe(409);
    expect(adminOnOldRoute.body.error.code).toBe("ADMIN_USER_TEACHER_GROUPS_TARGET_NOT_TEACHER");
  });

  it("rejeita STUDENT/VISITOR targets e falha fechado em grupos invalidos", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const student = await request(app)
      .put("/api/admin/users/user-aluno-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel"] });
    expect(student.status).toBe(409);
    expect(student.body.error.code).toBe("ADMIN_PEDAGOGICAL_GROUPS_TARGET_NOT_ALLOWED");

    const missing = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["fantasma"] });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("ADMIN_USER_TEACHER_GROUP_NOT_FOUND");

    const inactive = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["grupo-inativo"] });
    expect(inactive.status).toBe(409);
    expect(inactive.body.error.code).toBe("ADMIN_USER_TEACHER_GROUP_INACTIVE");

    const withoutBook = await request(app)
      .put("/api/admin/users/user-admin-demo/pedagogical-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["sem-livro"] });
    expect(withoutBook.status).toBe(503);
    expect(withoutBook.body.error.code).toBe("ADMIN_PEDAGOGICAL_BOOK_ACCESS_UNAVAILABLE");
  });
});
