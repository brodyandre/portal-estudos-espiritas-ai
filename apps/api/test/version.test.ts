import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import {
  resetReadinessDependenciesForTesting,
  setReadinessDependenciesForTesting,
} from "../src/routes/readiness.routes";
import { resolveRevisionMetadata } from "../src/routes/version.routes";

const VALID_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_SHA_UPPERCASE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("revision metadata", () => {
  it("retorna SHA completo valido", () => {
    expect(resolveRevisionMetadata({ RENDER_GIT_COMMIT: VALID_SHA })).toEqual({
      revision: VALID_SHA,
    });
  });

  it("normaliza SHA valido em uppercase", () => {
    expect(resolveRevisionMetadata({ RENDER_GIT_COMMIT: VALID_SHA_UPPERCASE })).toEqual({
      revision: VALID_SHA,
    });
  });

  it.each([
    ["variavel ausente", undefined],
    ["string vazia", ""],
    ["apenas espacos", "   "],
    ["SHA curto", "aaaaaaaa"],
    ["caracter nao hexadecimal", "gggggggggggggggggggggggggggggggggggggggg"],
    ["conteudo malicioso", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa<script>"],
  ])("retorna unknown para %s", (_caseName, value) => {
    expect(resolveRevisionMetadata({ RENDER_GIT_COMMIT: value })).toEqual({
      revision: "unknown",
    });
  });
});

describe("GET /version", () => {
  afterEach(() => {
    resetReadinessDependenciesForTesting();
  });

  it("retorna HTTP 200 com envelope publico e fallback seguro", async () => {
    const response = await request(app).get("/version");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({
      success: true,
      message: "Metadata de revisão da API carregada com sucesso.",
      data: {
        revision: "unknown",
      },
    });
  });

  it("retorna revision validada sem expor outras env vars ou sentinelas", async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      RENDER_GIT_COMMIT: VALID_SHA,
      RENDER_GIT_BRANCH: "main",
      DATABASE_URL: "postgresql://SECRET_SENTINEL",
      JWT_SECRET: "JWT_SECRET_SENTINEL",
      SMTP_PASSWORD: "SMTP_SECRET_SENTINEL",
      GROQ_API_KEY: "GROQ_SECRET_SENTINEL",
    };

    try {
      const response = await request(app).get("/version");
      const serializedBody = JSON.stringify(response.body);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        revision: VALID_SHA,
      });
      expect(Object.keys(response.body.data)).toEqual(["revision"]);
      expect(serializedBody).not.toContain("RENDER_GIT_BRANCH");
      expect(serializedBody).not.toContain("main");
      expect(serializedBody).not.toContain("SECRET_SENTINEL");
      expect(serializedBody).not.toContain("JWT_SECRET_SENTINEL");
      expect(serializedBody).not.toContain("SMTP_SECRET_SENTINEL");
      expect(serializedBody).not.toContain("GROQ_SECRET_SENTINEL");
    } finally {
      process.env = originalEnv;
    }
  });

  it("nao reflete valor invalido de RENDER_GIT_COMMIT", async () => {
    const originalEnv = process.env;
    const invalidRevision = "not-a-sha-SECRET_SENTINEL";
    process.env = {
      ...originalEnv,
      RENDER_GIT_COMMIT: invalidRevision,
    };

    try {
      const response = await request(app).get("/version");
      const serializedBody = JSON.stringify(response.body);

      expect(response.status).toBe(200);
      expect(response.body.data.revision).toBe("unknown");
      expect(serializedBody).not.toContain(invalidRevision);
      expect(serializedBody).not.toContain("SECRET_SENTINEL");
    } finally {
      process.env = originalEnv;
    }
  });

  it("/health permanece com o contrato operacional consolidado", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("API funcionando normalmente.");
    expect(response.body.data.status).toBe("ok");
    expect(typeof response.body.data.timestamp).toBe("string");
    expect(typeof response.body.data.uptimeSeconds).toBe("number");
    expect(response.body.data.revision).toBeUndefined();
  });

  it("/ready permanece fora do envelope padronizado e sem revision", async () => {
    setReadinessDependenciesForTesting({
      checkDatabase: async () => "ok",
      getCorpusStatus: () => ({
        state: "ready",
        rebuilding: false,
        stale: false,
        manifestSourceCount: 1,
        documentCount: 1,
        chunkCount: 5,
        manifestFingerprint: "manifest-fingerprint-that-must-not-leak",
        corpusFingerprint: "corpus-fingerprint-that-must-not-leak",
        lastAttemptAt: "2026-08-11T20:00:00.000Z",
        lastSuccessfulBuildAt: "2026-08-11T20:00:01.000Z",
        lastFailure: null,
      }),
    });

    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.success).toBeUndefined();
    expect(response.body.data).toBeUndefined();
    expect(response.body.revision).toBeUndefined();
    expect(response.body.checks).toEqual(
      expect.objectContaining({
        database: expect.objectContaining({
          status: expect.any(String),
        }),
        corpus: expect.objectContaining({
          status: expect.any(String),
        }),
      }),
    );
  });
});
