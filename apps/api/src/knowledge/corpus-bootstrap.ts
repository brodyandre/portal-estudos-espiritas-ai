import {
  governedCorpusService,
  type GovernedCorpusOperationalStatus,
  type GovernedCorpusService,
} from "./governedCorpus";

type GovernedCorpusBootstrapEvent =
  | "knowledge_corpus_bootstrap_started"
  | "knowledge_corpus_bootstrap_succeeded"
  | "knowledge_corpus_bootstrap_empty"
  | "knowledge_corpus_bootstrap_failed";

export type GovernedCorpusBootstrapLogger = (
  event: GovernedCorpusBootstrapEvent,
  details: Record<string, unknown>,
) => void;

export interface GovernedCorpusBootstrapOptions {
  corpusService?: GovernedCorpusService;
  logger?: GovernedCorpusBootstrapLogger;
  now?: () => number;
}

let bootstrapPromise: Promise<void> | null = null;

const defaultLogger: GovernedCorpusBootstrapLogger = (event, details) => {
  console.log(event, details);
};

const buildStatusLogDetails = (
  status: GovernedCorpusOperationalStatus,
  durationMs?: number,
) => ({
  ...(durationMs === undefined ? {} : { durationMs }),
  state: status.rebuilding ? "building" : status.state,
  manifestSourceCount: status.manifestSourceCount,
  documentCount: status.documentCount,
  chunkCount: status.chunkCount,
  stale: status.stale,
});

const sanitizeFailureCode = (error: unknown) => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{1,96}$/u.test(error.code)
  ) {
    return error.code;
  }

  return "UNKNOWN_ERROR";
};

const emitLog = (
  logger: GovernedCorpusBootstrapLogger,
  event: GovernedCorpusBootstrapEvent,
  details: Record<string, unknown>,
) => {
  try {
    logger(event, details);
  } catch (_error) {
    // Operational logging must never make startup fail.
  }
};

export const startGovernedCorpusBootstrap = (
  options: GovernedCorpusBootstrapOptions = {},
): Promise<void> => {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  const corpusService = options.corpusService ?? governedCorpusService;
  const logger = options.logger ?? defaultLogger;
  const now = options.now ?? Date.now;
  const startedAt = now();
  let snapshotPromise: ReturnType<GovernedCorpusService["getSnapshot"]>;

  try {
    snapshotPromise = corpusService.getSnapshot();
  } catch (error) {
    snapshotPromise = Promise.reject(error);
  }

  emitLog(
    logger,
    "knowledge_corpus_bootstrap_started",
    buildStatusLogDetails(corpusService.getOperationalStatus()),
  );

  bootstrapPromise = snapshotPromise
    .then((snapshot) => {
      const status = corpusService.getOperationalStatus();
      const durationMs = Math.max(0, now() - startedAt);
      const event: GovernedCorpusBootstrapEvent =
        snapshot.documentCount > 0
          ? "knowledge_corpus_bootstrap_succeeded"
          : "knowledge_corpus_bootstrap_empty";

      emitLog(logger, event, {
        ...buildStatusLogDetails(status, durationMs),
        manifestSourceCount: snapshot.audit.manifestSourceCount,
        documentCount: snapshot.documentCount,
      });
    })
    .catch((error: unknown) => {
      const status = corpusService.getOperationalStatus();

      emitLog(logger, "knowledge_corpus_bootstrap_failed", {
        ...buildStatusLogDetails(status, Math.max(0, now() - startedAt)),
        failureCode: sanitizeFailureCode(error),
      });
    });

  return bootstrapPromise;
};

export const resetGovernedCorpusBootstrapForTesting = () => {
  bootstrapPromise = null;
};
