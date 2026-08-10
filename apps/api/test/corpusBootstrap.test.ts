import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resetGovernedCorpusBootstrapForTesting,
  startGovernedCorpusBootstrap,
  type GovernedCorpusBootstrapLogger,
} from "../src/knowledge/corpus-bootstrap";
import type {
  GovernedCorpusOperationalStatus,
  GovernedCorpusService,
  GovernedCorpusSnapshot,
} from "../src/knowledge/governedCorpus";

const buildStatus = (
  overrides: Partial<GovernedCorpusOperationalStatus> = {},
): GovernedCorpusOperationalStatus => ({
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
  ...overrides,
});

const buildSnapshot = (documentCount: number): GovernedCorpusSnapshot => ({
  cacheKey: {
    manifestFingerprint: "manifest-fingerprint-that-must-not-leak",
    corpusFingerprint: "corpus-fingerprint-that-must-not-leak",
  },
  manifestFingerprint: "manifest-fingerprint-that-must-not-leak",
  corpusFingerprint: "corpus-fingerprint-that-must-not-leak",
  manifestSchemaVersion: 1,
  documents: [],
  documentCount,
  audit: {
    manifestStatus: documentCount > 0 ? "ready" : "empty",
    manifestSourceCount: documentCount,
    loadedDocumentCount: documentCount,
    nonBlockingIssueCount: 0,
  },
});

const createCorpusService = (
  getSnapshot: () => Promise<GovernedCorpusSnapshot>,
  getStatus: () => GovernedCorpusOperationalStatus,
): GovernedCorpusService => ({
  getSnapshot,
  rebuildSnapshot: getSnapshot,
  getOperationalStatus: getStatus,
  setNowProviderForTesting() {
    return undefined;
  },
  resetForTesting() {
    return undefined;
  },
});

const createLogger = () => {
  const entries: Array<Parameters<GovernedCorpusBootstrapLogger>> = [];
  const logger: GovernedCorpusBootstrapLogger = (event, details) => {
    entries.push([event, details]);
  };

  return { entries, logger };
};

afterEach(() => {
  resetGovernedCorpusBootstrapForTesting();
  vi.restoreAllMocks();
});

describe("governed corpus startup bootstrap", () => {
  it("chama o dominio existente e registra sucesso para catalogo elegivel", async () => {
    const snapshot = buildSnapshot(1);
    let status = buildStatus({ rebuilding: true });
    const getSnapshot = vi.fn(() => {
      status = buildStatus({ rebuilding: true });

      return Promise.resolve(snapshot).then((value) => {
        status = buildStatus({
          state: "ready",
          manifestSourceCount: 1,
          documentCount: 1,
          chunkCount: 3,
          manifestFingerprint: snapshot.manifestFingerprint,
          corpusFingerprint: snapshot.corpusFingerprint,
          lastSuccessfulBuildAt: "2026-07-17T01:00:01.000Z",
        });

        return value;
      });
    });
    const service = createCorpusService(getSnapshot, () => status);
    const { entries, logger } = createLogger();
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(125);

    await startGovernedCorpusBootstrap({ corpusService: service, logger, now });

    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(entries).toEqual([
      [
        "knowledge_corpus_bootstrap_started",
        expect.objectContaining({
          state: "building",
          stale: false,
        }),
      ],
      [
        "knowledge_corpus_bootstrap_succeeded",
        expect.objectContaining({
          durationMs: 25,
          state: "ready",
          manifestSourceCount: 1,
          documentCount: 1,
          chunkCount: 3,
          stale: false,
        }),
      ],
    ]);
    expect(JSON.stringify(entries)).not.toContain("fingerprint-that-must-not-leak");
  });

  it("registra empty para catalogo governado valido sem fontes elegiveis", async () => {
    const snapshot = buildSnapshot(0);
    let status = buildStatus({ rebuilding: true });
    const service = createCorpusService(
      vi.fn(() =>
        Promise.resolve(snapshot).then((value) => {
          status = buildStatus({
            state: "empty",
            manifestFingerprint: snapshot.manifestFingerprint,
            corpusFingerprint: snapshot.corpusFingerprint,
            lastSuccessfulBuildAt: "2026-07-17T01:00:01.000Z",
          });

          return value;
        }),
      ),
      () => status,
    );
    const { entries, logger } = createLogger();

    await startGovernedCorpusBootstrap({ corpusService: service, logger });

    expect(entries.map(([event]) => event)).toEqual([
      "knowledge_corpus_bootstrap_started",
      "knowledge_corpus_bootstrap_empty",
    ]);
    expect(entries[1]?.[1]).toEqual(
      expect.objectContaining({
        state: "empty",
        documentCount: 0,
        manifestSourceCount: 0,
      }),
    );
  });

  it("captura falha, registra codigo sanitizado e nao rejeita para o processo", async () => {
    const rawError = new Error("falha em /tmp/secret/data/knowledge/conteudo.md com DATABASE_URL");
    let status = buildStatus({ rebuilding: true });
    const service = createCorpusService(
      vi.fn(() =>
        Promise.reject(rawError).catch((error: unknown) => {
          status = buildStatus({
            state: "unavailable",
            lastFailure: {
              code: "GOVERNED_CORPUS_UNKNOWN_ERROR",
              occurredAt: "2026-07-17T01:00:01.000Z",
            },
          });

          throw error;
        }),
      ),
      () => status,
    );
    const { entries, logger } = createLogger();

    await expect(startGovernedCorpusBootstrap({ corpusService: service, logger })).resolves.toBeUndefined();

    expect(entries.map(([event]) => event)).toEqual([
      "knowledge_corpus_bootstrap_started",
      "knowledge_corpus_bootstrap_failed",
    ]);
    expect(entries[1]?.[1]).toEqual(
      expect.objectContaining({
        state: "unavailable",
        failureCode: "UNKNOWN_ERROR",
      }),
    );
    expect(JSON.stringify(entries)).not.toContain("/tmp/secret");
    expect(JSON.stringify(entries)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(entries)).not.toContain("stack");
  });

  it("executa apenas uma vez por startup mesmo com multiplas chamadas internas", async () => {
    const snapshot = buildSnapshot(1);
    const getSnapshot = vi.fn(async () => snapshot);
    const service = createCorpusService(getSnapshot, () => buildStatus({ state: "ready", documentCount: 1 }));
    const { entries, logger } = createLogger();

    const first = startGovernedCorpusBootstrap({ corpusService: service, logger });
    const second = startGovernedCorpusBootstrap({ corpusService: service, logger });

    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(entries.filter(([event]) => event === "knowledge_corpus_bootstrap_started")).toHaveLength(1);
  });

  it("nao deixa falha de logger derrubar o bootstrap", async () => {
    const snapshot = buildSnapshot(1);
    const service = createCorpusService(
      vi.fn(async () => snapshot),
      () => buildStatus({ state: "ready", documentCount: 1 }),
    );

    await expect(
      startGovernedCorpusBootstrap({
        corpusService: service,
        logger: () => {
          throw new Error("logger indisponivel");
        },
      }),
    ).resolves.toBeUndefined();
  });
});
