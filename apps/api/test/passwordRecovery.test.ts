import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import { env } from "../src/config/env";
import {
  createMemoryAuthRepository,
  getMemoryAuthAuditLogs,
  getMemoryAuthSessions,
  getMemoryPasswordResetTokens,
} from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import {
  listMemoryPasswordRecoveryMessages,
  listPasswordRecoveryPreviews,
  setPasswordRecoveryNotifierForTesting,
  NullPasswordRecoveryNotifier,
  type PasswordRecoveryNotifier,
} from "../src/modules/auth/password-recovery.notifier";
import { setAuthRateLimitNowProviderForTesting } from "../src/security/auth-rate-limit";

describe("password recovery flow", () => {
  let currentTime = new Date("2026-07-12T18:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useRealTimers();
    resetAuthStore();
    setAuthRateLimitNowProviderForTesting(() => currentTime);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(listMemoryPasswordRecoveryMessages()).toHaveLength(1);
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
    expect(preview.resetUrl).toContain("http://localhost:5173/redefinir-senha?token=");
    expect(listMemoryPasswordRecoveryMessages()[0]?.recoveryUrl).toBe(preview.resetUrl);
    expect((storedToken as Record<string, unknown>).token).toBeUndefined();
  });

  it("codifica o token ao montar a URL pública de redefinição", async () => {
    const { buildPasswordResetUrl } = await import("../src/modules/auth/auth.service");

    expect(buildPasswordResetUrl("abc+/=? token")).toBe(
      "http://localhost:5173/redefinir-senha?token=abc%2B%2F%3D%3F%20token",
    );
  });

  it("não dispara envio quando o usuário não existe", async () => {
    const response = await request(app).post("/api/auth/forgot-password").send({
      email: "nao.existe@example.com",
    });

    expect(response.status).toBe(200);
    expect(listMemoryPasswordRecoveryMessages()).toHaveLength(0);
    expect(getMemoryPasswordResetTokens()).toHaveLength(0);
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

  it("mantém a resposta pública genérica e invalida o token quando o notifier falha", async () => {
    class ThrowingNotifier implements PasswordRecoveryNotifier {
      readonly kind = "smtp" as const;

      async sendPasswordRecovery() {
        throw new Error("Falha simulada de SMTP");
      }
    }

    setPasswordRecoveryNotifierForTesting(new ThrowingNotifier());

    const response = await request(app).post("/api/auth/forgot-password").send({
      email: "aluno.demo@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe(
      "Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.",
    );

    const [storedToken] = getMemoryPasswordResetTokens();
    expect(storedToken.invalidatedAt).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("aluno.demo@example.com");
    expect(JSON.stringify(response.body)).not.toContain("redefinir-senha");
  });

  it("registra falha operacional sem expor token, URL ou destinatário", async () => {
    class ThrowingNotifier implements PasswordRecoveryNotifier {
      readonly kind = "smtp" as const;

      async sendPasswordRecovery() {
        throw new Error("Falha simulada de SMTP");
      }
    }

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const originalNodeEnv = env.nodeEnv;
    env.nodeEnv = "development";

    setPasswordRecoveryNotifierForTesting(new ThrowingNotifier());

    try {
      await request(app).post("/api/auth/forgot-password").send({
        email: "aluno.demo@example.com",
      });
    } finally {
      env.nodeEnv = originalNodeEnv;
    }

    const warningOutput = warnSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    const [storedToken] = getMemoryPasswordResetTokens();

    expect(warningOutput).toContain("delivery_failed");
    expect(warningOutput).not.toContain("aluno.demo@example.com");
    expect(warningOutput).not.toContain(storedToken.tokenHash);
    expect(warningOutput).not.toContain("redefinir-senha");
    expect(infoSpy).toHaveBeenCalled();
  });

  it("usa o notifier nulo sem deixar token ativo quando não há entrega disponível", async () => {
    const originalNodeEnv = env.nodeEnv;
    const originalPreviewFlag = env.passwordRecoveryPreviewEnabled;
    env.nodeEnv = "development";
    env.passwordRecoveryPreviewEnabled = false;
    setPasswordRecoveryNotifierForTesting(new NullPasswordRecoveryNotifier());

    try {
      const response = await request(app).post("/api/auth/forgot-password").send({
        email: "aluno.demo@example.com",
      });

      expect(response.status).toBe(200);

      const [storedToken] = getMemoryPasswordResetTokens();
      expect(storedToken.invalidatedAt).toEqual(expect.any(String));
      expect(listPasswordRecoveryPreviews()).toHaveLength(0);
    } finally {
      env.nodeEnv = originalNodeEnv;
      env.passwordRecoveryPreviewEnabled = originalPreviewFlag;
    }
  });

  it("não invalida token já usado e não cria auditoria compensatória", async () => {
    const repository = createMemoryAuthRepository();

    await repository.replacePasswordResetToken({
      userId: "user-aluno-demo",
      tokenHash: "token-hash-usado",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      requestedIpHash: null,
      actorName: "Recuperação de senha",
      actorRole: "visitor",
    });

    const auditCountBeforeReset = getMemoryAuthAuditLogs().length;

    const resetResult = await repository.resetPasswordWithRecoveryToken({
      tokenHash: "token-hash-usado",
      newPassword: "NovaSenha@123",
      passwordHash: "hash-demo",
      passwordChangedAt: new Date().toISOString(),
      actorName: "Recuperação de senha",
      actorRole: "visitor",
    });

    expect(resetResult.status).toBe("updated");

    const invalidated = await repository.invalidatePasswordResetToken({
      tokenHash: "token-hash-usado",
      invalidatedAt: new Date().toISOString(),
      actorName: "Recuperação de senha",
      actorRole: "visitor",
      note: "Falha segura de entrega.",
    });

    expect(invalidated).toBe(false);
    expect(getMemoryAuthAuditLogs()).toHaveLength(auditCountBeforeReset + 1);
    expect(getMemoryAuthAuditLogs()[0]?.action).toBe("Senha redefinida por recuperação");
  });

  it("retorna false para token já invalidado e não cria auditoria compensatória", async () => {
    const repository = createMemoryAuthRepository();

    await repository.replacePasswordResetToken({
      userId: "user-aluno-demo",
      tokenHash: "token-hash-invalidado",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      requestedIpHash: null,
      actorName: "Recuperação de senha",
      actorRole: "visitor",
    });

    const firstInvalidation = await repository.invalidatePasswordResetToken({
      tokenHash: "token-hash-invalidado",
      invalidatedAt: new Date().toISOString(),
      actorName: "Recuperação de senha",
      actorRole: "visitor",
      note: "Primeira invalidação segura.",
    });

    const auditCountAfterFirstInvalidation = getMemoryAuthAuditLogs().length;

    const secondInvalidation = await repository.invalidatePasswordResetToken({
      tokenHash: "token-hash-invalidado",
      invalidatedAt: new Date().toISOString(),
      actorName: "Recuperação de senha",
      actorRole: "visitor",
      note: "Segunda invalidação não deve acontecer.",
    });

    expect(firstInvalidation).toBe(true);
    expect(secondInvalidation).toBe(false);
    expect(getMemoryAuthAuditLogs()).toHaveLength(auditCountAfterFirstInvalidation);
    expect(
      getMemoryAuthAuditLogs().filter((entry) => entry.action === "Recuperação de senha invalidada"),
    ).toHaveLength(1);
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
  }, 15000);

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
