import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { app, configureTrustProxy, createApp } from "../src/app";
import type { ApiEnv } from "../src/config/env";
import { assertLoginRateLimit, recordFailedLoginAttempt, resetAuthRateLimitStore } from "../src/security/auth-rate-limit";

const buildAppEnv = (overrides: Partial<ApiEnv> = {}): ApiEnv => ({
  nodeEnv: "test",
  port: 3333,
  databaseUrl: null,
  jwtSecret: "jwt-secret-demo-local-only",
  passwordRecoveryPreviewEnabled: false,
  passwordRecoveryTtlMinutes: 30,
  appPublicUrl: "http://localhost:5173",
  smtpEnabled: false,
  smtpHost: "localhost",
  smtpPort: 1025,
  smtpSecure: false,
  smtpUser: null,
  smtpPassword: null,
  smtpFromName: "Portal de Estudos Espiritas",
  smtpFromEmail: "no-reply@example.local",
  corsOrigins: ["http://localhost:5173"],
  trustProxyHops: 0,
  ollamaModel: "llama3.1:8b",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ...overrides,
});

describe("GET /health", () => {
  it("retorna status ok em JSON padronizado", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("API funcionando normalmente.");
    expect(response.body.data.status).toBe("ok");
    expect(typeof response.body.data.timestamp).toBe("string");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });
});

describe("GET /api/studies", () => {
  it("retorna os grupos mockados com proxima aula", async () => {
    const response = await request(app).get("/api/studies");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBe(2);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      id: "emmanuel",
      name: "Emmanuel",
      participantCount: 88,
    });
    expect(response.body.data[0].nextLesson).toMatchObject({
      id: "lesson-emmanuel-2026-07-13",
      scheduledAt: "2026-07-13T20:00:00-03:00",
    });
  });
});

describe("production hardening middleware", () => {
  beforeEach(() => {
    resetAuthRateLimitStore();
  });

  it("permite origem configurada e expõe X-Request-Id sem credentials", async () => {
    const hardenedApp = createApp({
      env: buildAppEnv({
        corsOrigins: ["https://portal-educacao-continuada.com.br"],
      }),
    });

    const response = await request(hardenedApp)
      .get("/health")
      .set("Origin", "https://portal-educacao-continuada.com.br");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://portal-educacao-continuada.com.br");
    expect(response.headers["access-control-expose-headers"]).toContain("X-Request-Id");
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("rejeita origem não configurada e não inclui www implicitamente", async () => {
    const hardenedApp = createApp({
      env: buildAppEnv({
        corsOrigins: ["https://portal-educacao-continuada.com.br"],
      }),
    });

    const response = await request(hardenedApp)
      .get("/health")
      .set("Origin", "https://www.portal-educacao-continuada.com.br");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CORS_ORIGIN_FORBIDDEN");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("permite requisições sem Origin e preflight válido com Authorization", async () => {
    const hardenedApp = createApp({
      env: buildAppEnv({
        corsOrigins: ["https://portal-educacao-continuada.com.br"],
      }),
    });

    const healthResponse = await request(hardenedApp).get("/health");
    const preflightResponse = await request(hardenedApp)
      .options("/api/auth/login")
      .set("Origin", "https://portal-educacao-continuada.com.br")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Authorization,Content-Type");

    expect(healthResponse.status).toBe(200);
    expect(preflightResponse.status).toBe(204);
    expect(preflightResponse.headers["access-control-allow-methods"]).toContain("POST");
    expect(preflightResponse.headers["access-control-allow-headers"]).toContain("Authorization");
  });

  it("gera requestId seguro e preserva X-Request-Id válido", async () => {
    const hardenedApp = createApp({ env: buildAppEnv() });

    const generated = await request(hardenedApp).get("/health");
    const preserved = await request(hardenedApp).get("/health").set("X-Request-Id", "trace_123:abc.def");
    const replaced = await request(hardenedApp).get("/health").set("X-Request-Id", "valor com espaço");

    expect(generated.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(preserved.headers["x-request-id"]).toBe("trace_123:abc.def");
    expect(replaced.headers["x-request-id"]).not.toBe("valor com espaço");
  });

  it("registra log JSON de produção sem query, Authorization ou body", async () => {
    const logs: string[] = [];
    const hardenedApp = createApp({
      env: buildAppEnv({
        nodeEnv: "production",
        corsOrigins: ["https://portal-educacao-continuada.com.br"],
        trustProxyHops: 1,
      }),
      requestLogSink: (message) => logs.push(message),
    });

    const response = await request(hardenedApp)
      .get("/health?token=sensivel")
      .set("Authorization", "Bearer token-sensivel")
      .set("X-Request-Id", "trace-logger");

    expect(response.status).toBe(200);
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toContain("token=sensivel");
    expect(logs[0]).not.toContain("Bearer");
    const parsed = JSON.parse(logs[0] ?? "{}") as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: "info",
      requestId: "trace-logger",
      method: "GET",
      path: "/health",
      status: 200,
    });
    expect(typeof parsed.durationMs).toBe("number");
  });

  it("adiciona headers de segurança e remove X-Powered-By", async () => {
    const hardenedApp = createApp({ env: buildAppEnv() });
    const response = await request(hardenedApp).get("/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(response.headers["content-security-policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
  });

  it("envia HSTS somente em HTTPS confiável de produção", async () => {
    const productionEnv = buildAppEnv({
      nodeEnv: "production",
      corsOrigins: ["https://portal-educacao-continuada.com.br"],
      trustProxyHops: 1,
    });

    const silentSink = vi.fn();
    const trustedHttps = await request(createApp({ env: productionEnv, requestLogSink: silentSink }))
      .get("/health")
      .set("X-Forwarded-Proto", "https");
    const trustedHttp = await request(createApp({ env: productionEnv, requestLogSink: silentSink })).get("/health");
    const untrustedHttps = await request(createApp({
      env: buildAppEnv({
        nodeEnv: "production",
        corsOrigins: ["https://portal-educacao-continuada.com.br"],
        trustProxyHops: 0,
      }),
      requestLogSink: silentSink,
    }))
      .get("/health")
      .set("X-Forwarded-Proto", "https");

    expect(trustedHttps.headers["strict-transport-security"]).toBe("max-age=15552000; includeSubDomains");
    expect(trustedHttp.headers["strict-transport-security"]).toBeUndefined();
    expect(untrustedHttps.headers["strict-transport-security"]).toBeUndefined();
  });

  it("retorna 413 sanitizado para payload JSON acima de 64kb e preserva JSON inválido", async () => {
    const hardenedApp = createApp({ env: buildAppEnv() });
    const oversizedPayload = { value: "x".repeat(65 * 1024) };

    const oversized = await request(hardenedApp).post("/api/auth/login").send(oversizedPayload);
    const invalidJson = await request(hardenedApp)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{");

    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(JSON.stringify(oversized.body)).not.toContain(oversizedPayload.value);
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.body.error.code).toBe("INVALID_JSON");
  });

  it("mantém payload dentro do limite e erro especial de null no rebuild", async () => {
    const hardenedApp = createApp({ env: buildAppEnv() });

    const loginInputError = await request(hardenedApp)
      .post("/api/auth/login")
      .send({ email: "admin.demo@example.com" });
    const nullRebuild = await request(hardenedApp)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Content-Type", "application/json")
      .send("null");

    expect(loginInputError.status).toBe(400);
    expect(loginInputError.body.error.code).toBe("INVALID_LOGIN_INPUT");
    expect(nullRebuild.status).toBe(400);
    expect(nullRebuild.body.error.code).toBe("INVALID_KNOWLEDGE_CORPUS_REBUILD_INPUT");
  });

  it("configura trust proxy de forma restritiva", async () => {
    const withoutProxy = express();
    configureTrustProxy(withoutProxy, 0);
    withoutProxy.get("/ip", (request, response) => response.json({ ip: request.ip }));

    const withOneProxy = express();
    configureTrustProxy(withOneProxy, 1);
    withOneProxy.get("/ip", (request, response) => response.json({ ip: request.ip }));

    const noTrust = await request(withoutProxy).get("/ip").set("X-Forwarded-For", "203.0.113.10");
    const trusted = await request(withOneProxy).get("/ip").set("X-Forwarded-For", "203.0.113.10");
    const forgedChain = await request(withOneProxy)
      .get("/ip")
      .set("X-Forwarded-For", "198.51.100.99, 203.0.113.10");

    expect(noTrust.body.ip).not.toBe("203.0.113.10");
    expect(trusted.body.ip).toBe("203.0.113.10");
    expect(forgedChain.body.ip).toBe("203.0.113.10");
  });

  it("mantém rate limit por IP atrás de um proxy confiável", async () => {
    const rateLimitedApp = express();
    configureTrustProxy(rateLimitedApp, 1);
    rateLimitedApp.post("/login-attempt", (request, response, next) => {
      try {
        assertLoginRateLimit(request.ip, "admin.demo@example.com");
        recordFailedLoginAttempt(request.ip, "admin.demo@example.com");
        response.status(401).json({ code: "INVALID_CREDENTIALS" });
      } catch (error) {
        next(error);
      }
    });
    rateLimitedApp.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
      response.status(429).json({ message: error.message });
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(rateLimitedApp)
        .post("/login-attempt")
        .set("X-Forwarded-For", "203.0.113.10");
      expect(response.status).toBe(401);
    }

    const blocked = await request(rateLimitedApp)
      .post("/login-attempt")
      .set("X-Forwarded-For", "203.0.113.10");
    const otherIp = await request(rateLimitedApp)
      .post("/login-attempt")
      .set("X-Forwarded-For", "203.0.113.11");

    expect(blocked.status).toBe(429);
    expect(otherIp.status).toBe(401);
  });
});
