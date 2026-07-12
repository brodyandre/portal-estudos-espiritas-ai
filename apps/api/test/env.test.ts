import { describe, expect, it } from "vitest";

import { buildEnv } from "../src/config/env";
import { registerPasswordRecoveryPreview } from "../src/modules/auth/password-recovery.notifier";

describe("api environment config", () => {
  it("normaliza APP_PUBLIC_URL removendo barra final", () => {
    const config = buildEnv({
      NODE_ENV: "development",
      APP_PUBLIC_URL: "http://localhost:5173/",
    });

    expect(config.appPublicUrl).toBe("http://localhost:5173");
  });

  it("falha com APP_PUBLIC_URL inválido", () => {
    expect(() =>
      buildEnv({
        NODE_ENV: "development",
        APP_PUBLIC_URL: "/rota-relativa",
      }),
    ).toThrow("APP_PUBLIC_URL precisa ser uma URL absoluta e segura.");
  });

  it("falha com configuração SMTP parcial", () => {
    expect(() =>
      buildEnv({
        NODE_ENV: "development",
        APP_PUBLIC_URL: "http://localhost:5173",
        SMTP_ENABLED: "true",
        SMTP_HOST: "localhost",
        SMTP_PORT: "1025",
        SMTP_USER: "usuario",
        SMTP_FROM_NAME: "Portal de Estudos Espíritas",
        SMTP_FROM_EMAIL: "no-reply@example.com",
      }),
    ).toThrow("SMTP_USER e SMTP_PASSWORD devem ser informados juntos quando usados.");
  });

  it("falha no bootstrap quando o remetente SMTP é inválido", () => {
    expect(() =>
      buildEnv({
        NODE_ENV: "development",
        APP_PUBLIC_URL: "http://localhost:5173",
        SMTP_ENABLED: "true",
        SMTP_HOST: "localhost",
        SMTP_PORT: "1025",
        SMTP_FROM_NAME: "Portal de Estudos Espíritas",
        SMTP_FROM_EMAIL: "remetente-invalido",
      }),
    ).toThrow("SMTP_FROM_EMAIL precisa ser um e-mail válido.");
  });

  it("não permite prévia local em produção", () => {
    const config = buildEnv({
      NODE_ENV: "production",
      APP_PUBLIC_URL: "https://portal.example.com",
      PASSWORD_RECOVERY_PREVIEW_ENABLED: "true",
    });

    const previewStored = registerPasswordRecoveryPreview(
      {
        email: "aluno.demo@example.com",
        fullName: "Aluno Demo",
        token: "token-demo",
        resetUrl: "https://portal.example.com/redefinir-senha?token=token-demo",
        createdAt: "2026-07-12T18:00:00.000Z",
        expiresAt: "2026-07-12T18:30:00.000Z",
      },
      config,
    );

    expect(config.passwordRecoveryPreviewEnabled).toBe(false);
    expect(previewStored).toBe(false);
  });
});
