import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { createMemoryAuthRepository, getMemoryAuthAuditLogs } from "../src/modules/auth/auth.repository";
import { resetAuthStore, setAuthRepositoryForTesting } from "../src/modules/auth/auth.service";
import { resetEnrollmentStore } from "../src/modules/enrollments/enrollments.service";

const loginAs = async (email: string, password: string) => {
  return request(app).post("/api/auth/login").send({ email, password });
};

const loginAsAdmin = async () => {
  const response = await loginAs("admin.demo@example.com", "AdminDemo@123");
  return response.body.data.token as string;
};

describe("admin password reset endpoint", () => {
  beforeEach(() => {
    resetAuthStore();
    resetEnrollmentStore();
  });

  it("admin redefine a senha de um usuario existente", async () => {
    const adminToken = await loginAsAdmin();
    const previousLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const previousToken = previousLogin.body.data.token as string;

    const response = await request(app)
      .post("/api/admin/users/user-aluno-demo/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        id: "user-aluno-demo",
        fullName: "Aluno Demonstrativo",
        email: "aluno.demo@example.com",
        role: "student",
        status: "active",
        mustChangePassword: true,
        temporaryPasswordGeneratedAt: expect.any(String),
      }),
    );
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.passwordHash).toBeUndefined();
    expect(response.body.data.temporaryPassword).toEqual(expect.any(String));
    expect(response.body.data.temporaryPassword).not.toBe("AlunoDemo@123");

    const staleTokenResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${previousToken}`);

    expect(staleTokenResponse.status).toBe(401);
    expect(staleTokenResponse.body.error.code).toBe("AUTH_REQUIRED");

    const oldPasswordLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    expect(oldPasswordLogin.status).toBe(401);
    expect(oldPasswordLogin.body.error.code).toBe("INVALID_CREDENTIALS");

    const loginWithNewPassword = await loginAs(
      "aluno.demo@example.com",
      response.body.data.temporaryPassword as string,
    );

    expect(loginWithNewPassword.status).toBe(200);
    expect(loginWithNewPassword.body.data.user.mustChangePassword).toBe(true);
    expect(loginWithNewPassword.body.data.user.passwordChangedAt).toEqual(expect.any(String));
  });

  it("mantem usuario inativo sem liberar login", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/admin/users/user-aluno-inativo-demo/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.status).toBe("inactive");
    expect(response.body.data.user.mustChangePassword).toBe(true);

    const loginResponse = await loginAs(
      "aluno.inativo.demo@example.com",
      response.body.data.temporaryPassword as string,
    );

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.error.code).toBe("USER_INACTIVE");
  });

  it("gera senhas diferentes em duas redefinicoes consecutivas", async () => {
    const adminToken = await loginAsAdmin();

    const firstReset = await request(app)
      .post("/api/admin/users/user-aluno-demo/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    const secondReset = await request(app)
      .post("/api/admin/users/user-aluno-demo/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(firstReset.status).toBe(200);
    expect(secondReset.status).toBe(200);
    expect(firstReset.body.data.temporaryPassword).not.toBe(secondReset.body.data.temporaryPassword);
    expect(firstReset.body.data.user.temporaryPasswordGeneratedAt).not.toBe(
      secondReset.body.data.user.temporaryPasswordGeneratedAt,
    );
  });

  it("cria auditoria sem expor senha nem hash", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/admin/users/user-aluno-demo/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    const temporaryPassword = response.body.data.temporaryPassword as string;
    const auditLogs = getMemoryAuthAuditLogs();

    expect(auditLogs[0]).toEqual(
      expect.objectContaining({
        action: "Senha redefinida por admin",
      }),
    );
    expect(JSON.stringify(auditLogs[0])).not.toContain(temporaryPassword);
    expect(JSON.stringify(auditLogs[0])).not.toContain("passwordHash");
  });

  it("bloqueia professor", async () => {
    const teacherLogin = await loginAs("professor.demo@example.com", "ProfessorDemo@123");

    const response = await request(app)
      .post("/api/admin/users/user-aluno-demo/reset-password")
      .set("Authorization", `Bearer ${teacherLogin.body.data.token as string}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("bloqueia aluno", async () => {
    const studentLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");

    const response = await request(app)
      .post("/api/admin/users/user-professor-demo/reset-password")
      .set("Authorization", `Bearer ${studentLogin.body.data.token as string}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("exige autenticacao", async () => {
    const response = await request(app).post("/api/admin/users/user-aluno-demo/reset-password");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("retorna 404 para usuario inexistente", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/admin/users/user-inexistente/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ADMIN_USER_NOT_FOUND");
  });

  it("bloqueia auto-reset administrativo", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .post("/api/admin/users/user-admin-demo/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("SELF_PASSWORD_RESET_NOT_ALLOWED");
  });

  it("mantem as alteracoes atomicas quando o reset falha", async () => {
    const baseRepository = createMemoryAuthRepository();

    setAuthRepositoryForTesting({
      async getByEmail(email) {
        return baseRepository.getByEmail(email);
      },
      async getById(id) {
        return baseRepository.getById(id);
      },
      async provisionStudentAccess(input) {
        return baseRepository.provisionStudentAccess(input);
      },
      async changePassword(input) {
        return baseRepository.changePassword(input);
      },
      async resetPasswordByAdmin() {
        throw new Error("Falha simulada no audit log do reset");
      },
    });

    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .post("/api/admin/users/user-aluno-demo/reset-password")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);

    const oldLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    expect(oldLogin.status).toBe(200);
    expect(oldLogin.body.data.user.mustChangePassword).toBe(false);
  });
});
