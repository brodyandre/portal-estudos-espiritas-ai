import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { env } from "../src/config/env";
import {
  getMemoryAuthAuditLogs,
  getMemoryAuthSessions,
  provisionStudentAccessWithPrisma,
} from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import { resetEnrollmentStore } from "../src/modules/enrollments/enrollments.service";
import { setAuthRateLimitNowProviderForTesting } from "../src/security/auth-rate-limit";

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
  let currentTime = 0;

  beforeEach(() => {
    currentTime = 0;
    app.set("trust proxy", true);
    resetAuthStore();
    resetEnrollmentStore();
    setAuthRateLimitNowProviderForTesting(() => currentTime);
  });

  afterEach(() => {
    app.set("trust proxy", false);
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

  it("cria uma sessao autenticada a cada login bem-sucedido", async () => {
    const response = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const sessions = getMemoryAuthSessions();

    expect(response.status).toBe(200);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        userId: "user-admin-demo",
        revokedAt: null,
        expiresAt: expect.any(String),
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

  it("mantem INVALID_CREDENTIALS abaixo do limite e retorna 429 ao exceder", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await loginAs("admin.demo@example.com", "senha-incorreta");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    }

    const blockedResponse = await loginAs("admin.demo@example.com", "senha-incorreta");

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error.code).toBe("AUTH_RATE_LIMITED");
    expect(blockedResponse.body.error.details.retryAfterSeconds).toEqual(expect.any(Number));
    expect(blockedResponse.headers["retry-after"]).toBeDefined();
  });

  it("normaliza e-mail com espacos e caixa para a mesma identidade de limite", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post("/api/auth/login").send({
        email: "  ADMIN.DEMO@example.com ",
        password: "senha-incorreta",
      });
    }

    const blockedResponse = await request(app).post("/api/auth/login").send({
      email: "admin.demo@example.com",
      password: "senha-incorreta",
    });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error.code).toBe("AUTH_RATE_LIMITED");
  });

  it("mantem comportamento equivalente para usuario inexistente ao exceder o limite", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await loginAs("nao.existe@example.com", "Senha@123");
    }

    const blockedResponse = await loginAs("nao.existe@example.com", "Senha@123");

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error.code).toBe("AUTH_RATE_LIMITED");
  });

  it("limpa o contador apos um login valido antes do bloqueio", async () => {
    await loginAs("admin.demo@example.com", "senha-incorreta");
    await loginAs("admin.demo@example.com", "senha-incorreta");

    const successResponse = await loginAs("admin.demo@example.com", "AdminDemo@123");

    expect(successResponse.status).toBe(200);

    const nextInvalidResponse = await loginAs("admin.demo@example.com", "senha-incorreta");

    expect(nextInvalidResponse.status).toBe(401);
    expect(nextInvalidResponse.body.error.code).toBe("INVALID_CREDENTIALS");
  }, 10000);

  it("nao compartilha o contador entre IPs distintos", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "10.0.0.1")
        .send({
          email: "admin.demo@example.com",
          password: "senha-incorreta",
        });
    }

    const ipOneBlocked = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.1")
      .send({
        email: "admin.demo@example.com",
        password: "senha-incorreta",
      });

    const ipTwoStillAllowed = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.2")
      .send({
        email: "admin.demo@example.com",
        password: "senha-incorreta",
      });

    expect(ipOneBlocked.status).toBe(429);
    expect(ipTwoStillAllowed.status).toBe(401);
    expect(ipTwoStillAllowed.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("permite novas tentativas depois da janela expirar", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await loginAs("admin.demo@example.com", "senha-incorreta");
    }

    const blockedResponse = await loginAs("admin.demo@example.com", "senha-incorreta");
    expect(blockedResponse.status).toBe(429);

    currentTime += 16 * 60 * 1000;

    const responseAfterWindow = await loginAs("admin.demo@example.com", "senha-incorreta");
    expect(responseAfterWindow.status).toBe(401);
    expect(responseAfterWindow.body.error.code).toBe("INVALID_CREDENTIALS");
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

  it("logout revoga apenas a sessao atual", async () => {
    const firstLogin = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const secondLogin = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const firstToken = firstLogin.body.data.token as string;
    const secondToken = secondLogin.body.data.token as string;
    const sessionsBeforeLogout = getMemoryAuthSessions();

    expect(new Set(sessionsBeforeLogout.map((session) => session.id)).size).toBeGreaterThanOrEqual(2);

    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${firstToken}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.data.revokedCurrentSession).toBe(true);

    const revokedTokenResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${firstToken}`);

    expect(revokedTokenResponse.status).toBe(401);
    expect(revokedTokenResponse.body.error.code).toBe("AUTH_REQUIRED");

    const stillActiveResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${secondToken}`);

    expect(stillActiveResponse.status).toBe(200);
  });

  it("logout e idempotente para a sessao atual", async () => {
    const loginResponse = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const token = loginResponse.body.data.token as string;

    const firstLogout = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
    const secondLogout = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);

    expect(firstLogout.status).toBe(200);
    expect(secondLogout.status).toBe(200);
  });

  it("logout-all revoga todas as sessoes do usuario sem afetar outros usuarios", async () => {
    const teacherLoginOne = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const teacherLoginTwo = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const adminLogin = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const logoutAllResponse = await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${teacherLoginOne.body.data.token as string}`);

    expect(logoutAllResponse.status).toBe(200);
    expect(logoutAllResponse.body.data.revokedSessions).toBeGreaterThanOrEqual(2);

    const teacherFirstMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${teacherLoginOne.body.data.token as string}`);
    const teacherSecondMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${teacherLoginTwo.body.data.token as string}`);
    const adminMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminLogin.body.data.token as string}`);

    expect(teacherFirstMe.status).toBe(401);
    expect(teacherSecondMe.status).toBe(401);
    expect(adminMe.status).toBe(200);
  });

  it("rejeita token com sessao inexistente", async () => {
    const token = jwt.sign(
      {
        sub: "user-admin-demo",
        email: "admin.demo@example.com",
        fullName: "Admin Demonstrativo",
        role: "admin",
        status: "active",
        mustChangePassword: false,
        passwordChangedAt: null,
      },
      env.jwtSecret,
      {
        algorithm: "HS256",
        expiresIn: "8h",
        jwtid: "missing-session-id",
      },
    );

    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejeita token quando a sessao pertence a outro usuario", async () => {
    await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const sessions = getMemoryAuthSessions();
    const professorSession = sessions.find((session) => session.userId === "user-professor-demo");

    expect(professorSession).toBeDefined();

    const forgedToken = jwt.sign(
      {
        sub: "user-admin-demo",
        email: "admin.demo@example.com",
        fullName: "Admin Demonstrativo",
        role: "admin",
        status: "active",
        mustChangePassword: false,
        passwordChangedAt: null,
      },
      env.jwtSecret,
      {
        algorithm: "HS256",
        expiresIn: "8h",
        jwtid: professorSession?.id,
      },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${forgedToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejeita sessao expirada", async () => {
    const token = jwt.sign(
      {
        sub: "user-professor-demo",
        email: "professor.demo@example.com",
        fullName: "Professor Demonstrativo",
        role: "teacher",
        status: "active",
        mustChangePassword: false,
        passwordChangedAt: null,
      },
      env.jwtSecret,
      {
        algorithm: "HS256",
        expiresIn: -1,
        jwtid: "expired-session-id",
      },
    );

    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("os audit logs de sessao nao expoem JWT nem identificadores sensiveis", async () => {
    const loginResponse = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const token = loginResponse.body.data.token as string;
    const sessionId = getMemoryAuthSessions()[0]?.id;

    await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);

    const [latestAuditLog] = getMemoryAuthAuditLogs();
    const serialized = JSON.stringify(latestAuditLog);

    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(sessionId ?? "");
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

  it("limita tentativas de troca com senha atual incorreta", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);
    const token = loginResponse.body.data.token as string;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "SenhaErrada@123",
          newPassword: "NovaSenha@123",
          confirmPassword: "NovaSenha@123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("CURRENT_PASSWORD_INVALID");
    }

    const blockedResponse = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: "SenhaErrada@123",
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error.code).toBe("PASSWORD_CHANGE_RATE_LIMITED");
    expect(blockedResponse.body.error.details.retryAfterSeconds).toEqual(expect.any(Number));
    expect(blockedResponse.headers["retry-after"]).toBeDefined();
  });

  it("mantem contadores independentes para usuarios distintos na troca de senha", async () => {
    const firstApproval = await approveEnrollmentAndGetStudentAccess("enrollment-001");
    const secondApproval = await approveEnrollmentAndGetStudentAccess("enrollment-002");
    const firstAccess = firstApproval.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const secondAccess = secondApproval.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };

    const firstLogin = await loginAs(firstAccess.email, firstAccess.temporaryPassword);
    const secondLogin = await loginAs(secondAccess.email, secondAccess.temporaryPassword);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .patch("/api/auth/change-password")
        .set("Authorization", `Bearer ${firstLogin.body.data.token as string}`)
        .send({
          currentPassword: "SenhaErrada@123",
          newPassword: "NovaSenha@123",
          confirmPassword: "NovaSenha@123",
        });
    }

    const unaffectedUserResponse = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${secondLogin.body.data.token as string}`)
      .send({
        currentPassword: "SenhaErrada@123",
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

    expect(unaffectedUserResponse.status).toBe(401);
    expect(unaffectedUserResponse.body.error.code).toBe("CURRENT_PASSWORD_INVALID");
  });

  it("limpa o contador de troca de senha apos sucesso", async () => {
    const approvalResponse = await approveEnrollmentAndGetStudentAccess();
    const studentAccess = approvalResponse.body.data.studentAccess as {
      email: string;
      temporaryPassword: string;
    };
    const loginResponse = await loginAs(studentAccess.email, studentAccess.temporaryPassword);
    const token = loginResponse.body.data.token as string;

    await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: "SenhaErrada@123",
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

    const successResponse = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: studentAccess.temporaryPassword,
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

    expect(successResponse.status).toBe(200);

    const relogin = await loginAs(studentAccess.email, "NovaSenha@123");
    const nextToken = relogin.body.data.token as string;
    const postSuccessFailure = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", `Bearer ${nextToken}`)
      .send({
        currentPassword: "SenhaErrada@123",
        newPassword: "OutraSenha@123",
        confirmPassword: "OutraSenha@123",
      });

    expect(postSuccessFailure.status).toBe(401);
    expect(postSuccessFailure.body.error.code).toBe("CURRENT_PASSWORD_INVALID");
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
      authSession: {
        updateMany: async () => ({
          count: 1,
        }),
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
