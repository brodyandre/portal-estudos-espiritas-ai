import { createHash } from "node:crypto";

import {
  KnowledgeBookStatus as PrismaKnowledgeBookStatus,
  KnowledgeDocumentType as PrismaKnowledgeDocumentType,
  KnowledgeEditorialStatus as PrismaKnowledgeEditorialStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { getPrismaClient } from "../database/prisma";
import {
  KnowledgeFileValidationError,
  type KnowledgeFilesystemValidationOptions,
  resolveKnowledgeFilePath,
} from "./filesystem";

const MANIFEST_SCHEMA_VERSION = 1;

export type KnowledgeManifestBookStatus = "active" | "archived";
export type KnowledgeManifestEditorialStatus =
  | "draft"
  | "needs_review"
  | "reviewed"
  | "approved"
  | "archived";
export type KnowledgeManifestDocumentType =
  | "readme"
  | "orientacoes"
  | "demo"
  | "visao_geral"
  | "tema"
  | "capitulo"
  | "faq"
  | "palavras_chave"
  | "other";

export interface KnowledgeManifestCatalogCandidate {
  documentId: string;
  bookId: string;
  catalogKey: string | null;
  filePath: string;
  documentTitle: string;
  description: string;
  summary: string;
  type: KnowledgeManifestDocumentType;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  editorialStatus: KnowledgeManifestEditorialStatus;
  documentVersion: number;
  documentSortOrder: number;
  documentUpdatedAt: string;
  book: {
    id: string;
    slug: string;
    title: string;
    status: KnowledgeManifestBookStatus;
    sortOrder: number;
    version: number;
    updatedAt: string;
  };
}

export interface KnowledgeManifestSource {
  manifestSourceId: string;
  documentId: string;
  bookId: string;
  catalogKey: string | null;
  documentTitle: string;
  bookTitle: string;
  bookSlug: string;
  documentVersion: number;
  filePath: string;
  type: KnowledgeManifestDocumentType;
  description: string;
  summary: string;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  origin: "catalog";
}

export interface KnowledgeEditorialManifest {
  schemaVersion: number;
  fingerprint: string;
  sources: KnowledgeManifestSource[];
}

export interface KnowledgeManifestIssue {
  code: string;
  documentId?: string;
  filePath?: string;
}

export type KnowledgeEditorialManifestResult =
  | {
      status: "ready";
      manifest: KnowledgeEditorialManifest;
      issues: KnowledgeManifestIssue[];
    }
  | {
      status: "empty";
      manifest: KnowledgeEditorialManifest;
      issues: KnowledgeManifestIssue[];
    }
  | {
      status: "unavailable";
      reason: "catalog_unavailable";
      issues: KnowledgeManifestIssue[];
    };

export interface KnowledgeManifestRepository {
  listManifestCandidates(): Promise<KnowledgeManifestCatalogCandidate[]>;
}

const prismaCandidateSelect = {
  id: true,
  bookId: true,
  catalogKey: true,
  filePath: true,
  title: true,
  description: true,
  summary: true,
  type: true,
  tags: true,
  sensitiveTopics: true,
  teacherReviewRecommended: true,
  editorialStatus: true,
  version: true,
  sortOrder: true,
  updatedAt: true,
  book: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      sortOrder: true,
      version: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.KnowledgeDocumentSelect;

type PrismaManifestCandidate = Prisma.KnowledgeDocumentGetPayload<{
  select: typeof prismaCandidateSelect;
}>;

type KnowledgeManifestPrismaClient = Pick<PrismaClient, "knowledgeDocument">;

const toBookStatus = (status: PrismaKnowledgeBookStatus): KnowledgeManifestBookStatus =>
  status === PrismaKnowledgeBookStatus.ACTIVE ? "active" : "archived";

const toDocumentType = (type: PrismaKnowledgeDocumentType): KnowledgeManifestDocumentType => {
  const map: Record<PrismaKnowledgeDocumentType, KnowledgeManifestDocumentType> = {
    README: "readme",
    ORIENTACOES: "orientacoes",
    DEMO: "demo",
    VISAO_GERAL: "visao_geral",
    TEMA: "tema",
    CAPITULO: "capitulo",
    FAQ: "faq",
    PALAVRAS_CHAVE: "palavras_chave",
    OTHER: "other",
  };
  return map[type];
};

const toEditorialStatus = (status: PrismaKnowledgeEditorialStatus): KnowledgeManifestEditorialStatus => {
  const map: Record<PrismaKnowledgeEditorialStatus, KnowledgeManifestEditorialStatus> = {
    DRAFT: "draft",
    NEEDS_REVIEW: "needs_review",
    REVIEWED: "reviewed",
    APPROVED: "approved",
    ARCHIVED: "archived",
  };
  return map[status];
};

const mapPrismaCandidate = (candidate: PrismaManifestCandidate): KnowledgeManifestCatalogCandidate => ({
  documentId: candidate.id,
  bookId: candidate.bookId,
  catalogKey: candidate.catalogKey,
  filePath: candidate.filePath,
  documentTitle: candidate.title,
  description: candidate.description,
  summary: candidate.summary,
  type: toDocumentType(candidate.type),
  tags: candidate.tags,
  sensitiveTopics: candidate.sensitiveTopics,
  teacherReviewRecommended: candidate.teacherReviewRecommended,
  editorialStatus: toEditorialStatus(candidate.editorialStatus),
  documentVersion: candidate.version,
  documentSortOrder: candidate.sortOrder,
  documentUpdatedAt: candidate.updatedAt.toISOString(),
  book: {
    id: candidate.book.id,
    slug: candidate.book.slug,
    title: candidate.book.title,
    status: toBookStatus(candidate.book.status),
    sortOrder: candidate.book.sortOrder,
    version: candidate.book.version,
    updatedAt: candidate.book.updatedAt.toISOString(),
  },
});

const normalizeStringList = (values: string[]) =>
  [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

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

const compareCandidates = (
  left: KnowledgeManifestCatalogCandidate,
  right: KnowledgeManifestCatalogCandidate,
) =>
  left.book.sortOrder - right.book.sortOrder ||
  left.documentSortOrder - right.documentSortOrder ||
  left.book.title.localeCompare(right.book.title) ||
  left.documentTitle.localeCompare(right.documentTitle) ||
  left.documentId.localeCompare(right.documentId);

const hasRequiredMetadata = (candidate: KnowledgeManifestCatalogCandidate) =>
  Boolean(
    candidate.documentId.trim() &&
      candidate.bookId.trim() &&
      candidate.filePath.trim() &&
      candidate.documentTitle.trim() &&
      candidate.book.id.trim() &&
      candidate.book.slug.trim() &&
      candidate.book.title.trim() &&
      Number.isInteger(candidate.documentVersion) &&
      candidate.documentVersion > 0,
  );

const buildManifestSource = (
  candidate: KnowledgeManifestCatalogCandidate,
  filePath: string,
): KnowledgeManifestSource => ({
  manifestSourceId: `${candidate.documentId}:${candidate.documentVersion}`,
  documentId: candidate.documentId,
  bookId: candidate.bookId,
  catalogKey: candidate.catalogKey,
  documentTitle: candidate.documentTitle.trim(),
  bookTitle: candidate.book.title.trim(),
  bookSlug: candidate.book.slug.trim(),
  documentVersion: candidate.documentVersion,
  filePath,
  type: candidate.type,
  description: candidate.description.trim(),
  summary: candidate.summary.trim(),
  tags: normalizeStringList(candidate.tags),
  sensitiveTopics: normalizeStringList(candidate.sensitiveTopics),
  teacherReviewRecommended: candidate.teacherReviewRecommended,
  origin: "catalog",
});

const buildFingerprint = (sources: KnowledgeManifestSource[]) => {
  const normalizedSources = sources.map((source) => ({
    manifestSourceId: source.manifestSourceId,
    documentId: source.documentId,
    bookId: source.bookId,
    catalogKey: source.catalogKey,
    documentTitle: source.documentTitle,
    bookTitle: source.bookTitle,
    bookSlug: source.bookSlug,
    documentVersion: source.documentVersion,
    filePath: source.filePath,
    type: source.type,
    description: source.description,
    summary: source.summary,
    tags: source.tags,
    sensitiveTopics: source.sensitiveTopics,
    teacherReviewRecommended: source.teacherReviewRecommended,
    origin: source.origin,
  }));

  return createHash("sha256")
    .update(stringifyCanonical({ schemaVersion: MANIFEST_SCHEMA_VERSION, sources: normalizedSources }))
    .digest("hex");
};

const buildManifest = (sources: KnowledgeManifestSource[]): KnowledgeEditorialManifest => ({
  schemaVersion: MANIFEST_SCHEMA_VERSION,
  fingerprint: buildFingerprint(sources),
  sources,
});

export const createPrismaKnowledgeManifestRepository = (
  prisma: KnowledgeManifestPrismaClient = getPrismaClient(),
): KnowledgeManifestRepository => ({
  async listManifestCandidates() {
    const records = await prisma.knowledgeDocument.findMany({
      where: {
        editorialStatus: PrismaKnowledgeEditorialStatus.APPROVED,
        book: {
          status: PrismaKnowledgeBookStatus.ACTIVE,
        },
      },
      select: prismaCandidateSelect,
      orderBy: [
        { book: { sortOrder: "asc" } },
        { sortOrder: "asc" },
        { title: "asc" },
        { id: "asc" },
      ],
    });

    return records.map(mapPrismaCandidate);
  },
});

export const createKnowledgeManifestFromCandidates = async (
  candidates: KnowledgeManifestCatalogCandidate[],
  options: KnowledgeFilesystemValidationOptions = {},
): Promise<{ manifest: KnowledgeEditorialManifest; issues: KnowledgeManifestIssue[] }> => {
  const sources: KnowledgeManifestSource[] = [];
  const issues: KnowledgeManifestIssue[] = [];
  const eligibleCandidates: Array<{
    candidate: KnowledgeManifestCatalogCandidate;
    issueIdentity: {
      documentId?: string;
      filePath?: string;
    };
    resolvedFilePath: string;
    realFilePath: string;
  }> = [];

  for (const candidate of [...candidates].sort(compareCandidates)) {
    const issueIdentity = {
      documentId: candidate.documentId || undefined,
      filePath: candidate.filePath || undefined,
    };

    if (!hasRequiredMetadata(candidate)) {
      issues.push({ ...issueIdentity, code: "KNOWLEDGE_MANIFEST_METADATA_INCOMPLETE" });
      continue;
    }

    if (candidate.book.status !== "active" || candidate.editorialStatus !== "approved") {
      issues.push({ ...issueIdentity, code: "KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE" });
      continue;
    }

    let resolvedFilePath: string;
    let realFilePath: string;
    try {
      const resolvedFile = await resolveKnowledgeFilePath(candidate.filePath, options);
      resolvedFilePath = resolvedFile.filePath;
      realFilePath = resolvedFile.realPath;
    } catch (error) {
      issues.push({
        ...issueIdentity,
        code: error instanceof KnowledgeFileValidationError
          ? error.code
          : "KNOWLEDGE_FILE_VALIDATION_FAILED",
      });
      continue;
    }

    eligibleCandidates.push({ candidate, issueIdentity, resolvedFilePath, realFilePath });
  }

  const documentCounts = new Map<string, number>();
  const fileCounts = new Map<string, number>();
  const realFileCounts = new Map<string, number>();
  for (const entry of eligibleCandidates) {
    documentCounts.set(entry.candidate.documentId, (documentCounts.get(entry.candidate.documentId) ?? 0) + 1);
    fileCounts.set(entry.resolvedFilePath, (fileCounts.get(entry.resolvedFilePath) ?? 0) + 1);
    realFileCounts.set(entry.realFilePath, (realFileCounts.get(entry.realFilePath) ?? 0) + 1);
  }

  for (const entry of eligibleCandidates) {
    if ((documentCounts.get(entry.candidate.documentId) ?? 0) > 1) {
      issues.push({ ...entry.issueIdentity, code: "KNOWLEDGE_MANIFEST_DUPLICATE_DOCUMENT" });
      continue;
    }

    if ((fileCounts.get(entry.resolvedFilePath) ?? 0) > 1 || (realFileCounts.get(entry.realFilePath) ?? 0) > 1) {
      issues.push({ ...entry.issueIdentity, code: "KNOWLEDGE_MANIFEST_DUPLICATE_FILE" });
      continue;
    }

    sources.push(buildManifestSource(entry.candidate, entry.resolvedFilePath));
  }

  return {
    manifest: buildManifest(sources),
    issues,
  };
};

export const buildKnowledgeEditorialManifest = async (options: {
  repository?: KnowledgeManifestRepository;
  filesystem?: KnowledgeFilesystemValidationOptions;
} = {}): Promise<KnowledgeEditorialManifestResult> => {
  const repository = options.repository ?? createPrismaKnowledgeManifestRepository();

  let candidates: KnowledgeManifestCatalogCandidate[];
  try {
    candidates = await repository.listManifestCandidates();
  } catch (_error) {
    return {
      status: "unavailable",
      reason: "catalog_unavailable",
      issues: [{ code: "KNOWLEDGE_MANIFEST_CATALOG_UNAVAILABLE" }],
    };
  }

  const { manifest, issues } = await createKnowledgeManifestFromCandidates(candidates, options.filesystem);

  return {
    status: manifest.sources.length > 0 ? "ready" : "empty",
    manifest,
    issues,
  };
};
