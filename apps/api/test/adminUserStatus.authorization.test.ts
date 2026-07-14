import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAdminUsersAuthRepositoryForTesting } from "../src/modules/admin/users/service";
import { createMemoryAuthRepository } from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

describe("admin user status authorization", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  it("rejeita requisicao sem autenticacao", async () => {
    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .send({ status: "inactive" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejeita aluno autenticado", async () => {
    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");

    const response = await request(app)
      .patch("/api/admin/users/user-professor-demo/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("rejeita professor autenticado", async () => {
    const token = await loginAs("professor.demo@example.com", "ProfessorDemo@123");

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("permite admin autenticado", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      user: {
        id: "user-aluno-demo",
        status: "inactive",
      },
      revokedSessions: 0,
    });
  });

  it("bloqueia admin que precisa trocar senha antes do service", async () => {
    const repository = createMemoryAuthRepository();
    await repository.resetPasswordByAdmin({
      userId: "user-admin-demo",
      passwordHash: bcrypt.hashSync("AdminDemo@123", 10),
      temporaryPasswordGeneratedAt: "2026-07-14T10:00:00.000Z",
      passwordChangedAt: "2026-07-14T10:00:00.000Z",
      actorName: "Admin Demonstrativo",
      actorRole: "admin",
    });
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });
});
