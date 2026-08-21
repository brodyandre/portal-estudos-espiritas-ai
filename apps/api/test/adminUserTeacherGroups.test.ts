import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAuthStore, setAuthRepositoryForTesting } from "../src/modules/auth/auth.service";
import { createMemoryAuthRepository } from "../src/modules/auth/auth.repository";
import {
  createMemoryAdminUserTeacherGroupsRepository,
  getMemoryAdminTeacherGroupAuditEntries,
} from "../src/modules/admin/users/teacher-groups.repository";
import {
  resetAdminUserTeacherGroupsRepositoryForTesting,
  setAdminUserTeacherGroupsRepositoryForTesting,
} from "../src/modules/admin/users/teacher-groups.service";

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
];

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const installRepository = (
  memberships: Array<{ userId: string; groupId: string }> = [],
) => {
  const repository = createMemoryAdminUserTeacherGroupsRepository({
    users,
    groups,
    memberships,
  });
  setAdminUserTeacherGroupsRepositoryForTesting(repository);
  return repository;
};

describe("admin user teacher groups", () => {
  beforeEach(() => {
    resetAuthStore();
    setAuthRepositoryForTesting(createMemoryAuthRepository());
    installRepository();
  });

  afterEach(() => {
    resetAuthStore();
    resetAdminUserTeacherGroupsRepositoryForTesting();
  });

  it("lista professor sem grupos", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const response = await request(app)
      .get("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      user: {
        id: "user-professor-demo",
        groups: [],
      },
    });
  });

  it("substitui o conjunto com dois grupos e audita a alteração real", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel", "a-caminho-da-luz"] });

    expect(response.status).toBe(200);
    expect(response.body.data.user.groups).toEqual([
      { name: "A Caminho da Luz", slug: "a-caminho-da-luz", status: "active" },
      { name: "Emmanuel", slug: "emmanuel", status: "active" },
    ]);
    expect(getMemoryAdminTeacherGroupAuditEntries()[0]).toEqual(
      expect.objectContaining({
        action: "Grupos de professor alterados por admin",
        entity: "User user-professor-demo",
      }),
    );
  });

  it("remove vínculo existente de forma transacional", async () => {
    installRepository([
      { userId: "user-professor-demo", groupId: "emmanuel" },
      { userId: "user-professor-demo", groupId: "a-caminho-da-luz" },
    ]);
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel"] });

    expect(response.status).toBe(200);
    expect(response.body.data.user.groups).toEqual([
      { name: "Emmanuel", slug: "emmanuel", status: "active" },
    ]);
    expect(getMemoryAdminTeacherGroupAuditEntries()[0]?.note).toContain("a-caminho-da-luz");
  });

  it("rejeita payload duplicado, grupo inexistente, grupo inativo e alvo não professor", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const duplicate = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel", "emmanuel"] });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.code).toBe("INVALID_ADMIN_USER_TEACHER_GROUPS_INPUT");

    const missingGroup = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["grupo-inexistente"] });
    expect(missingGroup.status).toBe(404);
    expect(missingGroup.body.error.code).toBe("ADMIN_USER_TEACHER_GROUP_NOT_FOUND");

    const inactiveGroup = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["grupo-inativo"] });
    expect(inactiveGroup.status).toBe(409);
    expect(inactiveGroup.body.error.code).toBe("ADMIN_USER_TEACHER_GROUP_INACTIVE");

    const studentTarget = await request(app)
      .put("/api/admin/users/user-aluno-demo/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupIds: ["emmanuel"] });
    expect(studentTarget.status).toBe(409);
    expect(studentTarget.body.error.code).toBe("ADMIN_USER_TEACHER_GROUPS_TARGET_NOT_TEACHER");
  });

  it("exige admin autenticado", async () => {
    const studentToken = await loginAs("aluno.demo@example.com", "AlunoDemo@123");

    const anonymous = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .send({ groupIds: ["emmanuel"] });
    expect(anonymous.status).toBe(401);

    const forbidden = await request(app)
      .put("/api/admin/users/user-professor-demo/groups")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ groupIds: ["emmanuel"] });
    expect(forbidden.status).toBe(403);
  });
});
