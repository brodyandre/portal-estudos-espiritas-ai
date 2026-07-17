import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import {
  GovernedCorpusError,
  GovernedCorpusRebuildInProgressError,
  governedCorpusService,
  resetGovernedCorpusServiceForTesting,
  type GovernedCorpusOperationalStatus,
} from "../src/knowledge/governedCorpus";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import {
  getMemoryKnowledgeCorpusRebuildAuditLogsForTesting,
  resetKnowledgeCorpusRebuildAuditRepositoryForTesting,
  setKnowledgeCorpusRebuildAuditRepositoryForTesting,
  type KnowledgeCorpusRebuildAuditEntry,
} from "../src/modules/admin/knowledge/corpus-rebuild.audit";
import { resetAuthRateLimitStore } from "../src/security/auth-rate-limit";

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const buildStatus = (
  overrides: Partial<GovernedCorpusOperationalStatus> = {},
): GovernedCorpusOperationalStatus => ({
  state: "ready",
  rebuilding: false,
  stale: false,
  manifestSourceCount: 2,
  documentCount: 2,
  chunkCount: 14,
  manifestFingerprint: "manifest-fingerprint-admin",
  corpusFingerprint: "corpus-fingerprint-admin",
  lastAttemptAt: "2026-07-17T03:00:00.000Z",
  lastSuccessfulBuildAt: "2026-07-17T03:00:01.000Z",
  lastFailure: null,
  ...overrides,
});

const mockSuccessfulRebuild = (
  status: GovernedCorpusOperationalStatus = buildStatus(),
) => {
  vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(status);
  vi.spyOn(governedCorpusService, "rebuildSnapshot").mockResolvedValue({} as never);
};

const expectSanitized = (body: unknown) => {
  const serialized = JSON.stringify(body);

  expect(serialized).not.toContain("data/knowledge");
  expect(serialized).not.toContain("/tmp/");
  expect(serialized).not.toContain("frontmatter");
  expect(serialized).not.toContain("stack");
  expect(serialized).not.toContain("Error:");
  expect(serialized).not.toContain("conteudo");
};

describe("admin knowledge corpus rebuild", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAuthRateLimitStore();
    resetGovernedCorpusServiceForTesting();
    resetKnowledgeCorpusRebuildAuditRepositoryForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAuthStore();
    resetAuthRateLimitStore();
    resetGovernedCorpusServiceForTesting();
    resetKnowledgeCorpusRebuildAuditRepositoryForTesting();
  });

  it("exige autenticacao e papel admin", async () => {
    const studentToken = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const teacherToken = await loginAs("professor.demo@example.com", "ProfessorDemo@123");

    const anonymousResponse = await request(app).post("/api/admin/knowledge/corpus/rebuild");
    const invalidTokenResponse = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", "Bearer token-invalido");
    const studentResponse = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${studentToken}`);
    const teacherResponse = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(anonymousResponse.status).toBe(401);
    expect(anonymousResponse.body.error.code).toBe("AUTH_REQUIRED");
    expect(invalidTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.body.error.code).toBe("AUTH_REQUIRED");
    expect(studentResponse.status).toBe(403);
    expect(studentResponse.body.error.code).toBe("FORBIDDEN");
    expect(teacherResponse.status).toBe(403);
    expect(teacherResponse.body.error.code).toBe("FORBIDDEN");
    expect(getMemoryKnowledgeCorpusRebuildAuditLogsForTesting()).toHaveLength(0);
  });

  it("aceita body ausente e retorna status em envelope padronizado", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const status = buildStatus();
    mockSuccessfulRebuild(status);

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Corpus governado reconstruido com sucesso.",
      data: {
        status,
      },
    });
    expect(governedCorpusService.rebuildSnapshot).toHaveBeenCalledTimes(1);
  });

  it("aceita body vazio exatamente {}", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    mockSuccessfulRebuild();

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
  });

  it.each([
    ["propriedade extra", { force: true }],
    ["array", []],
  ])("rejeita body invalido: %s", async (_caseName, body) => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const rebuild = vi.spyOn(governedCorpusService, "rebuildSnapshot");

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_KNOWLEDGE_CORPUS_REBUILD_INPUT");
    expect(rebuild).not.toHaveBeenCalled();
    expect(getMemoryKnowledgeCorpusRebuildAuditLogsForTesting()).toHaveLength(0);
  });

  it("rejeita body null explicito", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const rebuild = vi.spyOn(governedCorpusService, "rebuildSnapshot");

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send("null");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_KNOWLEDGE_CORPUS_REBUILD_INPUT");
    expect(rebuild).not.toHaveBeenCalled();
    expect(getMemoryKnowledgeCorpusRebuildAuditLogsForTesting()).toHaveLength(0);
  });

  it.each([
    "/api/admin/knowledge/corpus/rebuild?force=true",
    "/api/admin/knowledge/corpus/rebuild?sourceIds=a&sourceIds=b",
  ])("rejeita query invalida em %s", async (path) => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const rebuild = vi.spyOn(governedCorpusService, "rebuildSnapshot");

    const response = await request(app)
      .post(path)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_KNOWLEDGE_CORPUS_REBUILD_INPUT");
    expect(rebuild).not.toHaveBeenCalled();
    expect(getMemoryKnowledgeCorpusRebuildAuditLogsForTesting()).toHaveLength(0);
  });

  it("retorna sucesso para corpus empty", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const status = buildStatus({
      state: "empty",
      manifestSourceCount: 0,
      documentCount: 0,
      chunkCount: 0,
    });
    mockSuccessfulRebuild(status);

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.status.state).toBe("empty");
    expect(response.body.data.status.documentCount).toBe(0);
  });

  it("mapeia falha deterministica para KNOWLEDGE_CORPUS_INVALID sem vazar detalhes", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(buildStatus({
      state: "invalid",
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
        occurredAt: "2026-07-17T03:01:00.000Z",
      },
    }));
    vi.spyOn(governedCorpusService, "rebuildSnapshot").mockRejectedValue(
      new GovernedCorpusError(
        "GOVERNED_CORPUS_DOCUMENT_INVALID",
        "frontmatter invalido em data/knowledge/segredo.md",
      ),
    );

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_INVALID");
    expectSanitized(response.body);
  });

  it("mapeia indisponibilidade fisica para KNOWLEDGE_CORPUS_UNAVAILABLE", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(buildStatus({
      state: "unavailable",
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
        occurredAt: "2026-07-17T03:02:00.000Z",
      },
    }));
    vi.spyOn(governedCorpusService, "rebuildSnapshot").mockRejectedValue(
      new GovernedCorpusError(
        "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
        "falha em /tmp/repositorio/data/knowledge/segredo.md",
      ),
    );

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_UNAVAILABLE");
    expectSanitized(response.body);
  });

  it("retorna conflito 409 e audita tentativa rejeitada pelo lock", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(buildStatus());
    vi.spyOn(governedCorpusService, "rebuildSnapshot").mockRejectedValue(
      new GovernedCorpusRebuildInProgressError(),
    );

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const auditLogs = getMemoryKnowledgeCorpusRebuildAuditLogsForTesting();

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_REBUILD_IN_PROGRESS");
    expect(auditLogs.map((entry) => entry.action)).toEqual([
      "KNOWLEDGE_CORPUS_REBUILD_FAILED",
      "KNOWLEDGE_CORPUS_REBUILD_REQUESTED",
    ]);
    expect(auditLogs[0]?.note).toContain("code=KNOWLEDGE_CORPUS_REBUILD_IN_PROGRESS");
  });

  it("aplica rate limit dedicado com Retry-After e nao audita 429", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    mockSuccessfulRebuild();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request(app)
        .post("/api/admin/knowledge/corpus/rebuild")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(response.status).toBe(200);
    }
    const auditCountBefore429 = getMemoryKnowledgeCorpusRebuildAuditLogsForTesting().length;

    const blocked = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.body.error.code).toBe("ADMIN_KNOWLEDGE_CORPUS_REBUILD_RATE_LIMITED");
    expect(getMemoryKnowledgeCorpusRebuildAuditLogsForTesting()).toHaveLength(auditCountBefore429);
  });

  it("registra auditoria REQUESTED e SUCCEEDED com correlationId e metadados sanitizados", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    mockSuccessfulRebuild(buildStatus({
      manifestSourceCount: 1,
      documentCount: 1,
      chunkCount: 7,
      corpusFingerprint: "fingerprint-nao-deve-ir-para-auditoria",
    }));

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const auditLogs = getMemoryKnowledgeCorpusRebuildAuditLogsForTesting();
    const serializedAudit = JSON.stringify(auditLogs);
    const correlationIds = auditLogs.map((entry) => entry.note.match(/correlationId=([^;]+)/)?.[1]);

    expect(response.status).toBe(200);
    expect(auditLogs.map((entry) => entry.action)).toEqual([
      "KNOWLEDGE_CORPUS_REBUILD_SUCCEEDED",
      "KNOWLEDGE_CORPUS_REBUILD_REQUESTED",
    ]);
    expect(new Set(correlationIds).size).toBe(1);
    expect(auditLogs[0]).toEqual(expect.objectContaining({
      actorName: "Admin Demonstrativo",
      actorRole: "admin",
      entity: "KnowledgeCorpus governed",
    }));
    expect(auditLogs[0]?.note).toContain("result=succeeded");
    expect(auditLogs[0]?.note).toContain("durationMs=");
    expect(auditLogs[0]?.note).toContain("finalState=ready");
    expect(auditLogs[0]?.note).toContain("documentCount=1");
    expect(serializedAudit).not.toContain("data/knowledge");
    expect(serializedAudit).not.toContain("frontmatter");
    expect(serializedAudit).not.toContain("fingerprint-nao-deve-ir-para-auditoria");
    expect(serializedAudit).not.toContain("stack");
  });

  it("falha da auditoria REQUESTED impede execucao fisica", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const rebuild = vi.spyOn(governedCorpusService, "rebuildSnapshot");
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(buildStatus());
    setKnowledgeCorpusRebuildAuditRepositoryForTesting({
      async create() {
        throw new Error("falha audit requested");
      },
    });

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_REBUILD_AUDIT_UNAVAILABLE");
    expect(rebuild).not.toHaveBeenCalled();
    expectSanitized(response.body);
  });

  it("falha da auditoria SUCCEEDED retorna 503 sem desfazer sucesso fisico", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const rebuild = vi.spyOn(governedCorpusService, "rebuildSnapshot").mockResolvedValue({} as never);
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(buildStatus());
    let calls = 0;
    const entries: KnowledgeCorpusRebuildAuditEntry[] = [];
    setKnowledgeCorpusRebuildAuditRepositoryForTesting({
      async create(entry) {
        calls += 1;
        entries.unshift({ ...entry });
        if (calls === 2) {
          throw new Error("falha audit succeeded");
        }
      },
    });

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_REBUILD_AUDIT_UNAVAILABLE");
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(entries.map((entry) => entry.action)).toEqual([
      "KNOWLEDGE_CORPUS_REBUILD_SUCCEEDED",
      "KNOWLEDGE_CORPUS_REBUILD_REQUESTED",
    ]);
  });

  it("falha da auditoria FAILED retorna 503 e preserva falha fisica", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const rebuild = vi.spyOn(governedCorpusService, "rebuildSnapshot").mockRejectedValue(
      new GovernedCorpusError("GOVERNED_CORPUS_MANIFEST_INVALID", "manifesto interno invalido"),
    );
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(buildStatus({
      state: "invalid",
      lastFailure: {
        code: "GOVERNED_CORPUS_MANIFEST_INVALID",
        occurredAt: "2026-07-17T03:03:00.000Z",
      },
    }));
    let calls = 0;
    setKnowledgeCorpusRebuildAuditRepositoryForTesting({
      async create() {
        calls += 1;
        if (calls === 2) {
          throw new Error("falha audit failed");
        }
      },
    });

    const response = await request(app)
      .post("/api/admin/knowledge/corpus/rebuild")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_REBUILD_AUDIT_UNAVAILABLE");
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it("GET de status e health permanecem sem efeito de rebuild", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const rebuild = vi.spyOn(governedCorpusService, "rebuildSnapshot");

    const statusResponse = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${token}`);
    const healthResponse = await request(app).get("/health");

    expect(statusResponse.status).toBe(200);
    expect(healthResponse.status).toBe(200);
    expect(JSON.stringify(healthResponse.body)).not.toContain("corpusFingerprint");
    expect(rebuild).not.toHaveBeenCalled();
  });
});
