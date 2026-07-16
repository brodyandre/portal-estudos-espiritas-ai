import { loadKnowledgeDocumentsFromManifest } from "../rag/documentLoader";
import type { KnowledgeDocument } from "../rag/types";
import {
  buildKnowledgeEditorialManifest,
  type KnowledgeEditorialManifest,
  type KnowledgeEditorialManifestResult,
  type KnowledgeManifestIssue,
} from "./manifest";

export type GovernedCorpusErrorCode =
  | "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE"
  | "GOVERNED_CORPUS_MANIFEST_INVALID"
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

export interface GovernedCorpusSnapshot {
  readonly manifestFingerprint: string;
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
  loadDocuments?: (manifest: KnowledgeEditorialManifest) => Promise<KnowledgeDocument[]>;
}

export interface GovernedCorpusService {
  getSnapshot(): Promise<GovernedCorpusSnapshot>;
}

const NON_BLOCKING_MANIFEST_ISSUES = new Set(["KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE"]);

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

const defaultLoadDocuments = async (manifest: KnowledgeEditorialManifest) => {
  try {
    return await loadKnowledgeDocumentsFromManifest(manifest);
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

const loadDocumentsFailClosed = async (
  loadDocuments: (manifest: KnowledgeEditorialManifest) => Promise<KnowledgeDocument[]>,
  manifest: KnowledgeEditorialManifest,
) => {
  try {
    return await loadDocuments(manifest);
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

export const createGovernedCorpusService = (
  options: GovernedCorpusServiceOptions = {},
): GovernedCorpusService => {
  const loadManifest = options.loadManifest ?? (() => buildKnowledgeEditorialManifest());
  const loadDocuments = options.loadDocuments ?? defaultLoadDocuments;
  let cachedSnapshot: GovernedCorpusSnapshot | undefined;
  let latestRequestedFingerprint: string | undefined;
  const inFlightByFingerprint = new Map<string, Promise<GovernedCorpusSnapshot>>();

  const buildSnapshot = async (
    manifest: KnowledgeEditorialManifest,
    manifestStatus: Exclude<KnowledgeEditorialManifestResult["status"], "unavailable">,
    nonBlockingIssueCount: number,
  ): Promise<GovernedCorpusSnapshot> => {
    const documents = await loadDocumentsFailClosed(loadDocuments, manifest);
    const snapshotDocuments = [...documents]
      .sort(compareDocuments)
      .map(cloneDocumentForSnapshot);

    const snapshot: GovernedCorpusSnapshot = {
      manifestFingerprint: manifest.fingerprint,
      manifestSchemaVersion: manifest.schemaVersion,
      documents: snapshotDocuments,
      documentCount: snapshotDocuments.length,
      audit: {
        manifestStatus,
        manifestSourceCount: manifest.sources.length,
        loadedDocumentCount: snapshotDocuments.length,
        nonBlockingIssueCount,
      },
    };

    return freezeDeep(snapshot);
  };

  return {
    async getSnapshot() {
      const manifestResult = await loadManifest();
      const { manifest, status, nonBlockingIssueCount } = assertManifestIsUsable(manifestResult);
      latestRequestedFingerprint = manifest.fingerprint;

      if (cachedSnapshot?.manifestFingerprint === manifest.fingerprint) {
        return cachedSnapshot;
      }

      const currentBuild = inFlightByFingerprint.get(manifest.fingerprint);
      if (currentBuild) {
        return currentBuild;
      }

      const promise = buildSnapshot(manifest, status, nonBlockingIssueCount)
        .then((snapshot) => {
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
  };
};

export const governedCorpusService = createGovernedCorpusService();
