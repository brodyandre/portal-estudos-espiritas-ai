import { createHash } from "node:crypto";

import {
  KnowledgeDocumentInvalidError,
  loadKnowledgeDocumentsWithContentHashesFromManifest,
} from "../rag/documentLoader";
import { splitDocumentsIntoChunks } from "../rag/textSplitter";
import type { KnowledgeDocument, KnowledgeDocumentForRetrieval } from "../rag/types";
import {
  buildKnowledgeEditorialManifest,
  type KnowledgeEditorialManifest,
  type KnowledgeEditorialManifestResult,
  type KnowledgeManifestIssue,
  type KnowledgeManifestSource,
} from "./manifest";

export type GovernedCorpusErrorCode =
  | "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE"
  | "GOVERNED_CORPUS_MANIFEST_INVALID"
  | "GOVERNED_CORPUS_DOCUMENT_INVALID"
  | "GOVERNED_CORPUS_CONTENT_HASH_INVALID"
  | "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED";

export type GovernedCorpusOperationalFailureCode =
  | GovernedCorpusErrorCode
  | "GOVERNED_CORPUS_UNKNOWN_ERROR";

export class GovernedCorpusError extends Error {
  constructor(
    public readonly code: GovernedCorpusErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "GovernedCorpusError";
  }
}

type DeepReadonly<T> =
  T extends (...args: unknown[]) => unknown
    ? T
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T;

export type GovernedCorpusDocument = DeepReadonly<Omit<KnowledgeDocument, "absolutePath">>;

export interface GovernedCorpusCacheKey {
  readonly manifestFingerprint: string;
  readonly corpusFingerprint: string;
}

export interface GovernedCorpusSnapshot {
  readonly cacheKey: GovernedCorpusCacheKey;
  readonly manifestFingerprint: string;
  readonly corpusFingerprint: string;
  readonly manifestSchemaVersion: number;
  readonly documents: readonly GovernedCorpusDocument[];
  readonly documentCount: number;
  readonly audit: {
    readonly manifestStatus: Exclude<KnowledgeEditorialManifestResult["status"], "unavailable">;
    readonly manifestSourceCount: number;
    readonly loadedDocumentCount: number;
    readonly nonBlockingIssueCount: number;
  };
}

export type GovernedCorpusOperationalState =
  | "not_built"
  | "ready"
  | "empty"
  | "invalid"
  | "unavailable";

export interface GovernedCorpusLastFailure {
  readonly code: GovernedCorpusOperationalFailureCode;
  readonly occurredAt: string;
}

export interface GovernedCorpusOperationalStatus {
  readonly state: GovernedCorpusOperationalState;
  readonly rebuilding: boolean;
  readonly stale: boolean;
  // Snapshot identity/count fields describe only the last successfully published snapshot.
  readonly manifestSourceCount: number;
  readonly documentCount: number;
  readonly chunkCount: number;
  readonly manifestFingerprint: string | null;
  readonly corpusFingerprint: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessfulBuildAt: string | null;
  readonly lastFailure: GovernedCorpusLastFailure | null;
}

export interface GovernedCorpusServiceOptions {
  loadManifest?: () => Promise<KnowledgeEditorialManifestResult>;
  loadDocumentEntries?: (manifest: KnowledgeEditorialManifest) => Promise<readonly GovernedCorpusLoadedDocument[]>;
  now?: () => Date;
}

export interface GovernedCorpusService {
  getSnapshot(): Promise<GovernedCorpusSnapshot>;
  getOperationalStatus(): GovernedCorpusOperationalStatus;
  setNowProviderForTesting(now: () => Date): void;
  resetForTesting(): void;
}

const NON_BLOCKING_MANIFEST_ISSUES = new Set(["KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE"]);
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/u;
const INVALID_GOVERNED_CORPUS_ERROR_CODES = new Set<GovernedCorpusErrorCode>([
  "GOVERNED_CORPUS_MANIFEST_INVALID",
  "GOVERNED_CORPUS_DOCUMENT_INVALID",
  "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
]);
const OPERATIONAL_FAILURE_CODES = new Set<GovernedCorpusOperationalFailureCode>([
  "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
  "GOVERNED_CORPUS_MANIFEST_INVALID",
  "GOVERNED_CORPUS_DOCUMENT_INVALID",
  "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
  "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
  "GOVERNED_CORPUS_UNKNOWN_ERROR",
]);

const INITIAL_OPERATIONAL_STATUS: GovernedCorpusOperationalStatus = Object.freeze({
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

export interface GovernedCorpusLoadedDocument {
  readonly document: KnowledgeDocument;
  readonly contentHash: string;
}

const compareStableText = (left: string, right: string) => {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
};

const compareDocuments = (left: KnowledgeDocument, right: KnowledgeDocument) =>
  compareStableText(left.editorial?.manifestSourceId ?? left.id, right.editorial?.manifestSourceId ?? right.id) ||
  compareStableText(left.path, right.path) ||
  compareStableText(left.id, right.id);

const stringifyCanonical = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonical(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stringifyCanonical(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const hashCanonicalString = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export const formatGovernedCorpusCacheKey = (cacheKey: GovernedCorpusCacheKey) =>
  stringifyCanonical(cacheKey);

const isBlockingManifestIssue = (issue: KnowledgeManifestIssue) =>
  !NON_BLOCKING_MANIFEST_ISSUES.has(issue.code);

const buildManifestIssueDetails = (issues: KnowledgeManifestIssue[]) =>
  issues.map((issue) => ({
    code: issue.code,
    documentId: issue.documentId,
    filePath: issue.filePath,
  }));

const freezeDeep = <T>(value: T): DeepReadonly<T> => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    freezeDeep(nestedValue);
  }

  return Object.freeze(value) as DeepReadonly<T>;
};

const cloneDocumentForSnapshot = (document: KnowledgeDocument): Omit<KnowledgeDocument, "absolutePath"> => {
  const {
    absolutePath: _absolutePath,
    tags,
    sensitiveTopics,
    frontmatter,
    editorial,
    ...rest
  } = document;

  return {
    ...rest,
    tags: [...tags],
    sensitiveTopics: [...sensitiveTopics],
    frontmatter: { ...frontmatter },
    ...(editorial ? { editorial: { ...editorial } } : {}),
  };
};

const assertManifestIsUsable = (result: KnowledgeEditorialManifestResult): {
  manifest: KnowledgeEditorialManifest;
  status: Exclude<KnowledgeEditorialManifestResult["status"], "unavailable">;
  nonBlockingIssueCount: number;
} => {
  if (result.status === "unavailable") {
    throw new GovernedCorpusError(
      "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
      "Manifesto editorial indisponivel para montar o corpus governado.",
      {
        reason: result.reason,
        issues: buildManifestIssueDetails(result.issues),
      },
    );
  }

  const blockingIssues = result.issues.filter(isBlockingManifestIssue);
  if (blockingIssues.length > 0) {
    throw new GovernedCorpusError(
      "GOVERNED_CORPUS_MANIFEST_INVALID",
      "Manifesto editorial possui inconsistencias bloqueantes.",
      {
        issues: buildManifestIssueDetails(blockingIssues),
      },
    );
  }

  return {
    manifest: result.manifest,
    status: result.status,
    nonBlockingIssueCount: result.issues.length,
  };
};

const defaultLoadDocumentEntries = async (manifest: KnowledgeEditorialManifest) => {
  try {
    return await loadKnowledgeDocumentsWithContentHashesFromManifest(manifest);
  } catch (error) {
    if (error instanceof KnowledgeDocumentInvalidError) {
      throw new GovernedCorpusError(
        "GOVERNED_CORPUS_DOCUMENT_INVALID",
        "Documento autorizado pelo manifesto editorial possui conteudo invalido.",
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("KNOWLEDGE_FILE_")
    ) {
      throw error;
    }

    throw new GovernedCorpusError(
      "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
      "Falha ao carregar documento autorizado pelo manifesto editorial.",
    );
  }
};

const loadDocumentEntriesFailClosed = async (
  loadDocumentEntries: (manifest: KnowledgeEditorialManifest) => Promise<readonly GovernedCorpusLoadedDocument[]>,
  manifest: KnowledgeEditorialManifest,
) => {
  try {
    return await loadDocumentEntries(manifest);
  } catch (error) {
    if (error instanceof KnowledgeDocumentInvalidError) {
      throw new GovernedCorpusError(
        "GOVERNED_CORPUS_DOCUMENT_INVALID",
        "Documento autorizado pelo manifesto editorial possui conteudo invalido.",
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("KNOWLEDGE_FILE_")
    ) {
      throw error;
    }

    if (error instanceof GovernedCorpusError) {
      throw error;
    }

    throw new GovernedCorpusError(
      "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
      "Falha ao carregar documento autorizado pelo manifesto editorial.",
    );
  }
};

const buildDocumentValidationError = (message: string, details?: unknown) =>
  new GovernedCorpusError("GOVERNED_CORPUS_DOCUMENT_INVALID", message, details);

const buildContentHashValidationError = (details?: unknown) =>
  new GovernedCorpusError(
    "GOVERNED_CORPUS_CONTENT_HASH_INVALID",
    "Documento governado sem contentHash fisico valido.",
    details,
  );

const validateContentHash = (
  value: unknown,
  source: KnowledgeManifestSource,
): string => {
  if (typeof value !== "string" || !CONTENT_HASH_PATTERN.test(value)) {
    throw buildContentHashValidationError({
      manifestSourceId: source.manifestSourceId,
      documentId: source.documentId,
      filePath: source.filePath,
    });
  }

  return value;
};

const validateDocumentsAgainstManifest = (
  manifest: KnowledgeEditorialManifest,
  documents: KnowledgeDocument[],
) => {
  const sourcesByManifestSourceId = new Map(
    manifest.sources.map((source) => [source.manifestSourceId, source]),
  );
  const seenManifestSourceIds = new Set<string>();
  const seenDocumentIds = new Set<string>();
  const seenPaths = new Set<string>();

  if (documents.length !== manifest.sources.length) {
    throw buildDocumentValidationError(
      "Corpus governado nao corresponde ao manifesto editorial.",
      {
        expectedDocumentCount: manifest.sources.length,
        loadedDocumentCount: documents.length,
      },
    );
  }

  for (const document of documents) {
    const editorial = document.editorial;

    if (!editorial) {
      throw buildDocumentValidationError("Documento governado sem metadados editoriais.");
    }

    const source = sourcesByManifestSourceId.get(editorial.manifestSourceId);

    if (!source) {
      throw buildDocumentValidationError("Documento governado ausente do manifesto editorial.", {
        documentId: editorial.documentId,
        manifestSourceId: editorial.manifestSourceId,
      });
    }

    if (
      editorial.manifestFingerprint !== manifest.fingerprint ||
      editorial.documentId !== source.documentId ||
      editorial.bookId !== source.bookId ||
      editorial.documentVersion !== source.documentVersion ||
      document.id !== source.documentId ||
      document.path !== source.filePath
    ) {
      throw buildDocumentValidationError("Documento governado incompativel com a fonte editorial.", {
        documentId: source.documentId,
        manifestSourceId: source.manifestSourceId,
        filePath: source.filePath,
      });
    }

    if (document.content.trim().length === 0) {
      throw buildDocumentValidationError("Documento governado sem corpo util.", {
        documentId: source.documentId,
        manifestSourceId: source.manifestSourceId,
        filePath: source.filePath,
      });
    }

    if (seenManifestSourceIds.has(source.manifestSourceId)) {
      throw buildDocumentValidationError("Documento governado duplicado por fonte editorial.", {
        manifestSourceId: source.manifestSourceId,
      });
    }

    if (seenDocumentIds.has(document.id)) {
      throw buildDocumentValidationError("Documento governado duplicado por identificador.", {
        documentId: document.id,
      });
    }

    if (seenPaths.has(document.path)) {
      throw buildDocumentValidationError("Documento governado duplicado por caminho relativo.", {
        filePath: document.path,
      });
    }

    seenManifestSourceIds.add(source.manifestSourceId);
    seenDocumentIds.add(document.id);
    seenPaths.add(document.path);
  }
};

const buildCorpusFingerprint = (
  manifest: KnowledgeEditorialManifest,
  documentEntries: readonly GovernedCorpusLoadedDocument[],
) => {
  const documentEntriesByManifestSourceId = new Map(
    documentEntries.map((entry) => [entry.document.editorial?.manifestSourceId ?? "", entry]),
  );
  const canonicalSources = manifest.sources
    .map((source) => {
      const documentEntry = documentEntriesByManifestSourceId.get(source.manifestSourceId);

      if (!documentEntry) {
        throw buildContentHashValidationError({
          manifestSourceId: source.manifestSourceId,
          documentId: source.documentId,
          filePath: source.filePath,
        });
      }

      return {
        manifestSourceId: source.manifestSourceId,
        documentId: source.documentId,
        filePath: source.filePath,
        contentHash: validateContentHash(documentEntry.contentHash, source),
      };
    })
    .sort(
      (left, right) =>
        compareStableText(left.manifestSourceId, right.manifestSourceId) ||
        compareStableText(left.filePath, right.filePath) ||
        compareStableText(left.documentId, right.documentId),
    );

  return hashCanonicalString(stringifyCanonical({ schemaVersion: 1, sources: canonicalSources }));
};

const cacheKeysMatch = (
  left: GovernedCorpusCacheKey | undefined,
  right: GovernedCorpusCacheKey,
) =>
  Boolean(
    left &&
      left.manifestFingerprint === right.manifestFingerprint &&
      left.corpusFingerprint === right.corpusFingerprint,
  );

const sanitizeOperationalFailure = (error: unknown): {
  state: Extract<GovernedCorpusOperationalState, "invalid" | "unavailable">;
  code: GovernedCorpusOperationalFailureCode;
} => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("KNOWLEDGE_FILE_")
  ) {
    return {
      state: "unavailable",
      code: "GOVERNED_CORPUS_DOCUMENT_LOAD_FAILED",
    };
  }

  if (error instanceof GovernedCorpusError && OPERATIONAL_FAILURE_CODES.has(error.code)) {
    return {
      state: INVALID_GOVERNED_CORPUS_ERROR_CODES.has(error.code) ? "invalid" : "unavailable",
      code: error.code,
    };
  }

  return {
    state: "unavailable",
    code: "GOVERNED_CORPUS_UNKNOWN_ERROR",
  };
};

const countSnapshotChunks = (snapshot: GovernedCorpusSnapshot) =>
  splitDocumentsIntoChunks(snapshot.documents as readonly KnowledgeDocumentForRetrieval[]).length;

export const createGovernedCorpusService = (
  options: GovernedCorpusServiceOptions = {},
): GovernedCorpusService => {
  const loadManifest = options.loadManifest ?? (() => buildKnowledgeEditorialManifest());
  const loadDocumentEntries = options.loadDocumentEntries ?? defaultLoadDocumentEntries;
  const defaultNow = () => new Date();
  let now = options.now ?? defaultNow;
  let cachedSnapshot: GovernedCorpusSnapshot | undefined;
  let latestRequestedFingerprint: string | undefined;
  let operationalStatus = INITIAL_OPERATIONAL_STATUS;
  let nextOperationalAttemptId = 0;
  let latestOperationalAttemptId = 0;
  const inFlightByFingerprint = new Map<string, Promise<GovernedCorpusSnapshot>>();

  const getNowIso = () => now().toISOString();

  const setOperationalStatus = (nextStatus: GovernedCorpusOperationalStatus) => {
    operationalStatus = freezeDeep({ ...nextStatus }) as GovernedCorpusOperationalStatus;
  };

  const markAttemptStarted = (startedAt: string) => {
    const attemptId = ++nextOperationalAttemptId;
    latestOperationalAttemptId = attemptId;

    setOperationalStatus({
      ...operationalStatus,
      rebuilding: true,
      lastAttemptAt: startedAt,
    });

    return attemptId;
  };

  const isLatestOperationalAttempt = (attemptId: number) => attemptId === latestOperationalAttemptId;

  const markAttemptSucceeded = (
    attemptId: number,
    snapshot: GovernedCorpusSnapshot,
    options: {
      lastSuccessfulBuildAt?: string;
    },
  ) => {
    if (!isLatestOperationalAttempt(attemptId)) {
      return;
    }

    setOperationalStatus({
      state: snapshot.documentCount > 0 ? "ready" : "empty",
      rebuilding: false,
      stale: false,
      manifestSourceCount: snapshot.audit.manifestSourceCount,
      documentCount: snapshot.documentCount,
      chunkCount: countSnapshotChunks(snapshot),
      manifestFingerprint: snapshot.manifestFingerprint,
      corpusFingerprint: snapshot.corpusFingerprint,
      lastAttemptAt: operationalStatus.lastAttemptAt,
      lastSuccessfulBuildAt: options.lastSuccessfulBuildAt ?? operationalStatus.lastSuccessfulBuildAt,
      lastFailure: null,
    });
  };

  const markAttemptFailed = (
    attemptId: number,
    error: unknown,
    options: {
      occurredAt: string;
    },
  ) => {
    if (!isLatestOperationalAttempt(attemptId)) {
      return;
    }

    const hadPublishedSnapshot = Boolean(operationalStatus.corpusFingerprint);
    const failure = sanitizeOperationalFailure(error);

    setOperationalStatus({
      ...operationalStatus,
      state: failure.state,
      rebuilding: false,
      stale: hadPublishedSnapshot,
      lastFailure: {
        code: failure.code,
        occurredAt: options.occurredAt,
      },
    });
  };

  const buildSnapshotCandidate = async (
    manifest: KnowledgeEditorialManifest,
    manifestStatus: Exclude<KnowledgeEditorialManifestResult["status"], "unavailable">,
    nonBlockingIssueCount: number,
  ) => {
    const documentEntries = await loadDocumentEntriesFailClosed(loadDocumentEntries, manifest);
    const documents = documentEntries.map((entry) => entry.document);
    validateDocumentsAgainstManifest(manifest, documents);

    const corpusFingerprint = buildCorpusFingerprint(manifest, documentEntries);
    const cacheKey: GovernedCorpusCacheKey = {
      manifestFingerprint: manifest.fingerprint,
      corpusFingerprint,
    };
    const snapshotDocuments = [...documents]
      .sort(compareDocuments)
      .map(cloneDocumentForSnapshot);

    return {
      cacheKey,
      documents: snapshotDocuments,
      audit: {
        manifestStatus,
        manifestSourceCount: manifest.sources.length,
        loadedDocumentCount: snapshotDocuments.length,
        nonBlockingIssueCount,
      },
    };
  };

  const publishSnapshot = (
    candidate: Awaited<ReturnType<typeof buildSnapshotCandidate>>,
    manifest: KnowledgeEditorialManifest,
  ): GovernedCorpusSnapshot => {
    const snapshot: GovernedCorpusSnapshot = {
      cacheKey: candidate.cacheKey,
      manifestFingerprint: manifest.fingerprint,
      corpusFingerprint: candidate.cacheKey.corpusFingerprint,
      manifestSchemaVersion: manifest.schemaVersion,
      documents: candidate.documents,
      documentCount: candidate.documents.length,
      audit: candidate.audit,
    };

    return freezeDeep(snapshot);
  };

  return {
    async getSnapshot() {
      let manifestResult: KnowledgeEditorialManifestResult;
      try {
        manifestResult = await loadManifest();
      } catch (error) {
        const attemptId = markAttemptStarted(getNowIso());
        markAttemptFailed(attemptId, error, {
          occurredAt: getNowIso(),
        });
        throw error;
      }

      let usableManifest: ReturnType<typeof assertManifestIsUsable>;
      try {
        usableManifest = assertManifestIsUsable(manifestResult);
      } catch (error) {
        const attemptId = markAttemptStarted(getNowIso());
        markAttemptFailed(attemptId, error, {
          occurredAt: getNowIso(),
        });
        throw error;
      }

      const { manifest, status, nonBlockingIssueCount } = usableManifest;
      latestRequestedFingerprint = manifest.fingerprint;

      const currentBuild = inFlightByFingerprint.get(manifest.fingerprint);
      if (currentBuild) {
        return currentBuild;
      }

      const attemptId = markAttemptStarted(getNowIso());
      const promise = buildSnapshotCandidate(manifest, status, nonBlockingIssueCount)
        .then((candidate) => {
          if (cachedSnapshot && cacheKeysMatch(cachedSnapshot.cacheKey, candidate.cacheKey)) {
            markAttemptSucceeded(attemptId, cachedSnapshot, {});
            return cachedSnapshot;
          }

          const snapshot = publishSnapshot(candidate, manifest);

          if (isLatestOperationalAttempt(attemptId) && latestRequestedFingerprint === manifest.fingerprint) {
            cachedSnapshot = snapshot;
            markAttemptSucceeded(attemptId, snapshot, {
              lastSuccessfulBuildAt: getNowIso(),
            });
          }

          return snapshot;
        })
        .catch((error) => {
          markAttemptFailed(attemptId, error, {
            occurredAt: getNowIso(),
          });
          throw error;
        })
        .finally(() => {
          if (inFlightByFingerprint.get(manifest.fingerprint) === promise) {
            inFlightByFingerprint.delete(manifest.fingerprint);
          }
        });

      inFlightByFingerprint.set(manifest.fingerprint, promise);

      return promise;
    },
    getOperationalStatus() {
      return operationalStatus;
    },
    setNowProviderForTesting(nextNow: () => Date) {
      now = nextNow;
    },
    resetForTesting() {
      cachedSnapshot = undefined;
      latestRequestedFingerprint = undefined;
      nextOperationalAttemptId = 0;
      latestOperationalAttemptId = 0;
      inFlightByFingerprint.clear();
      operationalStatus = INITIAL_OPERATIONAL_STATUS;
      now = options.now ?? defaultNow;
    },
  };
};

export const governedCorpusService = createGovernedCorpusService();

export const getGovernedCorpusOperationalStatus = () =>
  governedCorpusService.getOperationalStatus();

export const setGovernedCorpusNowProviderForTesting = (now: () => Date) => {
  governedCorpusService.setNowProviderForTesting(now);
};

export const resetGovernedCorpusServiceForTesting = () => {
  governedCorpusService.resetForTesting();
};
