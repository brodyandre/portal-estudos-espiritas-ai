import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGovernedCorpusService,
  GovernedCorpusError,
} from "../src/knowledge/governedCorpus";
import {
  buildKnowledgeEditorialManifest,
  createKnowledgeManifestFromCandidates,
  type KnowledgeEditorialManifest,
  type KnowledgeManifestCatalogCandidate,
} from "../src/knowledge/manifest";
import { loadKnowledgeDocumentsFromManifest } from "../src/rag/documentLoader";

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

const writeKnowledgeFile = async (root: string, relativePath: string, content = markdownContent()) => {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
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

const loadDocumentsFromRoot = (root: string) => (manifest: KnowledgeEditorialManifest) =>
  loadKnowledgeDocumentsFromManifest(manifest, { repositoryRoot: root });

const createServiceForCandidates = (
  root: string,
  candidates: KnowledgeManifestCatalogCandidate[],
) =>
  createGovernedCorpusService({
    loadManifest: () => buildManifestResult(root, candidates),
    loadDocuments: loadDocumentsFromRoot(root),
  });

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("governed corpus service", () => {
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
  });

  it("reutiliza o snapshot em cache quando o fingerprint nao muda", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadDocuments = vi.fn(loadDocumentsFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocuments,
    });

    const first = await service.getSnapshot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Alterado"));
    const second = await service.getSnapshot();

    expect(second).toBe(first);
    expect(loadDocuments).toHaveBeenCalledTimes(1);
  });

  it("reconstroi quando o fingerprint muda e so substitui o cache apos sucesso", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const firstResult = await buildManifestResult(root, [buildCandidate()]);
    const secondResult = await buildManifestResult(root, [buildCandidate({ documentVersion: 2 })]);
    const manifests = [firstResult, secondResult, secondResult];
    const loadDocuments = vi
      .fn()
      .mockImplementationOnce(loadDocumentsFromRoot(root))
      .mockRejectedValueOnce(new Error(`/tmp/${root}/absoluto.md`))
      .mockImplementationOnce(loadDocumentsFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? secondResult,
      loadDocuments,
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
    expect(loadDocuments).toHaveBeenCalledTimes(3);
  });

  it("nao guarda promise rejeitada permanentemente apos falha de construcao", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const loadDocuments = vi
      .fn()
      .mockRejectedValueOnce(new Error("falha transitoria"))
      .mockImplementationOnce(loadDocumentsFromRoot(root));
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocuments,
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    });
    await expect(service.getSnapshot()).resolves.toMatchObject({ documentCount: 1 });
    expect(loadDocuments).toHaveBeenCalledTimes(2);
  });

  it("falha fechado quando documento autorizado desaparece depois do manifesto", async () => {
    const root = await createRepositoryRoot();
    const relativePath = "data/knowledge/emmanuel/aprovado.md";
    await writeKnowledgeFile(root, relativePath);
    const { manifest } = await createKnowledgeManifestFromCandidates([buildCandidate()], { repositoryRoot: root });
    await unlink(path.join(root, relativePath));
    const service = createGovernedCorpusService({
      loadManifest: async () => ({ status: "ready", manifest, issues: [] }),
      loadDocuments: loadDocumentsFromRoot(root),
    });

    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "KNOWLEDGE_FILE_NOT_FOUND",
    });
  });

  it("falha fechado sem expor erro bruto quando a leitura autorizada falha", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    const service = createGovernedCorpusService({
      loadManifest: () => buildManifestResult(root, [buildCandidate()]),
      loadDocuments: async () => {
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
    const loadDocuments = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      await buildGate;
      return loadKnowledgeDocumentsFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifestResult,
      loadDocuments,
    });

    const first = service.getSnapshot();
    const second = service.getSnapshot();

    await Promise.resolve();
    await Promise.resolve();
    expect(loadDocuments).toHaveBeenCalledTimes(1);

    releaseBuild();
    const secondSnapshot = await second;
    await expect(first).resolves.toBe(secondSnapshot);
    expect(loadDocuments).toHaveBeenCalledTimes(1);
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
    const loadDocuments = vi.fn(async (manifest: KnowledgeEditorialManifest) => {
      if (manifest.fingerprint === firstResult.manifest.fingerprint) {
        await firstGate;
      } else {
        await secondGate;
      }

      return loadKnowledgeDocumentsFromManifest(manifest, { repositoryRoot: root });
    });
    const service = createGovernedCorpusService({
      loadManifest: async () => manifests.shift() ?? secondResult,
      loadDocuments,
    });

    const first = service.getSnapshot();
    const second = service.getSnapshot();
    const repeatedFirst = service.getSnapshot();
    const repeatedSecond = service.getSnapshot();

    await Promise.resolve();
    await Promise.resolve();
    expect(loadDocuments).toHaveBeenCalledTimes(2);

    releaseSecond();
    const secondSnapshot = await second;
    await expect(repeatedSecond).resolves.toBe(secondSnapshot);

    releaseFirst();
    const firstSnapshot = await first;
    await expect(repeatedFirst).resolves.toBe(firstSnapshot);

    const cachedSecond = await service.getSnapshot();
    expect(cachedSecond).toBe(secondSnapshot);
    expect(loadDocuments).toHaveBeenCalledTimes(2);
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
      loadDocuments: async () => [],
    });

    await expect(service.getSnapshot()).rejects.toBeInstanceOf(GovernedCorpusError);
    await expect(service.getSnapshot()).rejects.toMatchObject({
      code: "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
    });
  });
});
