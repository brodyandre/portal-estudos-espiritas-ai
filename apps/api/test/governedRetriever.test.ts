import { describe, expect, it, vi } from "vitest";

import type { GovernedCorpusService, GovernedCorpusSnapshot } from "../src/knowledge/governedCorpus";
import {
  createGovernedRetrieverService,
  type GovernedRetrieverContext,
} from "../src/rag/governedRetriever";
import {
  GovernedRetrieverError,
  isGovernedRetrievalOperationalError,
  toKnowledgeCorpusUnavailableError,
} from "../src/rag/governedRetrievalErrors";
import { createKeywordRetriever } from "../src/rag/retriever";
import type { KeywordRetriever, KnowledgeDocumentForRetrieval } from "../src/rag/types";

const buildDocument = (
  id: string,
  content: string,
  overrides: Partial<KnowledgeDocumentForRetrieval> = {},
): KnowledgeDocumentForRetrieval => ({
  id,
  title: `Documento ${id}`,
  group: "Emmanuel",
  book: "Emmanuel",
  source: "resumo autoral demonstrativo",
  sourceLabel: `Emmanuel · Documento ${id}`,
  filename: `${id}.md`,
  path: `data/knowledge/emmanuel/${id}.md`,
  type: "tema",
  tags: ["estudo", id],
  description: `Descricao ${id}`,
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  purpose: "apoio para respostas simples",
  content,
  rawContent: content,
  frontmatter: {
    title: `Documento ${id}`,
    group: "Emmanuel",
    purpose: "apoio para respostas simples",
    source: "resumo autoral demonstrativo",
  },
  charCount: content.length,
  wordCount: content.split(/\s+/u).filter(Boolean).length,
  editorial: {
    manifestFingerprint: "fingerprint-placeholder",
    manifestSourceId: `${id}:1`,
    documentId: id,
    bookId: "book-emmanuel",
    catalogKey: id,
    documentTitle: `Documento ${id}`,
    bookTitle: "Emmanuel",
    bookSlug: "emmanuel",
    documentVersion: 1,
    origin: "catalog",
  },
  ...overrides,
});

const buildSnapshot = (
  fingerprint: string,
  documents: readonly KnowledgeDocumentForRetrieval[],
): GovernedCorpusSnapshot => ({
  manifestFingerprint: fingerprint,
  manifestSchemaVersion: 1,
  documents: documents.map((document) => ({
    ...document,
    tags: [...document.tags],
    sensitiveTopics: [...document.sensitiveTopics],
    frontmatter: { ...document.frontmatter },
    ...(document.editorial ? { editorial: { ...document.editorial, manifestFingerprint: fingerprint } } : {}),
  })),
  documentCount: documents.length,
  audit: {
    manifestStatus: documents.length > 0 ? "ready" : "empty",
    manifestSourceCount: documents.length,
    loadedDocumentCount: documents.length,
    nonBlockingIssueCount: 0,
  },
});

const createCorpusService = (
  getSnapshot: () => Promise<GovernedCorpusSnapshot>,
): GovernedCorpusService => ({
  getSnapshot,
});

const createControlledPromise = <T>() => {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return { promise, resolve: resolvePromise, reject: rejectPromise };
};

const buildStubRetriever = (label: string): KeywordRetriever => ({
  backend: "keyword",
  getIndex() {
    return {
      backend: "keyword",
      builtAt: label,
      documents: [],
      chunks: [],
    };
  },
  async search() {
    return [];
  },
});

describe("governed retriever service", () => {
  it("constroi retriever somente com documentos do snapshot governado e sem absolutePath", async () => {
    const authorized = buildDocument("autorizado", "prece e acolhimento no estudo");
    const service = createGovernedRetrieverService({
      corpusService: createCorpusService(async () => buildSnapshot("fp-1", [authorized])),
    });

    const context = await service.getContext();
    const results = await context.retriever.search("prece", { minScore: 0.1 });

    expect(context.documents).toHaveLength(1);
    expect(context.documents[0]).not.toHaveProperty("absolutePath");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      documentId: "autorizado",
      path: "data/knowledge/emmanuel/autorizado.md",
    }));
    expect(JSON.stringify(results)).not.toContain("absolutePath");
  });

  it("reutiliza o retriever para o mesmo fingerprint sem reconstruir indice", async () => {
    const snapshot = buildSnapshot("fp-1", [buildDocument("a", "constancia no estudo")]);
    const getSnapshot = vi.fn(async () => snapshot);
    const retriever = buildStubRetriever("fp-1");
    const createRetriever = vi.fn(async () => retriever);
    const service = createGovernedRetrieverService({
      corpusService: createCorpusService(getSnapshot),
      createRetriever,
    });

    const first = await service.getContext();
    const second = await service.getContext();

    expect(first).toBe(second);
    expect(first.retriever).toBe(retriever);
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(createRetriever).toHaveBeenCalledTimes(1);
  });

  it("compartilha chamadas simultaneas para o mesmo fingerprint", async () => {
    const snapshot = buildSnapshot("fp-1", [buildDocument("a", "prece")]);
    const gate = createControlledPromise<KeywordRetriever>();
    const createRetriever = vi.fn(() => gate.promise);
    const service = createGovernedRetrieverService({
      corpusService: createCorpusService(async () => snapshot),
      createRetriever,
    });

    const first = service.getContext();
    const second = service.getContext();

    await Promise.resolve();
    await Promise.resolve();
    expect(createRetriever).toHaveBeenCalledTimes(1);

    gate.resolve(buildStubRetriever("fp-1"));
    await expect(first).resolves.toBe(await second);
    expect(createRetriever).toHaveBeenCalledTimes(1);
  });

  it("reconstroi quando o fingerprint muda e nao retorna retriever antigo", async () => {
    const firstSnapshot = buildSnapshot("fp-1", [buildDocument("a", "prece antiga")]);
    const secondSnapshot = buildSnapshot("fp-2", [buildDocument("b", "capela nova")]);
    const snapshots = [firstSnapshot, secondSnapshot, secondSnapshot];
    const service = createGovernedRetrieverService({
      corpusService: createCorpusService(async () => snapshots.shift() ?? secondSnapshot),
    });

    const first = await service.getContext();
    const second = await service.getContext();
    const repeatedSecond = await service.getContext();

    expect(first.manifestFingerprint).toBe("fp-1");
    expect(second.manifestFingerprint).toBe("fp-2");
    expect(second).toBe(repeatedSecond);
    await expect(second.retriever.search("capela", { minScore: 0.1 })).resolves.toEqual([
      expect.objectContaining({ documentId: "b" }),
    ]);
    const oldTermResults = await second.retriever.search("prece antiga", { minScore: 0.1 });
    expect(oldTermResults.some((result) => result.documentId === "a")).toBe(false);
  });

  it("propaga falha de construcao nova sem associar fingerprint novo ao retriever antigo e permite retry", async () => {
    const firstSnapshot = buildSnapshot("fp-1", [buildDocument("a", "prece")]);
    const secondSnapshot = buildSnapshot("fp-2", [buildDocument("b", "capela")]);
    const snapshots = [firstSnapshot, secondSnapshot, secondSnapshot];
    const createRetriever = vi
      .fn()
      .mockResolvedValueOnce(buildStubRetriever("fp-1"))
      .mockRejectedValueOnce(new Error("/tmp/caminho/absoluto.md"))
      .mockResolvedValueOnce(buildStubRetriever("fp-2"));
    const service = createGovernedRetrieverService({
      corpusService: createCorpusService(async () => snapshots.shift() ?? secondSnapshot),
      createRetriever,
    });

    await expect(service.getContext()).resolves.toMatchObject({ manifestFingerprint: "fp-1" });
    await expect(service.getContext()).rejects.toMatchObject({
      code: "GOVERNED_RETRIEVER_BUILD_FAILED",
      message: "Falha ao construir o retriever do corpus governado.",
    });
    await expect(service.getContext()).resolves.toMatchObject({ manifestFingerprint: "fp-2" });
    expect(createRetriever).toHaveBeenCalledTimes(3);
  });

  it("isola fingerprints simultaneos sem publicacao regressiva", async () => {
    const firstSnapshot = buildSnapshot("fp-1", [buildDocument("a", "prece")]);
    const secondSnapshot = buildSnapshot("fp-2", [buildDocument("b", "capela")]);
    const snapshots = [firstSnapshot, secondSnapshot, secondSnapshot, firstSnapshot];
    const firstGate = createControlledPromise<KeywordRetriever>();
    const secondGate = createControlledPromise<KeywordRetriever>();
    const createRetriever = vi
      .fn()
      .mockReturnValueOnce(firstGate.promise)
      .mockReturnValueOnce(secondGate.promise)
      .mockResolvedValueOnce(buildStubRetriever("fp-1-rebuilt"));
    const service = createGovernedRetrieverService({
      corpusService: createCorpusService(async () => snapshots.shift() ?? secondSnapshot),
      createRetriever,
    });

    const first = service.getContext();
    const second = service.getContext();

    await Promise.resolve();
    await Promise.resolve();
    expect(createRetriever).toHaveBeenCalledTimes(2);

    secondGate.resolve(buildStubRetriever("fp-2"));
    await expect(second).resolves.toMatchObject({ manifestFingerprint: "fp-2" });

    firstGate.resolve(buildStubRetriever("fp-1"));
    await expect(first).resolves.toMatchObject({ manifestFingerprint: "fp-1" });

    await expect(service.getContext()).resolves.toMatchObject({ manifestFingerprint: "fp-2" });
    await expect(service.getContext()).resolves.toMatchObject({ manifestFingerprint: "fp-1" });
    expect(createRetriever).toHaveBeenCalledTimes(3);
  });

  it("remove promise rejeitada e nao vaza caminho absoluto em erro governado", async () => {
    const snapshot = buildSnapshot("fp-1", [buildDocument("a", "prece")]);
    const createRetriever = vi
      .fn()
      .mockRejectedValueOnce(new Error("/tmp/repositorio/data/knowledge/a.md"))
      .mockResolvedValueOnce(buildStubRetriever("fp-1"));
    const service = createGovernedRetrieverService({
      corpusService: createCorpusService(async () => snapshot),
      createRetriever,
    });

    await expect(service.getContext()).rejects.toBeInstanceOf(GovernedRetrieverError);
    await expect(service.getContext()).resolves.toMatchObject({ manifestFingerprint: "fp-1" });
    expect(createRetriever).toHaveBeenCalledTimes(2);
  });

  it("reconhece erro publico de corpus ja traduzido como operacional", () => {
    const publicError = toKnowledgeCorpusUnavailableError();

    expect(isGovernedRetrievalOperationalError(publicError)).toBe(true);
  });
});
