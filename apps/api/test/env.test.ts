import { describe, expect, it } from "vitest";

import { buildEnv } from "../src/config/env";
import { registerPasswordRecoveryPreview } from "../src/modules/auth/password-recovery.notifier";

const validProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@db.example.com:5432/portal",
  JWT_SECRET: "strong-production-secret-with-32-plus-chars",
  APP_PUBLIC_URL: "https://portal-educacao-continuada.com.br",
  CORS_ORIGINS: "https://portal-educacao-continuada.com.br",
  TRUST_PROXY_HOPS: "1",
};

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
      ...validProductionEnv,
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

  it("aceita configuração oficial de produção", () => {
    const config = buildEnv(validProductionEnv);

    expect(config.nodeEnv).toBe("production");
    expect(config.appPublicUrl).toBe("https://portal-educacao-continuada.com.br");
    expect(config.corsOrigins).toEqual(["https://portal-educacao-continuada.com.br"]);
    expect(config.trustProxyHops).toBe(1);
    expect(config.smtpEnabled).toBe(false);
  });

  it.each([
    ["ausente", undefined, "JWT_SECRET é obrigatório em produção."],
    ["curto", "short", "JWT_SECRET deve ter pelo menos 32 caracteres em produção."],
    [
      "default local",
      "jwt-secret-demo-local-only",
      "JWT_SECRET usa um valor fraco conhecido e deve ser substituído em produção.",
    ],
    [
      "fraco conhecido",
      "change-me",
      "JWT_SECRET usa um valor fraco conhecido e deve ser substituído em produção.",
    ],
  ])("rejeita JWT_SECRET %s em produção sem expor o valor", (_caseName, value, message) => {
    expect(() =>
      buildEnv({
        ...validProductionEnv,
        JWT_SECRET: value,
      }),
    ).toThrow(message);
  });

  it("rejeita valor fraco conhecido de JWT_SECRET sem depender de entropia falsa", () => {
    expect(() =>
      buildEnv({
        ...validProductionEnv,
        JWT_SECRET: "passwordpasswordpasswordpassword",
      }),
    ).not.toThrow();

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        JWT_SECRET: "password",
      }),
    ).toThrow("JWT_SECRET usa um valor fraco conhecido e deve ser substituído em produção.");
  });

  it("não expõe o JWT_SECRET em erro de produção", () => {
    const secret = "short";

    try {
      buildEnv({
        ...validProductionEnv,
        JWT_SECRET: secret,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("rejeita DATABASE_URL ausente ou com protocolo inválido em produção", () => {
    expect(() =>
      buildEnv({
        ...validProductionEnv,
        DATABASE_URL: "",
      }),
    ).toThrow("DATABASE_URL é obrigatório em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        DATABASE_URL: "mysql://user:password@db.example.com/portal",
      }),
    ).toThrow("DATABASE_URL deve usar protocolo postgresql ou postgres em produção.");
  });

  it("valida APP_PUBLIC_URL estritamente em produção", () => {
    expect(() =>
      buildEnv({
        ...validProductionEnv,
        APP_PUBLIC_URL: "http://portal-educacao-continuada.com.br",
      }),
    ).toThrow("APP_PUBLIC_URL precisa usar HTTPS em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        APP_PUBLIC_URL: "https://localhost",
      }),
    ).toThrow("APP_PUBLIC_URL não deve usar localhost em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        APP_PUBLIC_URL: "https://[::1]",
      }),
    ).toThrow("APP_PUBLIC_URL não deve usar localhost em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        APP_PUBLIC_URL: "https://portal-educacao-continuada.com.br/admin",
      }),
    ).toThrow("APP_PUBLIC_URL deve conter apenas a origem, sem path, query ou hash.");

    expect(
      buildEnv({
        ...validProductionEnv,
        APP_PUBLIC_URL: "https://portal-educacao-continuada.com.br/",
      }).appPublicUrl,
    ).toBe("https://portal-educacao-continuada.com.br");
  });

  it("valida CORS_ORIGINS estritamente em produção", () => {
    expect(() =>
      buildEnv({
        ...validProductionEnv,
        CORS_ORIGINS: "",
      }),
    ).toThrow("CORS_ORIGINS é obrigatório em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        CORS_ORIGINS: "*",
      }),
    ).toThrow("CORS_ORIGINS não aceita wildcard em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        CORS_ORIGINS: "https://localhost",
      }),
    ).toThrow("CORS_ORIGINS não deve usar localhost em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        CORS_ORIGINS: "https://127.0.0.2",
      }),
    ).toThrow("CORS_ORIGINS não deve usar localhost em produção.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        CORS_ORIGINS: "https://portal-educacao-continuada.com.br/app",
      }),
    ).toThrow("CORS_ORIGINS deve conter apenas a origem, sem path, query ou hash.");

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        CORS_ORIGINS: "https://portal-educacao-continuada.com.br,https://portal-educacao-continuada.com.br/",
      }),
    ).toThrow("CORS_ORIGINS não deve conter origens duplicadas.");
  });

  it("exige TRUST_PROXY_HOPS explícito e inteiro em produção", () => {
    expect(() =>
      buildEnv({
        ...validProductionEnv,
        TRUST_PROXY_HOPS: "",
      }),
    ).toThrow("TRUST_PROXY_HOPS é obrigatório em produção e deve ser um inteiro entre 0 e 10.");

    for (const value of ["1.5", "-1", "11"]) {
      expect(() =>
        buildEnv({
          ...validProductionEnv,
          TRUST_PROXY_HOPS: value,
        }),
      ).toThrow("TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 10.");
    }

    expect(() =>
      buildEnv({
        ...validProductionEnv,
        TRUST_PROXY_HOPS: "1abc",
      }),
    ).toThrow("TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 10.");
  });

  it("preserva defaults locais em desenvolvimento e testes", () => {
    const developmentConfig = buildEnv({ NODE_ENV: "development" });
    const testConfig = buildEnv({ NODE_ENV: "test" });

    expect(developmentConfig.jwtSecret).toBe("jwt-secret-demo-local-only");
    expect(developmentConfig.trustProxyHops).toBe(0);
    expect(developmentConfig.corsOrigins).toContain("http://localhost:5173");
    expect(testConfig.jwtSecret).toBe("jwt-secret-demo-local-only");
  });
});
