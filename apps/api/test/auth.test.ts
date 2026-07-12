import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { getMemoryAuthAuditLogs, provisionStudentAccessWithPrisma } from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import { resetEnrollmentStore } from "../src/modules/enrollments/enrollments.service";

const loginAs = async (email: string, password: string) => {
  return request(app).post("/api/auth/login").send({ email, password });
};

const approveEnrollmentAndGetStudentAccess = async (enrollmentId = "enrollment-001") => {
  const teacherLogin = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
  const teacherToken = teacherLogin.body.data.token as string;
  const approvalResponse = await request(app)
    .patch(`/api/enrollments/${enrollmentId}/status`)
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({
      status: "approved",
      teacherNote: "Aprovado para o primeiro acesso local.",
    });

  return approvalResponse;
};

describe("auth endpoints", () => {
  beforeEach(() => {
    resetAuthStore();
    resetEnrollmentStore();
  });

  it("faz login local com sucesso", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin.demo@example.com",
      password: "AdminDemo@123",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        email: "admin.demo@example.com",
        role: "admin",
        status: "active",
      }),
    );
  });

  it("retorna erro seguro para senha invalida", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin.demo@example.com",
      password: "senha-incorreta",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("retorna erro seguro para usuario inexistente", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "nao.existe@example.com",
      password: "Senha@123",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("bloqueia usuario inativo", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "aluno.inativo.demo@example.com",
      password: "AlunoInativo@123",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("USER_INACTIVE");
  });

  it("retorna /me com token valido", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "professor.demo@example.com",
      password: "ProfessorDemo@123",
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        email: "professor.demo@example.com",
        role: "teacher",
      }),
    );
  });

  it("bloqueia /me sem token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("troca a senha temporaria com sucesso e libera o acesso local", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
      mustChangePassword: boolean;
    };

    expect(approvalResponse.status).toBe(200);
    expect(studentAccess.mustChangePassword).toBe(true);

    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);
    const firstToken = loginResponse.body.data.token as string;

    const blockedResponse = await request(app)
      .get("/api/enrollments")
      .set("Authorization", `Bearer ${firstToken}`);

    expect(blockedResponse.status).toBe(403);
    expect(blockedResponse.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const changePasswordResponse = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${firstToken}`)
      .send({
        currentPassword: studentAccess.temporaryPassword,
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

    expect(changePasswordResponse.status).toBe(200);
    expect(changePasswordResponse.body.data.user.mustChangePassword).toBe(false);
    expect(changePasswordResponse.body.data.user.passwordChangedAt).toEqual(expect.any(String));
    expect(changePasswordResponse.body.data.user.passwordHash).toBeUndefined();
    expect(changePasswordResponse.body.data.passwordHash).toBeUndefined();

    const secondToken = changePasswordResponse.body.data.token as string;
    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${secondToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.mustChangePassword).toBe(false);
    expect(meResponse.body.data.passwordChangedAt).toEqual(expect.any(String));

    const oldTokenResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${firstToken}`);

    expect(oldTokenResponse.status).toBe(401);
    expect(oldTokenResponse.body.error.code).toBe("AUTH_REQUIRED");

    const postChangeProtectedResponse = await request(app)
      .get("/api/enrollments")
      .set("Authorization", `Bearer ${secondToken}`);

    expect(postChangeProtectedResponse.status).toBe(403);
    expect(postChangeProtectedResponse.body.error.code).toBe("FORBIDDEN");

    const auditLogs = getMemoryAuthAuditLogs();
    expect(auditLogs[0]).toEqual(
      expect.objectContaining({
        action: "Senha alterada",
      }),
    );
    expect(JSON.stringify(auditLogs[0])).not.toContain(studentAccess.temporaryPassword);
    expect(JSON.stringify(auditLogs[0])).not.toContain("NovaSenha@123");
  });

  it("rejeita troca quando a senha atual nao confere", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);

    const response = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${loginResponse.body.data.token as string}`)
      .send({
        currentPassword: "SenhaErrada@123",
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("CURRENT_PASSWORD_INVALID");
  });

  it("rejeita troca quando a confirmacao diverge", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);

    const response = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${loginResponse.body.data.token as string}`)
      .send({
        currentPassword: studentAccess.temporaryPassword,
        newPassword: "NovaSenha@123",
        confirmPassword: "OutraSenha@123",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("PASSWORD_CONFIRMATION_MISMATCH");
  });

  it("rejeita troca com senha nova fraca", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);

    const response = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${loginResponse.body.data.token as string}`)
      .send({
        currentPassword: studentAccess.temporaryPassword,
        newPassword: "fraca",
        confirmPassword: "fraca",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("WEAK_PASSWORD");
  });

  it("rejeita reutilizacao da senha atual", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);

    const response = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${loginResponse.body.data.token as string}`)
      .send({
        currentPassword: studentAccess.temporaryPassword,
        newPassword: studentAccess.temporaryPassword,
        confirmPassword: studentAccess.temporaryPassword,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("PASSWORD_REUSE_NOT_ALLOWED");
  });

  it("nao afeta usuarios comuns que ja estao liberados", async () => {
    const loginResponse = await loginAs("admin.demo@example.com", "AdminDemo@123");

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.mustChangePassword).toBe(false);

    const response = await request(app)
      .get("/api/enrollments")
      .set("Authorization", `Bearer ${loginResponse.body.data.token as string}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("nao altera silenciosamente senhas com espacos por trim", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);
    const token = loginResponse.body.data.token as string;
    const spacedPassword = " NovaSenha@123 ";

    const invalidCurrentPasswordResponse = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: ` ${studentAccess.temporaryPassword} `,
        newPassword: spacedPassword,
        confirmPassword: spacedPassword,
      });

    expect(invalidCurrentPasswordResponse.status).toBe(401);
    expect(invalidCurrentPasswordResponse.body.error.code).toBe("CURRENT_PASSWORD_INVALID");

    const successfulChangeResponse = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: studentAccess.temporaryPassword,
        newPassword: spacedPassword,
        confirmPassword: spacedPassword,
      });

    expect(successfulChangeResponse.status).toBe(200);

    const exactLoginResponse = await loginAs(studentAccess.email, spacedPassword);
    expect(exactLoginResponse.status).toBe(200);

    const trimmedLoginResponse = await loginAs(studentAccess.email, spacedPassword.trim());
    expect(trimmedLoginResponse.status).toBe(401);
    expect(trimmedLoginResponse.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("mantem a mesma semantica de passwordChangedAt no caminho prisma durante reprovisionamento", async () => {
    const existingUser = {
      id: "user-existing-student",
      fullName: "Aluno Existente",
      email: "aluno.existente@example.com",
      passwordHash: "hash-antigo",
      whatsapp: "+55 00 90000-0011",
      role: "STUDENT",
      status: "ACTIVE",
      groupName: "Emmanuel",
      groupSlug: "emmanuel",
      enrollmentId: "enrollment-old",
      temporaryPasswordGeneratedAt: new Date("2026-07-12T12:00:00.000Z"),
      passwordChangedAt: new Date("2026-07-12T12:00:00.000Z"),
      mustChangePassword: true,
      adminNote: null,
      createdAt: new Date("2026-07-12T12:00:00.000Z"),
      updatedAt: new Date("2026-07-12T12:00:00.000Z"),
    };

    const operations = {
      lastUpdateData: null as Record<string, unknown> | null,
      auditCount: 0,
    };

    const transaction = {
      user: {
        findUnique: async () => existingUser,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          operations.lastUpdateData = data;

          return {
            ...existingUser,
            ...data,
          };
        },
        create: async () => {
          throw new Error("Nao deveria criar novo usuario neste teste.");
        },
      },
      auditLog: {
        create: async () => {
          operations.auditCount += 1;
        },
      },
    };

    const reprovisionTimestamp = "2026-07-12T13:30:00.000Z";

    const result = await provisionStudentAccessWithPrisma(transaction as never, {
      enrollmentId: "enrollment-002",
      fullName: "Aluno Existente",
      email: "aluno.existente@example.com",
      whatsapp: "+55 00 90000-0011",
      groupName: "Emmanuel",
      groupSlug: "emmanuel",
      passwordHash: "hash-novo",
      temporaryPasswordGeneratedAt: reprovisionTimestamp,
      mustChangePassword: true,
      actorName: "Professor Demonstrativo",
      actorRole: "teacher",
    });

    expect(result.action).toBe("updated");
    expect(result.mustChangePassword).toBe(true);
    expect(result.user.mustChangePassword).toBe(true);
    expect(result.user.passwordChangedAt).toBe(reprovisionTimestamp);
    expect(operations.auditCount).toBe(1);
    expect(operations.lastUpdateData).toEqual(
      expect.objectContaining({
        mustChangePassword: true,
        passwordChangedAt: new Date(reprovisionTimestamp),
        temporaryPasswordGeneratedAt: new Date(reprovisionTimestamp),
      }),
    );
  });
});
