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
} from "../src/modules/admin/users/teacher-groups.repository";
import {
  resetAdminUserTeacherGroupsRepositoryForTesting,
  setAdminUserTeacherGroupsRepositoryForTesting,
} from "../src/modules/admin/users/teacher-groups.service";
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

describe("admin pedagogical groups", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAuthRateLimitStore();
    setAuthRepositoryForTesting(createMemoryAuthRepository());
    installRepository();
  });

  afterEach(() => {
    resetAuthStore();
    resetAdminUserTeacherGroupsRepositoryForTesting();
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
