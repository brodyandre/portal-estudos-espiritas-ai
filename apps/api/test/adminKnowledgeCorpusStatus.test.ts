import { createHash } from "node:crypto";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import {
  createGovernedCorpusService,
  GovernedCorpusError,
  governedCorpusService,
  resetGovernedCorpusServiceForTesting,
  type GovernedCorpusLoadedDocument,
  type GovernedCorpusOperationalStatus,
} from "../src/knowledge/governedCorpus";
import type {
  KnowledgeEditorialManifest,
  KnowledgeManifestSource,
} from "../src/knowledge/manifest";
import { resetAuthStore } from "../src/modules/auth/auth.service";

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
  lastAttemptAt: "2026-07-17T01:00:00.000Z",
  lastSuccessfulBuildAt: "2026-07-17T01:00:01.000Z",
  lastFailure: null,
  ...overrides,
});

const buildSource = (documentId: string, filePath: string, documentVersion: number): KnowledgeManifestSource => ({
  manifestSourceId: `${documentId}:${documentVersion}:${filePath}`,
  documentId,
  bookId: "book-emmanuel",
  catalogKey: documentId,
  documentTitle: documentId,
  bookTitle: "Emmanuel",
  bookSlug: "emmanuel",
  documentVersion,
  filePath,
  type: "tema",
  description: "Descricao editorial",
  summary: "Resumo editorial",
  tags: ["estudo"],
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  origin: "catalog",
});

const buildManifest = (sources: KnowledgeManifestSource[]): KnowledgeEditorialManifest => {
  const canonical = JSON.stringify(sources.map((source) => ({
    documentId: source.documentId,
    filePath: source.filePath,
    documentVersion: source.documentVersion,
  })));

  return {
    schemaVersion: 1,
    fingerprint: createHash("sha256").update(canonical).digest("hex"),
    sources,
  };
};

const buildLoadedDocument = (
  manifest: KnowledgeEditorialManifest,
  source: KnowledgeManifestSource,
): GovernedCorpusLoadedDocument => {
  const content = `# ${source.documentTitle}\n\nConteudo autoral governado para ${source.documentId}.`;

  return {
    contentHash: createHash("sha256").update(content).digest("hex"),
    document: {
      id: source.documentId,
      title: source.documentTitle,
      group: "Emmanuel",
      book: source.bookTitle,
      source: source.filePath,
      sourceLabel: source.filePath,
      filename: source.filePath.slice(source.filePath.lastIndexOf("/") + 1),
      path: source.filePath,
      type: source.type,
      tags: [...source.tags],
      description: source.description,
      sensitiveTopics: [...source.sensitiveTopics],
      teacherReviewRecommended: source.teacherReviewRecommended,
      purpose: "apoio para respostas simples",
      content,
      rawContent: content,
      frontmatter: {
        title: source.documentTitle,
        group: "Emmanuel",
        purpose: "apoio para respostas simples",
        source: source.filePath,
      },
      charCount: content.length,
      wordCount: content.split(/\s+/u).length,
      editorial: {
        manifestFingerprint: manifest.fingerprint,
        manifestSourceId: source.manifestSourceId,
        documentId: source.documentId,
        bookId: source.bookId,
        catalogKey: source.catalogKey,
        documentTitle: source.documentTitle,
        bookTitle: source.bookTitle,
        bookSlug: source.bookSlug,
        documentVersion: source.documentVersion,
        origin: "catalog",
      },
    },
  };
};

describe("admin knowledge corpus status", () => {
  beforeEach(() => {
    resetAuthStore();
    resetGovernedCorpusServiceForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGovernedCorpusServiceForTesting();
  });

  it("exige autenticacao e papel admin", async () => {
    const studentToken = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const teacherToken = await loginAs("professor.demo@example.com", "ProfessorDemo@123");

    const anonymousResponse = await request(app).get("/api/admin/knowledge/corpus/status");
    const studentResponse = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${studentToken}`);
    const teacherResponse = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(anonymousResponse.status).toBe(401);
    expect(anonymousResponse.body.error.code).toBe("AUTH_REQUIRED");
    expect(studentResponse.status).toBe(403);
    expect(studentResponse.body.error.code).toBe("FORBIDDEN");
    expect(teacherResponse.status).toBe(403);
    expect(teacherResponse.body.error.code).toBe("FORBIDDEN");
  });

  it("retorna o estado inicial em envelope padronizado para admin", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const getSnapshot = vi.spyOn(governedCorpusService, "getSnapshot");

    const response = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Estado operacional do corpus governado consultado com sucesso.",
      data: {
        state: "not_built",
        rebuilding: false,
        stale: false,
        manifestSourceCount: 0,
        documentCount: 0,
        chunkCount: 0,
        manifestFingerprint: null,
        corpusFingerprint: null,
        lastAttemptAt: null,
        lastSuccessfulBuildAt: null,
        lastFailure: null,
      },
    });
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    ["ready", buildStatus({ state: "ready" })],
    ["empty", buildStatus({ state: "empty", documentCount: 0, chunkCount: 0 })],
    ["invalid", buildStatus({
      state: "invalid",
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
        occurredAt: "2026-07-17T01:00:02.000Z",
      },
    })],
    ["unavailable", buildStatus({
      state: "unavailable",
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
        occurredAt: "2026-07-17T01:00:03.000Z",
      },
    })],
    ["rebuilding", buildStatus({ rebuilding: true })],
    ["stale", buildStatus({
      state: "unavailable",
      stale: true,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
        occurredAt: "2026-07-17T01:00:04.000Z",
      },
    })],
  ])("serializa estado %s sem campos internos", async (_caseName, status) => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const unsafeStatus = {
      ...status,
      absolutePath: "/tmp/nao-expor.md",
      content: "conteudo nao pode vazar",
      stack: "stack nao pode vazar",
      lastFailure: status.lastFailure
        ? {
            ...status.lastFailure,
            message: "mensagem crua nao pode vazar",
          }
        : null,
    } as GovernedCorpusOperationalStatus;
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(unsafeStatus);

    const response = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      state: status.state,
      rebuilding: status.rebuilding,
      stale: status.stale,
      manifestSourceCount: status.manifestSourceCount,
      documentCount: status.documentCount,
      chunkCount: status.chunkCount,
      manifestFingerprint: status.manifestFingerprint,
      corpusFingerprint: status.corpusFingerprint,
      lastAttemptAt: status.lastAttemptAt,
      lastSuccessfulBuildAt: status.lastSuccessfulBuildAt,
      lastFailure: status.lastFailure,
    });
    expect(JSON.stringify(response.body)).not.toContain("/tmp/nao-expor.md");
    expect(JSON.stringify(response.body)).not.toContain("conteudo nao pode vazar");
    expect(JSON.stringify(response.body)).not.toContain("stack nao pode vazar");
    expect(JSON.stringify(response.body)).not.toContain("mensagem crua nao pode vazar");
  });

  it("nao altera o estado nem dispara construcao ao consultar o status", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const status = buildStatus();
    const getOperationalStatus = vi
      .spyOn(governedCorpusService, "getOperationalStatus")
      .mockReturnValue(status);
    const getSnapshot = vi.spyOn(governedCorpusService, "getSnapshot");

    const first = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${token}`);
    const second = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${token}`);

    expect(first.body.data).toEqual(second.body.data);
    expect(first.body.data.lastAttemptAt).toBe("2026-07-17T01:00:00.000Z");
    expect(getOperationalStatus).toHaveBeenCalledTimes(2);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("serializa erro desconhecido sanitizado sem expor codigo ou detalhes arbitrarios", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const arbitraryError = Object.assign(new Error("detalhe interno"), {
      code: "EXTERNAL_DEPENDENCY_SECRET_FAILURE",
      name: "ExternalDependencySecretError",
      stack: "stack com segredo",
      cause: { absolutePath: "/tmp/segredo.md" },
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => {
        throw arbitraryError;
      },
      loadDocumentEntries: async () => [],
      now: (() => {
        const values = [
          "2026-07-17T01:01:00.000Z",
          "2026-07-17T01:01:01.000Z",
        ];
        let index = 0;

        return () => {
          const value = values[Math.min(index, values.length - 1)];
          index += 1;
          return new Date(value);
        };
      })(),
    });

    await expect(service.getSnapshot()).rejects.toBe(arbitraryError);
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(
      service.getOperationalStatus(),
    );

    const response = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${token}`);
    const serializedBody = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Estado operacional do corpus governado consultado com sucesso.",
      data: {
        state: "unavailable",
        rebuilding: false,
        stale: false,
        manifestSourceCount: 0,
        documentCount: 0,
        chunkCount: 0,
        manifestFingerprint: null,
        corpusFingerprint: null,
        lastAttemptAt: "2026-07-17T01:01:00.000Z",
        lastSuccessfulBuildAt: null,
        lastFailure: {
          code: "GOVERNED_CORPUS_UNKNOWN_ERROR",
          occurredAt: "2026-07-17T01:01:01.000Z",
        },
      },
    });
    expect(serializedBody).not.toContain("EXTERNAL_DEPENDENCY_SECRET_FAILURE");
    expect(serializedBody).not.toContain("detalhe interno");
    expect(serializedBody).not.toContain("ExternalDependencySecretError");
    expect(serializedBody).not.toContain("stack com segredo");
    expect(serializedBody).not.toContain("/tmp/segredo.md");
    expect(serializedBody).not.toContain("cause");
  });

  it("serializa campos do ultimo snapshot publicado quando tentativa posterior falha com manifesto diferente", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const publishedSource = buildSource("doc-publicado", "data/knowledge/emmanuel/publicado.md", 1);
    const failedSource = buildSource("doc-falha", "data/knowledge/emmanuel/falha.md", 2);
    const publishedManifest = buildManifest([publishedSource]);
    const failedManifest = buildManifest([publishedSource, failedSource]);
    const manifests = [publishedManifest, failedManifest];
    const service = createGovernedCorpusService({
      loadManifest: async () => ({
        status: "ready",
        manifest: manifests.shift() ?? failedManifest,
        issues: [],
      }),
      loadDocumentEntries: async (manifest) => {
        if (manifest.fingerprint === failedManifest.fingerprint) {
          throw new GovernedCorpusError(
            "GOVERNED_CORPUS_DOCUMENT_INVALID",
            "Documento invalido no teste.",
          );
        }

        return manifest.sources.map((source) => buildLoadedDocument(manifest, source));
      },
      now: (() => {
        const values = [
          "2026-07-17T01:02:00.000Z",
          "2026-07-17T01:02:01.000Z",
          "2026-07-17T01:02:02.000Z",
          "2026-07-17T01:02:03.000Z",
        ];
        let index = 0;

        return () => {
          const value = values[Math.min(index, values.length - 1)];
          index += 1;
          return new Date(value);
        };
      })(),
    });

    await service.getSnapshot();
    const publishedStatus = service.getOperationalStatus();
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
    });
    vi.spyOn(governedCorpusService, "getOperationalStatus").mockReturnValue(
      service.getOperationalStatus(),
    );

    const response = await request(app)
      .get("/api/admin/knowledge/corpus/status")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Estado operacional do corpus governado consultado com sucesso.",
      data: {
        state: "invalid",
        rebuilding: false,
        stale: true,
        manifestSourceCount: publishedStatus.manifestSourceCount,
        documentCount: publishedStatus.documentCount,
        chunkCount: publishedStatus.chunkCount,
        manifestFingerprint: publishedStatus.manifestFingerprint,
        corpusFingerprint: publishedStatus.corpusFingerprint,
        lastAttemptAt: "2026-07-17T01:02:02.000Z",
        lastSuccessfulBuildAt: publishedStatus.lastSuccessfulBuildAt,
        lastFailure: {
          code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
          occurredAt: "2026-07-17T01:02:03.000Z",
        },
      },
    });
    expect(response.body.data.manifestSourceCount).toBe(1);
    expect(response.body.data.manifestSourceCount).not.toBe(2);
    expect(response.body.data.manifestFingerprint).not.toBe(failedManifest.fingerprint);
  });

  it("mantem /health publico sem detalhes do corpus", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(JSON.stringify(response.body)).not.toContain("manifestFingerprint");
    expect(JSON.stringify(response.body)).not.toContain("corpusFingerprint");
    expect(JSON.stringify(response.body)).not.toContain("rebuilding");
  });
});
