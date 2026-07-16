import { createHash } from "node:crypto";

import { loadKnowledgeDocumentsWithContentHashesFromManifest } from "../rag/documentLoader";
import type { KnowledgeDocument } from "../rag/types";
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

export interface GovernedCorpusServiceOptions {
  loadManifest?: () => Promise<KnowledgeEditorialManifestResult>;
  loadDocumentEntries?: (manifest: KnowledgeEditorialManifest) => Promise<readonly GovernedCorpusLoadedDocument[]>;
}

export interface GovernedCorpusService {
  getSnapshot(): Promise<GovernedCorpusSnapshot>;
  resetForTesting(): void;
}

const NON_BLOCKING_MANIFEST_ISSUES = new Set(["KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE"]);
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/u;

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

export const createGovernedCorpusService = (
  options: GovernedCorpusServiceOptions = {},
): GovernedCorpusService => {
  const loadManifest = options.loadManifest ?? (() => buildKnowledgeEditorialManifest());
  const loadDocumentEntries = options.loadDocumentEntries ?? defaultLoadDocumentEntries;
  let cachedSnapshot: GovernedCorpusSnapshot | undefined;
  let latestRequestedFingerprint: string | undefined;
  const inFlightByFingerprint = new Map<string, Promise<GovernedCorpusSnapshot>>();

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
      const manifestResult = await loadManifest();
      const { manifest, status, nonBlockingIssueCount } = assertManifestIsUsable(manifestResult);
      latestRequestedFingerprint = manifest.fingerprint;

      const currentBuild = inFlightByFingerprint.get(manifest.fingerprint);
      if (currentBuild) {
        return currentBuild;
      }

      const promise = buildSnapshotCandidate(manifest, status, nonBlockingIssueCount)
        .then((candidate) => {
          if (cachedSnapshot && cacheKeysMatch(cachedSnapshot.cacheKey, candidate.cacheKey)) {
            return cachedSnapshot;
          }

          const snapshot = publishSnapshot(candidate, manifest);

          if (latestRequestedFingerprint === manifest.fingerprint) {
            cachedSnapshot = snapshot;
          }

          return snapshot;
        })
        .finally(() => {
          if (inFlightByFingerprint.get(manifest.fingerprint) === promise) {
            inFlightByFingerprint.delete(manifest.fingerprint);
          }
        });

      inFlightByFingerprint.set(manifest.fingerprint, promise);

      return promise;
    },
    resetForTesting() {
      cachedSnapshot = undefined;
      latestRequestedFingerprint = undefined;
      inFlightByFingerprint.clear();
    },
  };
};

export const governedCorpusService = createGovernedCorpusService();

export const resetGovernedCorpusServiceForTesting = () => {
  governedCorpusService.resetForTesting();
};
