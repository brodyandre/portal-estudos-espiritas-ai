import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGovernedCorpusService,
  GovernedCorpusError,
  GovernedCorpusRebuildInProgressError,
} from "../src/knowledge/governedCorpus";
import {
  buildKnowledgeEditorialManifest,
  createKnowledgeManifestFromCandidates,
  type KnowledgeEditorialManifest,
  type KnowledgeManifestCatalogCandidate,
} from "../src/knowledge/manifest";
import {
  loadKnowledgeDocumentsWithContentHashesFromManifest,
} from "../src/rag/documentLoader";

const tempRoots: string[] = [];

const markdownContent = (title = "Documento seguro", body = "Conteudo autoral curto para validar corpus governado.") => `---
title: "${title}"
group: "Emmanuel"
purpose: "apoio para respostas simples"
source: "resumo autoral demonstrativo produzido para o portal"
---

# ${title}

${body}
`;

const createRepositoryRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "governed-corpus-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "data", "knowledge"), { recursive: true });
  return root;
};

const writeKnowledgeFile = async (
  root: string,
  relativePath: string,
  content: string | Buffer = markdownContent(),
) => {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
};

const buildCandidate = (
  overrides: Partial<KnowledgeManifestCatalogCandidate> = {},
): KnowledgeManifestCatalogCandidate => ({
  documentId: "doc-approved",
  bookId: "book-emmanuel",
  catalogKey: "emmanuel-approved",
  filePath: "data/knowledge/emmanuel/aprovado.md",
  documentTitle: "Documento aprovado",
  description: "Descricao editorial",
  summary: "Resumo editorial",
  type: "tema",
  tags: ["Estudo", "Emmanuel"],
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  editorialStatus: "approved",
  documentVersion: 1,
  documentSortOrder: 1,
  documentUpdatedAt: "2026-07-16T10:00:00.000Z",
  book: {
    id: "book-emmanuel",
    slug: "emmanuel",
    title: "Emmanuel",
    status: "active",
    sortOrder: 1,
    version: 1,
    updatedAt: "2026-07-16T09:00:00.000Z",
  },
  ...overrides,
});

const buildManifestResult = (
  root: string,
  candidates: KnowledgeManifestCatalogCandidate[],
) =>
  buildKnowledgeEditorialManifest({
    repository: { listManifestCandidates: async () => candidates },
    filesystem: { repositoryRoot: root },
  });

const loadDocumentEntriesFromRoot = (root: string) => (manifest: KnowledgeEditorialManifest) =>
  loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });

const buildValidContentHash = (value = "fixture") =>
  createHash("sha256").update(Buffer.from(value)).digest("hex");

const createServiceForCandidates = (
  root: string,
  candidates: KnowledgeManifestCatalogCandidate[],
) =>
  createGovernedCorpusService({
    loadManifest: () => buildManifestResult(root, candidates),
    loadDocumentEntries: loadDocumentEntriesFromRoot(root),
  });

const createClock = (values: string[]) => {
  let index = 0;

  return vi.fn(() => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return new Date(value);
  });
};

const createDeferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const markdownBytesWithInvalidBody = (invalidBytes: Buffer) =>
  Buffer.concat([
    Buffer.from(`---
title: "Aprovado"
group: "Emmanuel"
purpose: "apoio para respostas simples"
source: "resumo autoral demonstrativo produzido para o portal"
---

# Aprovado

Conteudo fisico `, "utf8"),
    invalidBytes,
    Buffer.from(" preservado para validar hash por bytes.\n", "utf8"),
  ]);

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("governed corpus service", () => {
  it("inicia com estado operacional not_built imutavel e leitura em memoria sem acionar loaders", () => {
    const loadManifest = vi.fn(async () => ({
      status: "unavailable" as const,
      reason: "catalog_unavailable" as const,
      issues: [],
    }));
    const loadDocumentEntries = vi.fn(async () => []);
    const service = createGovernedCorpusService({ loadManifest, loadDocumentEntries });

    const status = service.getOperationalStatus();

    expect(status).toEqual({
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
    });
    expect(Object.isFrozen(status)).toBe(true);
    expect(() => {
      (status as { state: string }).state = "ready";
    }).toThrow();
    expect(loadManifest).not.toHaveBeenCalled();
    expect(loadDocumentEntries).not.toHaveBeenCalled();
  });

  it("registra estado ready com timestamps determinísticos apos publicar snapshot com documentos", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
      now: createClock([
        "2026-07-17T01:00:00.000Z",
        "2026-07-17T01:00:01.000Z",
      ]),
    });

    const snapshot = await service.getSnapshot();
    const status = service.getOperationalStatus();

    expect(status).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      manifestSourceCount: 1,
      documentCount: 1,
      manifestFingerprint: snapshot.manifestFingerprint,
      corpusFingerprint: snapshot.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:00:00.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:00:01.000Z",
      lastFailure: null,
    });
    expect(status.chunkCount).toBeGreaterThan(0);
  });

  it("registra estado empty para manifesto valido sem fontes elegiveis", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/orfao.md");
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, []),
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
      now: createClock([
        "2026-07-17T01:01:00.000Z",
        "2026-07-17T01:01:01.000Z",
      ]),
    });

    const snapshot = await service.getSnapshot();

    expect(service.getOperationalStatus()).toMatchObject({
      state: "empty",
      stale: false,
      manifestSourceCount: 0,
      documentCount: 0,
      chunkCount: 0,
      manifestFingerprint: snapshot.manifestFingerprint,
      corpusFingerprint: snapshot.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:01:00.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:01:01.000Z",
      lastFailure: null,
    });
  });

  it("em cache hit atualiza ultima tentativa sem alterar ultimo build publicado", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
      now: createClock([
        "2026-07-17T01:02:00.000Z",
        "2026-07-17T01:02:01.000Z",
        "2026-07-17T01:02:02.000Z",
      ]),
    });

    const first = await service.getSnapshot();
    const firstStatus = service.getOperationalStatus();
    const second = await service.getSnapshot();
    const secondStatus = service.getOperationalStatus();

    expect(second).toBe(first);
    expect(firstStatus.lastSuccessfulBuildAt).toBe("2026-07-17T01:02:01.000Z");
    expect(secondStatus.lastAttemptAt).toBe("2026-07-17T01:02:02.000Z");
    expect(secondStatus.lastSuccessfulBuildAt).toBe("2026-07-17T01:02:01.000Z");
    expect(secondStatus.lastFailure).toBeNull();
  });

  it("classifica falha deterministica como invalid sem stale quando nao havia snapshot anterior", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocumentEntries: async (manifest) => {
        const [entry] = await loadDocumentEntriesFromRoot(root)(manifest);
        return [{ ...entry, contentHash: "abc" }];
      },
      now: createClock([
        "2026-07-17T01:03:00.000Z",
        "2026-07-17T01:03:01.000Z",
      ]),
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
    });

    expect(service.getOperationalStatus()).toEqual({
      state: "invalid",
      rebuilding: false,
      stale: false,
      manifestSourceCount: 0,
      documentCount: 0,
      chunkCount: 0,
      manifestFingerprint: null,
      corpusFingerprint: null,
      lastAttemptAt: "2026-07-17T01:03:00.000Z",
      lastSuccessfulBuildAt: null,
      lastFailure: {
        code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
        occurredAt: "2026-07-17T01:03:01.000Z",
      },
    });
  });

  it("classifica indisponibilidade sem stale quando nao havia snapshot anterior", async () => {
    const service = createGovernedCorpusService({
      loadManifest: async () => ({
        status: "unavailable",
        reason: "catalog_unavailable",
        issues: [{ code: "KNOWLEDGE_MANIFEST_CATALOG_UNAVAILABLE" }],
      }),
      loadDocumentEntries: async () => [],
      now: createClock([
        "2026-07-17T01:04:00.000Z",
        "2026-07-17T01:04:01.000Z",
      ]),
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
    });

    expect(service.getOperationalStatus()).toMatchObject({
      state: "unavailable",
      rebuilding: false,
      stale: false,
      documentCount: 0,
      chunkCount: 0,
      manifestFingerprint: null,
      corpusFingerprint: null,
      lastFailure: {
        code: "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
        occurredAt: "2026-07-17T01:04:01.000Z",
      },
    });
  });

  it("normaliza codigo arbitrario desconhecido sem expor detalhes e recupera depois", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    const arbitraryError = Object.assign(new Error("detalhe interno"), {
      code: "EXTERNAL_DEPENDENCY_SECRET_FAILURE",
      name: "ExternalDependencySecretError",
      cause: { absolutePath: "/tmp/segredo.md" },
    });
    const loadManifest = vi
      .fn()
      .mockRejectedValueOnce(arbitraryError)
      .mockResolvedValueOnce(manifestResult);
    const service = createGovernedCorpusService({
      loadManifest,
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
      now: createClock([
        "2026-07-17T01:04:02.000Z",
        "2026-07-17T01:04:03.000Z",
        "2026-07-17T01:04:04.000Z",
        "2026-07-17T01:04:05.000Z",
      ]),
    });

    await expect(service.getSnapshot()).rejects.toBe(arbitraryError);
    const failedStatus = service.getOperationalStatus();
    const serializedFailedStatus = JSON.stringify(failedStatus);

    expect(failedStatus).toMatchObject({
      state: "unavailable",
      rebuilding: false,
      stale: false,
      lastAttemptAt: "2026-07-17T01:04:02.000Z",
      lastSuccessfulBuildAt: null,
      lastFailure: {
        code: "GOVERNED_CORPUS_UNKNOWN_ERROR",
        occurredAt: "2026-07-17T01:04:03.000Z",
      },
    });
    expect(serializedFailedStatus).not.toContain("EXTERNAL_DEPENDENCY_SECRET_FAILURE");
    expect(serializedFailedStatus).not.toContain("detalhe interno");
    expect(serializedFailedStatus).not.toContain("ExternalDependencySecretError");
    expect(serializedFailedStatus).not.toContain("stack");
    expect(serializedFailedStatus).not.toContain("cause");
    expect(serializedFailedStatus).not.toContain("/tmp/segredo.md");

    await service.getSnapshot();

    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      lastFailure: null,
      lastAttemptAt: "2026-07-17T01:04:04.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:04:05.000Z",
    });
  });

  it("marca stale e preserva diagnostico publicado quando tentativa posterior falha", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadDocumentEntries = vi
      .fn()
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root))
      .mockRejectedValueOnce(new Error("/tmp/caminho-interno.md"));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries,
      now: createClock([
        "2026-07-17T01:05:00.000Z",
        "2026-07-17T01:05:01.000Z",
        "2026-07-17T01:05:02.000Z",
        "2026-07-17T01:05:03.000Z",
      ]),
    });

    await service.getSnapshot();
    const publishedStatus = service.getOperationalStatus();
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });
    const failedStatus = service.getOperationalStatus();

    expect(failedStatus).toMatchObject({
      state: "unavailable",
      rebuilding: false,
      stale: true,
      manifestSourceCount: 1,
      documentCount: publishedStatus.documentCount,
      chunkCount: publishedStatus.chunkCount,
      manifestFingerprint: publishedStatus.manifestFingerprint,
      corpusFingerprint: publishedStatus.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:05:02.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:05:01.000Z",
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
        occurredAt: "2026-07-17T01:05:03.000Z",
      },
    });
    expect(JSON.stringify(failedStatus)).not.toContain("/tmp/caminho-interno.md");
    expect(JSON.stringify(failedStatus)).not.toContain("Falha ao carregar");
    expect(JSON.stringify(failedStatus)).not.toContain("stack");
  });

  it("mantem campos do snapshot publicado quando tentativa invalida observa manifesto com mais fontes", async () => {
    const root = await createRepositoryRoot();
    const publishedPath = "data/knowledge/emmanuel/aprovado.md";
    const extraPath = "data/knowledge/emmanuel/extra.md";
    const publishedCandidate = buildCandidate({
      documentId: "doc-published",
      catalogKey: "published",
      filePath: publishedPath,
      documentTitle: "Publicado",
      documentVersion: 1,
      documentSortOrder: 1,
    });
    const extraCandidate = buildCandidate({
      documentId: "doc-extra",
      catalogKey: "extra",
      filePath: extraPath,
      documentTitle: "Extra",
      documentVersion: 2,
      documentSortOrder: 2,
      documentUpdatedAt: "2026-07-16T11:00:00.000Z",
    });
    await writeKnowledgeFile(root, publishedPath, markdownContent("Publicado", "conteudo inicial valido"));
    await writeKnowledgeFile(root, extraPath, "# Extra\n\nConteudo sem frontmatter obrigatorio.");
    const firstResult = await buildManifestResult(root, [publishedCandidate]);
    const secondResult = await buildManifestResult(root, [publishedCandidate, extraCandidate]);
    const manifests = [firstResult, secondResult, secondResult];
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? secondResult,
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
      now: createClock([
        "2026-07-17T01:05:10.000Z",
        "2026-07-17T01:05:11.000Z",
        "2026-07-17T01:05:12.000Z",
        "2026-07-17T01:05:13.000Z",
        "2026-07-17T01:05:14.000Z",
        "2026-07-17T01:05:15.000Z",
      ]),
    });

    await service.getSnapshot();
    const publishedStatus = service.getOperationalStatus();

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
    });
    const failedStatus = service.getOperationalStatus();

    expect(failedStatus).toMatchObject({
      state: "invalid",
      rebuilding: false,
      stale: true,
      manifestSourceCount: publishedStatus.manifestSourceCount,
      documentCount: publishedStatus.documentCount,
      chunkCount: publishedStatus.chunkCount,
      manifestFingerprint: publishedStatus.manifestFingerprint,
      corpusFingerprint: publishedStatus.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:05:12.000Z",
      lastSuccessfulBuildAt: publishedStatus.lastSuccessfulBuildAt,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
        occurredAt: "2026-07-17T01:05:13.000Z",
      },
    });
    expect(failedStatus.manifestSourceCount).not.toBe(2);

    await writeKnowledgeFile(root, extraPath, markdownContent("Extra", "conteudo recuperado valido"));
    const recovered = await service.getSnapshot();
    const recoveredStatus = service.getOperationalStatus();

    expect(recovered.documentCount).toBe(2);
    expect(recoveredStatus).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      manifestSourceCount: 2,
      documentCount: 2,
      manifestFingerprint: recovered.manifestFingerprint,
      corpusFingerprint: recovered.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:05:14.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:05:15.000Z",
      lastFailure: null,
    });
    expect(recoveredStatus.manifestFingerprint).not.toBe(publishedStatus.manifestFingerprint);
    expect(recoveredStatus.corpusFingerprint).not.toBe(publishedStatus.corpusFingerprint);
    expect(recoveredStatus.lastSuccessfulBuildAt).not.toBe(publishedStatus.lastSuccessfulBuildAt);
  });

  it("mantem campos do snapshot publicado quando tentativa indisponivel observa manifesto com mais fontes", async () => {
    const root = await createRepositoryRoot();
    const publishedPath = "data/knowledge/emmanuel/aprovado.md";
    const missingPath = "data/knowledge/emmanuel/ausente.md";
    const publishedCandidate = buildCandidate({
      documentId: "doc-published",
      catalogKey: "published",
      filePath: publishedPath,
      documentTitle: "Publicado",
      documentVersion: 1,
      documentSortOrder: 1,
    });
    const missingCandidate = buildCandidate({
      documentId: "doc-missing",
      catalogKey: "missing",
      filePath: missingPath,
      documentTitle: "Ausente",
      documentVersion: 2,
      documentSortOrder: 2,
      documentUpdatedAt: "2026-07-16T11:00:00.000Z",
    });
    await writeKnowledgeFile(root, publishedPath, markdownContent("Publicado", "conteudo inicial valido"));
    await writeKnowledgeFile(root, missingPath, markdownContent("Ausente", "conteudo que sera removido"));
    const firstResult = await buildManifestResult(root, [publishedCandidate]);
    const secondResult = await buildManifestResult(root, [publishedCandidate, missingCandidate]);
    const manifests = [firstResult, secondResult];
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? secondResult,
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
      now: createClock([
        "2026-07-17T01:05:20.000Z",
        "2026-07-17T01:05:21.000Z",
        "2026-07-17T01:05:22.000Z",
        "2026-07-17T01:05:23.000Z",
      ]),
    });

    await service.getSnapshot();
    const publishedStatus = service.getOperationalStatus();
    await unlink(path.join(root, missingPath));

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "KNOWLEDGE_FILE_NOT_FOUND",
    });

    expect(service.getOperationalStatus()).toMatchObject({
      state: "unavailable",
      rebuilding: false,
      stale: true,
      manifestSourceCount: publishedStatus.manifestSourceCount,
      documentCount: publishedStatus.documentCount,
      chunkCount: publishedStatus.chunkCount,
      manifestFingerprint: publishedStatus.manifestFingerprint,
      corpusFingerprint: publishedStatus.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:05:22.000Z",
      lastSuccessfulBuildAt: publishedStatus.lastSuccessfulBuildAt,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
        occurredAt: "2026-07-17T01:05:23.000Z",
      },
    });
    expect(service.getOperationalStatus().manifestSourceCount).not.toBe(2);
  });

  it("limpa stale e lastFailure apos recuperacao com snapshot valido", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadDocumentEntries = vi
      .fn()
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root))
      .mockRejectedValueOnce(new Error("falha transitoria"))
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries,
    });

    await service.getSnapshot();
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });
    await service.getSnapshot();

    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      lastFailure: null,
    });
  });

  it("mantem rebuilding true durante promise compartilhada e registra uma unica tentativa", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    let releaseBuild: () => void = () => undefined;
    const buildGate = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      await buildGate;
      return loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocumentEntries,
      now: createClock([
        "2026-07-17T01:06:00.000Z",
        "2026-07-17T01:06:01.000Z",
      ]),
    });

    const first = service.getSnapshot();
    const second = service.getSnapshot();
    await Promise.resolve();
    await Promise.resolve();

    expect(loadDocumentEntries).toHaveBeenCalledTimes(1);
    expect(service.getOperationalStatus()).toMatchObject({
      state: "not_built",
      rebuilding: true,
      lastAttemptAt: "2026-07-17T01:06:00.000Z",
      lastSuccessfulBuildAt: null,
    });

    releaseBuild();
    const secondSnapshot = await second;
    await expect(first).resolves.toBe(secondSnapshot);
    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      rebuilding: false,
      lastAttemptAt: "2026-07-17T01:06:00.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:06:01.000Z",
    });
  });

  it("ignora falha antiga depois de sucesso novo no estado operacional", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/antigo.md", markdownContent("Antigo"));
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/novo.md", markdownContent("Novo"));
    const oldCandidate = buildCandidate({
      documentId: "doc-old",
      catalogKey: "old",
      filePath: "data/knowledge/emmanuel/antigo.md",
      documentTitle: "Antigo",
      documentVersion: 1,
    });
    const newCandidate = buildCandidate({
      documentId: "doc-new",
      catalogKey: "new",
      filePath: "data/knowledge/emmanuel/novo.md",
      documentTitle: "Novo",
      documentVersion: 2,
    });
    const oldResult = await buildManifestResult(root, [oldCandidate]);
    const newResult = await buildManifestResult(root, [newCandidate]);

    if (oldResult.status === "unavailable" || newResult.status === "unavailable") {
      throw new Error("Manifestos de teste deveriam estar disponiveis.");
    }

    const releaseOld = createDeferred();
    const oldStarted = createDeferred();
    const manifests = [oldResult, newResult, oldResult];
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      if (manifest.fingerprint === oldResult.manifest.fingerprint) {
        oldStarted.resolve();
        await releaseOld.promise;
        throw new Error("falha antiga");
      }

      return loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? newResult,
      loadDocumentEntries,
      now: createClock([
        "2026-07-17T01:07:00.000Z",
        "2026-07-17T01:07:01.000Z",
        "2026-07-17T01:07:02.000Z",
        "2026-07-17T01:07:03.000Z",
      ]),
    });

    const oldAttempt = service.getSnapshot();
    await oldStarted.promise;
    const newSnapshot = await service.getSnapshot();
    const repeatedOldAttempt = service.getSnapshot();

    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      manifestSourceCount: 1,
      documentCount: 1,
      manifestFingerprint: newSnapshot.manifestFingerprint,
      corpusFingerprint: newSnapshot.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:07:01.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:07:02.000Z",
      lastFailure: null,
    });

    releaseOld.resolve();
    await expect(oldAttempt).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });
    await expect(repeatedOldAttempt).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });

    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      manifestFingerprint: newSnapshot.manifestFingerprint,
      corpusFingerprint: newSnapshot.corpusFingerprint,
      lastAttemptAt: "2026-07-17T01:07:01.000Z",
      lastSuccessfulBuildAt: "2026-07-17T01:07:02.000Z",
      lastFailure: null,
    });
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it("ignora sucesso antigo depois de falha nova no estado operacional e no cache", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/antigo.md", markdownContent("Antigo"));
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/novo.md", markdownContent("Novo"));
    const oldCandidate = buildCandidate({
      documentId: "doc-old",
      catalogKey: "old",
      filePath: "data/knowledge/emmanuel/antigo.md",
      documentTitle: "Antigo",
      documentVersion: 1,
    });
    const newCandidate = buildCandidate({
      documentId: "doc-new",
      catalogKey: "new",
      filePath: "data/knowledge/emmanuel/novo.md",
      documentTitle: "Novo",
      documentVersion: 2,
    });
    const oldResult = await buildManifestResult(root, [oldCandidate]);
    const newResult = await buildManifestResult(root, [newCandidate]);

    if (oldResult.status === "unavailable" || newResult.status === "unavailable") {
      throw new Error("Manifestos de teste deveriam estar disponiveis.");
    }

    const releaseOld = createDeferred();
    const oldStarted = createDeferred();
    const manifests = [oldResult, newResult, oldResult, oldResult];
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      const entries = await loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });

      if (manifest.fingerprint === oldResult.manifest.fingerprint) {
        oldStarted.resolve();
        await releaseOld.promise;
        return entries;
      }

      return entries.map((entry) => ({ ...entry, contentHash: "abc" }));
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? oldResult,
      loadDocumentEntries,
      now: createClock([
        "2026-07-17T01:08:00.000Z",
        "2026-07-17T01:08:01.000Z",
        "2026-07-17T01:08:02.000Z",
        "2026-07-17T01:08:03.000Z",
      ]),
    });

    const oldAttempt = service.getSnapshot();
    await oldStarted.promise;
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
    });
    const repeatedOldAttempt = service.getSnapshot();

    expect(service.getOperationalStatus()).toEqual({
      state: "invalid",
      rebuilding: false,
      stale: false,
      manifestSourceCount: 0,
      documentCount: 0,
      chunkCount: 0,
      manifestFingerprint: null,
      corpusFingerprint: null,
      lastAttemptAt: "2026-07-17T01:08:01.000Z",
      lastSuccessfulBuildAt: null,
      lastFailure: {
        code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
        occurredAt: "2026-07-17T01:08:02.000Z",
      },
    });

    releaseOld.resolve();
    const oldSnapshot = await oldAttempt;
    await expect(repeatedOldAttempt).resolves.toBe(oldSnapshot);

    expect(service.getOperationalStatus()).toEqual({
      state: "invalid",
      rebuilding: false,
      stale: false,
      manifestSourceCount: 0,
      documentCount: 0,
      chunkCount: 0,
      manifestFingerprint: null,
      corpusFingerprint: null,
      lastAttemptAt: "2026-07-17T01:08:01.000Z",
      lastSuccessfulBuildAt: null,
      lastFailure: {
        code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
        occurredAt: "2026-07-17T01:08:02.000Z",
      },
    });

    const rebuiltOld = await service.getSnapshot();
    expect(rebuiltOld).not.toBe(oldSnapshot);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(3);
  });

  it("reset limpa estado operacional e restaura clock configurado", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const service = createServiceForCandidates(root, [buildCandidate()]);

    await service.getSnapshot();
    expect(service.getOperationalStatus().state).toBe("ready");

    service.resetForTesting();

    expect(service.getOperationalStatus()).toEqual({
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
    });
  });

  it("monta snapshot somente com documentos autorizados e preserva metadados editoriais", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Aprovado"));
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/orfao.md", markdownContent("Orfao"));

    const snapshot = await createServiceForCandidates(root, [buildCandidate()]).getSnapshot();

    expect(snapshot.documentCount).toBe(1);
    expect(snapshot.audit).toEqual({
      manifestStatus: "ready",
      manifestSourceCount: 1,
      loadedDocumentCount: 1,
      nonBlockingIssueCount: 0,
    });
    expect(snapshot.documents[0]).toEqual(
      expect.objectContaining({
        id: "doc-approved",
        title: "Documento aprovado",
        path: "data/knowledge/emmanuel/aprovado.md",
        content: expect.stringContaining("Conteudo autoral curto"),
        editorial: expect.objectContaining({
          documentId: "doc-approved",
          bookId: "book-emmanuel",
          catalogKey: "emmanuel-approved",
          manifestFingerprint: snapshot.manifestFingerprint,
        }),
      }),
    );
    expect(snapshot.documents.some((document) => document.path.endsWith("orfao.md"))).toBe(false);
    expect(snapshot.documents[0]).not.toHaveProperty("absolutePath");
  });

  it("exclui entradas editoriais inelegiveis usando a semantica do manifesto", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/draft.md");

    const service = createServiceForCandidates(root, [
      buildCandidate(),
      buildCandidate({
        documentId: "doc-draft",
        filePath: "data/knowledge/emmanuel/draft.md",
        editorialStatus: "draft",
      }),
    ]);

    const snapshot = await service.getSnapshot();

    expect(snapshot.documents.map((document) => document.id)).toEqual(["doc-approved"]);
    expect(snapshot.audit.nonBlockingIssueCount).toBe(1);
  });

  it("mantem ordenacao deterministica independente da ordem dos candidatos", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/a.md", markdownContent("A"));
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/b.md", markdownContent("B"));

    const docB = buildCandidate({
      documentId: "doc-b",
      filePath: "data/knowledge/emmanuel/b.md",
      documentTitle: "B",
      documentSortOrder: 2,
    });
    const docA = buildCandidate({
      documentId: "doc-a",
      filePath: "data/knowledge/emmanuel/a.md",
      documentTitle: "A",
      documentSortOrder: 1,
    });

    const first = await createServiceForCandidates(root, [docB, docA]).getSnapshot();
    const second = await createServiceForCandidates(root, [docA, docB]).getSnapshot();

    expect(first.documents.map((document) => document.id)).toEqual(["doc-a", "doc-b"]);
    expect(second.documents.map((document) => document.id)).toEqual(["doc-a", "doc-b"]);
    expect(first.manifestFingerprint).toBe(second.manifestFingerprint);
    expect(first.corpusFingerprint).toBe(second.corpusFingerprint);
  });

  it("reutiliza o snapshot pronto quando a identidade composta nao muda", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadDocumentEntries = vi.fn(loadDocumentEntriesFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries,
    });

    const first = await service.getSnapshot();
    const second = await service.getSnapshot();

    expect(second).toBe(first);
    expect(second.cacheKey).toEqual(first.cacheKey);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it("detecta alteracao fisica sem mudanca editorial e publica snapshot novo", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Aprovado", "prece antiga"));
    const loadDocumentEntries = vi.fn(loadDocumentEntriesFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries,
    });

    const first = await service.getSnapshot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Aprovado", "prece nova"));
    const second = await service.getSnapshot();

    expect(second).not.toBe(first);
    expect(second.manifestFingerprint).toBe(first.manifestFingerprint);
    expect(second.corpusFingerprint).not.toBe(first.corpusFingerprint);
    expect(second.documents[0].content).toContain("prece nova");
    expect(second.documents[0].content).not.toContain("prece antiga");
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it("detecta bytes fisicos diferentes mesmo quando decodificam para o mesmo texto", async () => {
    const root = await createRepositoryRoot();
    const relativePath = "data/knowledge/emmanuel/aprovado.md";
    const firstBytes = markdownBytesWithInvalidBody(Buffer.from([0x80]));
    const secondBytes = markdownBytesWithInvalidBody(Buffer.from([0x81]));
    expect(firstBytes.toString("utf8")).toBe(secondBytes.toString("utf8"));
    expect(Buffer.compare(firstBytes, secondBytes)).not.toBe(0);
    await writeKnowledgeFile(root, relativePath, firstBytes);
    const service = createServiceForCandidates(root, [buildCandidate()]);

    const first = await service.getSnapshot();
    await writeKnowledgeFile(root, relativePath, secondBytes);
    const second = await service.getSnapshot();

    expect(second).not.toBe(first);
    expect(second.manifestFingerprint).toBe(first.manifestFingerprint);
    expect(second.documents[0].rawContent).toBe(first.documents[0].rawContent);
    expect(second.corpusFingerprint).not.toBe(first.corpusFingerprint);
  });

  it("reconstroi quando o fingerprint muda e so substitui o cache apos sucesso", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const firstResult = await buildManifestResult(root, [buildCandidate()]);
    const secondResult = await buildManifestResult(root, [buildCandidate({ documentVersion: 2 })]);
    const manifests = [firstResult, secondResult, secondResult];
    const loadDocumentEntries = vi
      .fn()
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root))
      .mockRejectedValueOnce(new Error(`/tmp/${root}/absoluto.md`))
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? secondResult,
      loadDocumentEntries,
    });

    const first = await service.getSnapshot();
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });
    const recovered = await service.getSnapshot();

    expect(recovered).not.toBe(first);
    expect(recovered.manifestFingerprint).toBe(
      secondResult.status !== "unavailable" ? secondResult.manifest.fingerprint : "",
    );
    expect(loadDocumentEntries).toHaveBeenCalledTimes(3);
  });

  it("nao guarda promise rejeitada permanentemente apos falha de construcao", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadDocumentEntries = vi
      .fn()
      .mockRejectedValueOnce(new Error("falha transitoria"))
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries,
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });
    await expect(service.getSnapshot()).resolves.toMatchObject({ documentCount: 1 });
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it("falha fechado quando documento autorizado desaparece depois do manifesto", async () => {
    const root = await createRepositoryRoot();
    const relativePath = "data/knowledge/emmanuel/aprovado.md";
    await writeKnowledgeFile(root, relativePath);
    const { manifest } = await createKnowledgeManifestFromCandidates([buildCandidate()], { repositoryRoot: root });
    await unlink(path.join(root, relativePath));
    const service = createGovernedCorpusService({
      loadManifest: async () => ({ status: "ready", manifest, issues: [] }),
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "KNOWLEDGE_FILE_NOT_FOUND",
    });
    expect(service.getOperationalStatus()).toMatchObject({
      state: "unavailable",
      rebuilding: false,
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
      },
    });
  });

  it("nao retorna snapshot anterior quando uma fonte aprovada fica invalida e recupera depois da correcao", async () => {
    const root = await createRepositoryRoot();
    const relativePath = "data/knowledge/emmanuel/aprovado.md";
    await writeKnowledgeFile(root, relativePath, markdownContent("Aprovado", "conteudo inicial valido"));
    const service = createServiceForCandidates(root, [buildCandidate()]);

    const first = await service.getSnapshot();
    await unlink(path.join(root, relativePath));

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_MANIFEST_INVALID",
    });

    await writeKnowledgeFile(root, relativePath, markdownContent("Aprovado", "conteudo restaurado valido"));
    const recovered = await service.getSnapshot();

    expect(recovered).not.toBe(first);
    expect(recovered.manifestFingerprint).toBe(first.manifestFingerprint);
    expect(recovered.corpusFingerprint).not.toBe(first.corpusFingerprint);
    expect(recovered.documents[0].content).toContain("conteudo restaurado valido");
  });

  it("falha fechado quando documento autorizado tem corpo util vazio", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(
      root,
      "data/knowledge/emmanuel/aprovado.md",
      `---
title: "Aprovado"
group: "Emmanuel"
purpose: "apoio para respostas simples"
source: "resumo autoral demonstrativo produzido para o portal"
---

`,
    );
    const service = createServiceForCandidates(root, [buildCandidate()]);

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
      message: "Documento governado sem corpo util.",
    });
  });

  it("falha fechado quando documento autorizado tem frontmatter invalido", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(
      root,
      "data/knowledge/emmanuel/aprovado.md",
      "# Aprovado\n\nConteudo sem frontmatter obrigatorio.",
    );
    const service = createServiceForCandidates(root, [buildCandidate()]);

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
      message: "Documento autorizado pelo manifesto editorial possui conteudo invalido.",
    });
    expect(service.getOperationalStatus()).toMatchObject({
      state: "invalid",
      rebuilding: false,
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
      },
    });
    expect(JSON.stringify(service.getOperationalStatus())).not.toContain("data/knowledge/emmanuel/aprovado.md");
    expect(JSON.stringify(service.getOperationalStatus())).not.toContain("Conteudo sem frontmatter");
  });

  it("classifica frontmatter sem campo obrigatorio como documento invalido", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(
      root,
      "data/knowledge/emmanuel/aprovado.md",
      `---
title: "Aprovado"
group: "Emmanuel"
source: "resumo autoral demonstrativo produzido para o portal"
---

# Aprovado

Conteudo com frontmatter semanticamente incompleto.
`,
    );
    const service = createServiceForCandidates(root, [buildCandidate()]);

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
    });
    expect(service.getOperationalStatus()).toMatchObject({
      state: "invalid",
      rebuilding: false,
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
      },
    });
  });

  it("marca stale para frontmatter invalido apos snapshot publicado e limpa apos recuperacao", async () => {
    const root = await createRepositoryRoot();
    const relativePath = "data/knowledge/emmanuel/aprovado.md";
    await writeKnowledgeFile(root, relativePath, markdownContent("Aprovado", "conteudo inicial valido"));
    const service = createServiceForCandidates(root, [buildCandidate()]);

    const published = await service.getSnapshot();
    const publishedStatus = service.getOperationalStatus();
    await writeKnowledgeFile(root, relativePath, "# Aprovado\n\nConteudo sem frontmatter obrigatorio.");

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
    });
    expect(service.getOperationalStatus()).toMatchObject({
      state: "invalid",
      rebuilding: false,
      stale: true,
      manifestSourceCount: 1,
      documentCount: publishedStatus.documentCount,
      chunkCount: publishedStatus.chunkCount,
      manifestFingerprint: published.manifestFingerprint,
      corpusFingerprint: published.corpusFingerprint,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_INVALID",
      },
    });

    await writeKnowledgeFile(root, relativePath, markdownContent("Aprovado", "conteudo recuperado valido"));
    const recovered = await service.getSnapshot();

    expect(recovered).not.toBe(published);
    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      manifestFingerprint: recovered.manifestFingerprint,
      corpusFingerprint: recovered.corpusFingerprint,
      lastFailure: null,
    });
  });

  it("produz corpus vazio valido com fingerprint deterministico", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/orfao.md");
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, []),
      loadDocumentEntries: loadDocumentEntriesFromRoot(root),
    });

    const first = await service.getSnapshot();
    const second = await service.getSnapshot();

    expect(first.documentCount).toBe(0);
    expect(first.audit.manifestStatus).toBe("empty");
    expect(first.corpusFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).toBe(first);
    expect(second.corpusFingerprint).toBe(first.corpusFingerprint);
  });

  it("falha fechado quando uma entrada carregada nao traz contentHash", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      const [entry] = await loadDocumentEntriesFromRoot(root)(manifest);

      return [{ ...entry, contentHash: undefined as unknown as string }];
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocumentEntries,
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
      message: "Documento governado sem contentHash fisico valido.",
    });
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
    });
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["hash vazio", ""],
    ["hash curto", "abc"],
    ["hash nao hexadecimal", "z".repeat(64)],
    ["hash uppercase", buildValidContentHash("uppercase").toUpperCase()],
  ])("falha fechado quando contentHash tem formato invalido: %s", async (_caseName, contentHash) => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      const [entry] = await loadDocumentEntriesFromRoot(root)(manifest);

      return [{ ...entry, contentHash }];
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocumentEntries,
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
    });
    expect(loadDocumentEntries).toHaveBeenCalledTimes(1);
  });

  it("recupera depois de falha por contentHash invalido sem publicar snapshot parcial", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      const [entry] = await loadDocumentEntriesFromRoot(root)(manifest);

      return [{
        ...entry,
        contentHash: loadDocumentEntries.mock.calls.length === 1
          ? "abc"
          : buildValidContentHash("fixture-recuperado"),
      }];
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocumentEntries,
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
    });
    const recovered = await service.getSnapshot();

    expect(recovered.documentCount).toBe(1);
    expect(recovered.corpusFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it("compartilha falha concorrente por contentHash invalido e libera nova tentativa", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    let releaseBuild: () => void = () => undefined;
    const buildGate = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      const [entry] = await loadDocumentEntriesFromRoot(root)(manifest);

      if (loadDocumentEntries.mock.calls.length === 1) {
        await buildGate;

        return [{ ...entry, contentHash: "abc" }];
      }

      return [{ ...entry, contentHash: buildValidContentHash("fixture-concorrente") }];
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocumentEntries,
    });

    const first = service.getSnapshot();
    const second = service.getSnapshot();
    await Promise.resolve();
    await Promise.resolve();
    expect(loadDocumentEntries).toHaveBeenCalledTimes(1);

    releaseBuild();
    await expect(first).rejects.toMatchObject({ code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID" });
    await expect(second).rejects.toMatchObject({ code: "GOVERNED_CORPUS_CONTENT_HASH_INVALID" });

    const recovered = await service.getSnapshot();
    expect(recovered.documentCount).toBe(1);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it("falha fechado sem expor erro bruto quando a leitura autorizada falha", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries: async () => {
        throw new Error(`/tmp/${root}/data/knowledge/emmanuel/aprovado.md`);
      },
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
      message: "Falha ao carregar documento autorizado pelo manifesto editorial.",
    });
  });

  it("rejeita inconsistencias bloqueantes do manifesto, incluindo duplicidade e caminho inseguro", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const duplicateService = createServiceForCandidates(root, [
      buildCandidate(),
      buildCandidate({ documentTitle: "Duplicado" }),
    ]);
    const unsafePathService = createServiceForCandidates(root, [
      buildCandidate({
        documentId: "doc-escape",
        filePath: "data/knowledge/../escape.md",
      }),
    ]);

    await expect(duplicateService.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_MANIFEST_INVALID",
      details: { issues: expect.arrayContaining([expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_DUPLICATE_DOCUMENT" })]) },
    });
    expect(duplicateService.getOperationalStatus()).toMatchObject({
      state: "invalid",
      rebuilding: false,
      stale: false,
      lastFailure: {
        code: "GOVERNED_CORPUS_MANIFEST_INVALID",
      },
    });
    await expect(unsafePathService.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_MANIFEST_INVALID",
      details: { issues: expect.arrayContaining([expect.objectContaining({ code: "KNOWLEDGE_FILE_PATH_INVALID" })]) },
    });
  });

  it("consolida chamadas simultaneas para o mesmo fingerprint", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const manifestResult = await buildManifestResult(root, [buildCandidate()]);
    let releaseBuild: () => void = () => undefined;
    const buildGate = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      await buildGate;
      return loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocumentEntries,
    });

    const first = service.getSnapshot();
    const second = service.getSnapshot();

    await Promise.resolve();
    await Promise.resolve();
    expect(loadDocumentEntries).toHaveBeenCalledTimes(1);

    releaseBuild();
    const secondSnapshot = await second;
    await expect(first).resolves.toBe(secondSnapshot);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(1);
  });

  it("isola reconstrucoes simultaneas de fingerprints diferentes sem duplicar ou regredir o cache", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const firstResult = await buildManifestResult(root, [buildCandidate()]);
    const secondResult = await buildManifestResult(root, [buildCandidate({ documentVersion: 2 })]);

    if (firstResult.status === "unavailable" || secondResult.status === "unavailable") {
      throw new Error("Manifestos de teste deveriam estar disponiveis.");
    }

    let releaseFirst: () => void = () => undefined;
    let releaseSecond: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const manifests = [firstResult, secondResult, firstResult, secondResult];
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      if (manifest.fingerprint === firstResult.manifest.fingerprint) {
        await firstGate;
      } else {
        await secondGate;
      }

      return loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? secondResult,
      loadDocumentEntries,
    });

    const first = service.getSnapshot();
    const second = service.getSnapshot();
    const repeatedFirst = service.getSnapshot();
    const repeatedSecond = service.getSnapshot();

    await Promise.resolve();
    await Promise.resolve();
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);

    releaseSecond();
    const secondSnapshot = await second;
    await expect(repeatedSecond).resolves.toBe(secondSnapshot);

    releaseFirst();
    const firstSnapshot = await first;
    await expect(repeatedFirst).resolves.toBe(firstSnapshot);

    const cachedSecond = await service.getSnapshot();
    expect(cachedSecond).toBe(secondSnapshot);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(3);
  });

  it("isola e congela o snapshot em cache contra mutacao silenciosa", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const service = createServiceForCandidates(root, [buildCandidate()]);
    const snapshot = await service.getSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.documents)).toBe(true);
    expect(Object.isFrozen(snapshot.documents[0])).toBe(true);
    expect(() => {
      (snapshot.documents as unknown as unknown[]).push(snapshot.documents[0]);
    }).toThrow();
    expect(() => {
      (snapshot.documents[0].tags as unknown as string[]).push("mutacao");
    }).toThrow();
    expect((await service.getSnapshot()).documents[0].tags).not.toContain("mutacao");
  });

  it("propaga indisponibilidade do catalogo como erro governado", async () => {
    const service = createGovernedCorpusService({
      loadManifest: async () => ({
        status: "unavailable",
        reason: "catalog_unavailable",
        issues: [{ code: "KNOWLEDGE_MANIFEST_CATALOG_UNAVAILABLE" }],
      }),
      loadDocumentEntries: async () => [],
    });

    await expect(service.getSnapshot()).rejects.toBeInstanceOf(GovernedCorpusError);
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
    });
  });

  it("rebuild administrativo ignora cache valido e publica novo snapshot mesmo com fingerprints identicos", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadManifest = vi.fn(() => buildManifestResult(root, [buildCandidate()]));
    const loadDocumentEntries = vi.fn(loadDocumentEntriesFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest,
      loadDocumentEntries,
      now: createClock([
        "2026-07-17T02:00:00.000Z",
        "2026-07-17T02:00:01.000Z",
        "2026-07-17T02:00:02.000Z",
        "2026-07-17T02:00:03.000Z",
      ]),
    });

    const first = await service.getSnapshot();
    const firstStatus = service.getOperationalStatus();
    const rebuilt = await service.rebuildSnapshot();
    const rebuiltStatus = service.getOperationalStatus();

    expect(rebuilt).not.toBe(first);
    expect(rebuilt.cacheKey).toEqual(first.cacheKey);
    expect(rebuilt.manifestFingerprint).toBe(first.manifestFingerprint);
    expect(rebuilt.corpusFingerprint).toBe(first.corpusFingerprint);
    expect(loadManifest).toHaveBeenCalledTimes(2);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
    expect(firstStatus.lastSuccessfulBuildAt).toBe("2026-07-17T02:00:01.000Z");
    expect(rebuiltStatus).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      lastAttemptAt: "2026-07-17T02:00:02.000Z",
      lastSuccessfulBuildAt: "2026-07-17T02:00:03.000Z",
      lastFailure: null,
    });
  });

  it("rebuild administrativo publica fingerprints diferentes quando o conteudo fisico muda", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Aprovado", "conteudo antigo"));
    const service = createServiceForCandidates(root, [buildCandidate()]);

    const first = await service.getSnapshot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Aprovado", "conteudo novo"));
    const rebuilt = await service.rebuildSnapshot();

    expect(rebuilt).not.toBe(first);
    expect(rebuilt.manifestFingerprint).toBe(first.manifestFingerprint);
    expect(rebuilt.corpusFingerprint).not.toBe(first.corpusFingerprint);
    expect(rebuilt.documents[0].content).toContain("conteudo novo");
    expect(rebuilt.documents[0].content).not.toContain("conteudo antigo");
  });

  it("rejeita rebuild administrativo concorrente e libera lock apos sucesso", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const releaseBuild = createDeferred();
    const buildStarted = createDeferred();
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      buildStarted.resolve();
      await releaseBuild.promise;
      return loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries,
    });

    const first = service.rebuildSnapshot();
    await buildStarted.promise;

    await expect(service.rebuildSnapshot()).rejects.toBeInstanceOf(GovernedCorpusRebuildInProgressError);
    expect(loadDocumentEntries).toHaveBeenCalledTimes(1);

    releaseBuild.resolve();
    await expect(first).resolves.toMatchObject({ documentCount: 1 });
    await expect(service.rebuildSnapshot()).resolves.toMatchObject({ documentCount: 1 });
    expect(loadDocumentEntries).toHaveBeenCalledTimes(2);
  });

  it("libera lock apos falha de rebuild e marca stale quando havia snapshot publicado", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadDocumentEntries = vi
      .fn()
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root))
      .mockRejectedValueOnce(new Error("falha fisica"))
      .mockImplementationOnce(loadDocumentEntriesFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocumentEntries,
      now: createClock([
        "2026-07-17T02:01:00.000Z",
        "2026-07-17T02:01:01.000Z",
        "2026-07-17T02:01:02.000Z",
        "2026-07-17T02:01:03.000Z",
        "2026-07-17T02:01:04.000Z",
        "2026-07-17T02:01:05.000Z",
      ]),
    });

    await service.getSnapshot();
    await expect(service.rebuildSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });
    expect(service.getOperationalStatus()).toMatchObject({
      state: "unavailable",
      rebuilding: false,
      stale: true,
      lastFailure: {
        code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
        occurredAt: "2026-07-17T02:01:03.000Z",
      },
    });

    await expect(service.rebuildSnapshot()).resolves.toMatchObject({ documentCount: 1 });
    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      rebuilding: false,
      stale: false,
      lastFailure: null,
    });
  });

  it("tentativa publica antiga nao publica sobre rebuild administrativo mais novo", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/publico.md", markdownContent("Publico"));
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/admin.md", markdownContent("Admin"));
    const publicCandidate = buildCandidate({
      documentId: "doc-publico",
      catalogKey: "publico",
      filePath: "data/knowledge/emmanuel/publico.md",
      documentTitle: "Publico",
    });
    const adminCandidate = buildCandidate({
      documentId: "doc-admin",
      catalogKey: "admin",
      filePath: "data/knowledge/emmanuel/admin.md",
      documentTitle: "Admin",
      documentVersion: 2,
    });
    const publicResult = await buildManifestResult(root, [publicCandidate]);
    const adminResult = await buildManifestResult(root, [adminCandidate]);

    if (publicResult.status === "unavailable" || adminResult.status === "unavailable") {
      throw new Error("Manifestos de teste deveriam estar disponiveis.");
    }

    const publicStarted = createDeferred();
    const releasePublic = createDeferred();
    const manifests = [publicResult, adminResult];
    const loadDocumentEntries = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      if (manifest.fingerprint === publicResult.manifest.fingerprint) {
        publicStarted.resolve();
        await releasePublic.promise;
      }

      return loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? adminResult,
      loadDocumentEntries,
      now: createClock([
        "2026-07-17T02:02:00.000Z",
        "2026-07-17T02:02:01.000Z",
        "2026-07-17T02:02:02.000Z",
      ]),
    });

    const publicAttempt = service.getSnapshot();
    await publicStarted.promise;
    const adminSnapshot = await service.rebuildSnapshot();

    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      manifestFingerprint: adminSnapshot.manifestFingerprint,
      corpusFingerprint: adminSnapshot.corpusFingerprint,
      lastSuccessfulBuildAt: "2026-07-17T02:02:02.000Z",
    });

    releasePublic.resolve();
    await expect(publicAttempt).resolves.toMatchObject({
      manifestFingerprint: publicResult.manifest.fingerprint,
    });
    expect(service.getOperationalStatus()).toMatchObject({
      state: "ready",
      manifestFingerprint: adminSnapshot.manifestFingerprint,
      corpusFingerprint: adminSnapshot.corpusFingerprint,
      lastSuccessfulBuildAt: "2026-07-17T02:02:02.000Z",
    });
    await expect(service.getSnapshot()).resolves.toBe(adminSnapshot);
  });
});
