import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import {
  createMemoryAuthRepository,
  getMemoryAuthAuditLogs,
  getMemoryAuthSessions,
  getMemoryPasswordResetTokens,
} from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import { listPasswordRecoveryPreviews } from "../src/modules/auth/password-recovery.notifier";
import { setAuthRateLimitNowProviderForTesting } from "../src/security/auth-rate-limit";

describe("password recovery flow", () => {
  let currentTime = new Date("2026-07-12T18:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useRealTimers();
    resetAuthStore();
    setAuthRateLimitNowProviderForTesting(() => currentTime);
  });

  it("retorna a mesma resposta publica para usuario existente e inexistente", async () => {
    const existingResponse = await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });
    const missingResponse = await request(app).post("/api/auth/forgot-password").send({
      email: "nao.existe@example.com",
    });

    expect(existingResponse.status).toBe(200);
    expect(missingResponse.status).toBe(200);
    expect(existingResponse.body).toEqual(missingResponse.body);
  });

  it("gera token seguro, armazena apenas o hash e define expiracao", async () => {
    const response = await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    expect(response.status).toBe(200);

    const [preview] = listPasswordRecoveryPreviews();
    const [storedToken] = getMemoryPasswordResetTokens();
    const expiresAt = new Date(storedToken.expiresAt).getTime();

    expect(preview.token).toEqual(expect.any(String));
    expect(storedToken.tokenHash).toEqual(expect.any(String));
    expect(storedToken.tokenHash).not.toBe(preview.token);
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 30 * 60 * 1000 + 5_000);
    expect((storedToken as Record<string, unknown>).token).toBeUndefined();
  });

  it("invalida o pedido anterior quando um novo token e emitido", async () => {
    await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    currentTime += 60_000;
    vi.setSystemTime(currentTime);

    await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    const [latestToken, previousToken] = getMemoryPasswordResetTokens();

    expect(latestToken.invalidatedAt).toBeNull();
    expect(previousToken.invalidatedAt).toEqual(expect.any(String));
  });

  it("aplica rate limit na solicitacao publica", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/api/auth/forgot-password").send({
        email: "aluno.demo@example.com",
      });

      expect(response.status).toBe(200);
    }

    const blockedResponse = await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error.code).toBe("PASSWORD_RECOVERY_RATE_LIMITED");
    expect(blockedResponse.headers["retry-after"]).toBeDefined();
  });

  it("redefine a senha com token valido, revoga sessoes e exige novo login", async () => {
    const previousLogin = await request(app).post("/api/auth/login").send({
      email: "aluno.demo@example.com",
      password: "AlunoDemo@123",
    });
    const previousToken = previousLogin.body.data.token as string;

    await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    const [preview] = listPasswordRecoveryPreviews();
    const response = await request(app).post("/api/auth/reset-password").send({
      token: preview.token,
      newPassword: "NovaSenha@123",
      confirmPassword: "NovaSenha@123",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe("Senha redefinida com sucesso. Faça login novamente.");

    const staleTokenResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${previousToken}`);

    expect(staleTokenResponse.status).toBe(401);

    const nextLogin = await request(app).post("/api/auth/login").send({
      email: "aluno.demo@example.com",
      password: "NovaSenha@123",
    });

    expect(nextLogin.status).toBe(200);
    expect(nextLogin.body.data.user.mustChangePassword).toBe(false);
    expect(nextLogin.body.data.user.passwordChangedAt).toEqual(expect.any(String));

    const repository = createMemoryAuthRepository();
    const updatedUser = await repository.getByEmail("aluno.demo@example.com");

    expect(updatedUser?.temporaryPasswordGeneratedAt ?? null).toBeNull();
    expect(updatedUser?.mustChangePassword).toBe(false);

    const auditLogs = getMemoryAuthAuditLogs();
    const serializedAudit = JSON.stringify(auditLogs[0]);
    expect(serializedAudit).not.toContain(preview.token);
    expect(serializedAudit).not.toContain("NovaSenha@123");
    expect(serializedAudit).not.toContain("passwordHash");
    expect(serializedAudit).not.toContain("sessionId");
  });

  it("rejeita reutilizacao da senha atual", async () => {
    await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    const [preview] = listPasswordRecoveryPreviews();
    const response = await request(app).post("/api/auth/reset-password").send({
      token: preview.token,
      newPassword: "AlunoDemo@123",
      confirmPassword: "AlunoDemo@123",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("PASSWORD_REUSE_NOT_ALLOWED");
  });

  it("rejeita token expirado, usado ou invalidado com o mesmo codigo estavel", async () => {
    try {
      vi.useFakeTimers();
      vi.setSystemTime(currentTime);

      await request(app).post("/api/auth/forgot-password").send({
        email: "aluno.demo@example.com",
      });

      const [firstPreview] = listPasswordRecoveryPreviews();

      currentTime += 31 * 60 * 1000;
      vi.setSystemTime(currentTime);

      const expiredResponse = await request(app).post("/api/auth/reset-password").send({
        token: firstPreview.token,
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

      expect(expiredResponse.status).toBe(400);
      expect(expiredResponse.body.error.code).toBe("INVALID_PASSWORD_RESET_TOKEN");

      currentTime = new Date("2026-07-12T18:00:00.000Z").getTime();
      vi.setSystemTime(currentTime);
      resetAuthStore();
      setAuthRateLimitNowProviderForTesting(() => currentTime);

      await request(app).post("/api/auth/forgot-password").send({
        email: "aluno.demo@example.com",
      });
      const [validPreview] = listPasswordRecoveryPreviews();

      const firstUse = await request(app).post("/api/auth/reset-password").send({
        token: validPreview.token,
        newPassword: "NovaSenha@123",
        confirmPassword: "NovaSenha@123",
      });

      expect(firstUse.status).toBe(200);

      const reusedResponse = await request(app).post("/api/auth/reset-password").send({
        token: validPreview.token,
        newPassword: "OutraSenha@123",
        confirmPassword: "OutraSenha@123",
      });

      expect(reusedResponse.status).toBe(400);
      expect(reusedResponse.body.error.code).toBe("INVALID_PASSWORD_RESET_TOKEN");
    } finally {
      vi.useRealTimers();
    }
  }, 10000);

  it("mantem usuario inativo sem reativar o login automaticamente", async () => {
    await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.inativo.demo@example.com",
    });

    const [preview] = listPasswordRecoveryPreviews();
    const response = await request(app).post("/api/auth/reset-password").send({
      token: preview.token,
      newPassword: "NovaSenha@123",
      confirmPassword: "NovaSenha@123",
    });

    expect(response.status).toBe(200);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "aluno.inativo.demo@example.com",
      password: "NovaSenha@123",
    });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.error.code).toBe("USER_INACTIVE");
  });

  it("nao permite uso duplo do token e revoga sessoes existentes", async () => {
    const firstLogin = await request(app).post("/api/auth/login").send({
      email: "aluno.demo@example.com",
      password: "AlunoDemo@123",
    });

    expect(firstLogin.status).toBe(200);
    expect(getMemoryAuthSessions().some((session) => session.revokedAt === null)).toBe(true);

    await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    const [preview] = listPasswordRecoveryPreviews();

    await request(app).post("/api/auth/reset-password").send({
      token: preview.token,
      newPassword: "NovaSenha@123",
      confirmPassword: "NovaSenha@123",
    });

    const activeSessions = getMemoryAuthSessions().filter((session) => session.userId === "user-aluno-demo");
    expect(activeSessions.every((session) => session.revokedAt)).toBe(true);
  });
});
