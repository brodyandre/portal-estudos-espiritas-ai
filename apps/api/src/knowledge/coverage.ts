import {
  GroupStatus as PrismaGroupStatus,
  KnowledgeBookStatus as PrismaKnowledgeBookStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { getPrismaClient } from "../database/prisma";
import {
  buildKnowledgeEditorialManifest,
  type KnowledgeEditorialManifestResult,
  type KnowledgeManifestDocumentType,
  type KnowledgeManifestIssue,
} from "./manifest";

export type KnowledgeCoverageStatus = "ready" | "incomplete" | "unavailable";
export type KnowledgeCoverageManifestStatus = "ready" | "empty" | "unavailable";

export type KnowledgeCoverageReason =
  | "STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK"
  | "STUDY_GROUP_KNOWLEDGE_BOOK_NOT_FOUND"
  | "STUDY_GROUP_KNOWLEDGE_BOOK_NOT_ACTIVE"
  | "NO_PEDAGOGICAL_MANIFEST_SOURCE";

export interface KnowledgeCoverageBookReport {
  bookId: string | null;
  bookSlug: string | null;
  bookTitle: string | null;
  studyGroupIds: string[];
  manifestSourceCount: number;
  pedagogicalSourceCount: number;
  covered: boolean;
  reasons: KnowledgeCoverageReason[];
}

export interface KnowledgeCoverageReport {
  status: KnowledgeCoverageStatus;
  manifestStatus: KnowledgeCoverageManifestStatus;
  targetBookCount: number;
  coveredBookCount: number;
  uncoveredBookCount: number;
  manifestSourceCount: number;
  books: KnowledgeCoverageBookReport[];
  manifestIssues: KnowledgeManifestIssue[];
}

export interface KnowledgeCoverageBookTarget {
  studyGroupId: string;
  knowledgeBookId: string | null;
  book: {
    id: string;
    slug: string;
    title: string;
    status: "active" | "archived";
  } | null;
}

export interface KnowledgeCoverageRepository {
  listActiveStudyGroupBookTargets(): Promise<KnowledgeCoverageBookTarget[]>;
}

const prismaStudyGroupTargetSelect = {
  id: true,
  status: true,
  knowledgeBookId: true,
  knowledgeBook: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
    },
  },
} satisfies Prisma.StudyGroupSelect;

type PrismaStudyGroupTarget = Prisma.StudyGroupGetPayload<{
  select: typeof prismaStudyGroupTargetSelect;
}>;

type KnowledgeCoveragePrismaClient = Pick<PrismaClient, "studyGroup">;

const toBookStatus = (status: PrismaKnowledgeBookStatus): "active" | "archived" =>
  status === PrismaKnowledgeBookStatus.ACTIVE ? "active" : "archived";

const mapPrismaTarget = (target: PrismaStudyGroupTarget): KnowledgeCoverageBookTarget => ({
  studyGroupId: target.id,
  knowledgeBookId: target.knowledgeBookId,
  book: target.knowledgeBook
    ? {
        id: target.knowledgeBook.id,
        slug: target.knowledgeBook.slug,
        title: target.knowledgeBook.title,
        status: toBookStatus(target.knowledgeBook.status),
      }
    : null,
});

export const createPrismaKnowledgeCoverageRepository = (
  prisma: KnowledgeCoveragePrismaClient = getPrismaClient(),
): KnowledgeCoverageRepository => ({
  async listActiveStudyGroupBookTargets() {
    const records = await prisma.studyGroup.findMany({
      where: { status: PrismaGroupStatus.ACTIVE },
      select: prismaStudyGroupTargetSelect,
      orderBy: [{ id: "asc" }],
    });

    return records.map(mapPrismaTarget);
  },
});

const PEDAGOGICAL_EXCLUDED_TYPES = new Set<KnowledgeManifestDocumentType>(["readme"]);

const compareReports = (left: KnowledgeCoverageBookReport, right: KnowledgeCoverageBookReport) =>
  (left.bookTitle ?? "").localeCompare(right.bookTitle ?? "") ||
  (left.bookSlug ?? "").localeCompare(right.bookSlug ?? "") ||
  (left.bookId ?? "").localeCompare(right.bookId ?? "") ||
  left.studyGroupIds[0].localeCompare(right.studyGroupIds[0]);

const buildUnavailableReport = (
  manifestStatus: KnowledgeCoverageManifestStatus,
  manifestIssues: KnowledgeManifestIssue[],
): KnowledgeCoverageReport => ({
  status: "unavailable",
  manifestStatus,
  targetBookCount: 0,
  coveredBookCount: 0,
  uncoveredBookCount: 0,
  manifestSourceCount: 0,
  books: [],
  manifestIssues,
});

export const evaluateKnowledgeCoverage = (
  targets: KnowledgeCoverageBookTarget[],
  manifestResult: KnowledgeEditorialManifestResult,
): KnowledgeCoverageReport => {
  if (manifestResult.status === "unavailable") {
    return buildUnavailableReport("unavailable", manifestResult.issues);
  }

  const manifestSources = manifestResult.manifest.sources;
  const reportsByBookId = new Map<string, KnowledgeCoverageBookReport>();
  const reports: KnowledgeCoverageBookReport[] = [];
  let hasStructuralIssue = false;

  for (const target of targets) {
    if (!target.knowledgeBookId) {
      hasStructuralIssue = true;
      reports.push({
        bookId: null,
        bookSlug: null,
        bookTitle: null,
        studyGroupIds: [target.studyGroupId],
        manifestSourceCount: 0,
        pedagogicalSourceCount: 0,
        covered: false,
        reasons: ["STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK"],
      });
      continue;
    }

    if (!target.book) {
      hasStructuralIssue = true;
      reports.push({
        bookId: target.knowledgeBookId,
        bookSlug: null,
        bookTitle: null,
        studyGroupIds: [target.studyGroupId],
        manifestSourceCount: 0,
        pedagogicalSourceCount: 0,
        covered: false,
        reasons: ["STUDY_GROUP_KNOWLEDGE_BOOK_NOT_FOUND"],
      });
      continue;
    }

    if (target.book.status !== "active") {
      hasStructuralIssue = true;
      reports.push({
        bookId: target.book.id,
        bookSlug: target.book.slug,
        bookTitle: target.book.title,
        studyGroupIds: [target.studyGroupId],
        manifestSourceCount: 0,
        pedagogicalSourceCount: 0,
        covered: false,
        reasons: ["STUDY_GROUP_KNOWLEDGE_BOOK_NOT_ACTIVE"],
      });
      continue;
    }

    const existing = reportsByBookId.get(target.book.id);
    if (existing) {
      existing.studyGroupIds.push(target.studyGroupId);
      existing.studyGroupIds.sort((left, right) => left.localeCompare(right));
      continue;
    }

    const bookSources = manifestSources.filter(
      (source) => source.origin === "catalog" && source.bookId === target.book?.id,
    );
    const pedagogicalSources = bookSources.filter((source) => !PEDAGOGICAL_EXCLUDED_TYPES.has(source.type));
    const covered = pedagogicalSources.length > 0;
    const report: KnowledgeCoverageBookReport = {
      bookId: target.book.id,
      bookSlug: target.book.slug,
      bookTitle: target.book.title,
      studyGroupIds: [target.studyGroupId],
      manifestSourceCount: bookSources.length,
      pedagogicalSourceCount: pedagogicalSources.length,
      covered,
      reasons: covered ? [] : ["NO_PEDAGOGICAL_MANIFEST_SOURCE"],
    };
    reportsByBookId.set(target.book.id, report);
    reports.push(report);
  }

  const books = reports.sort(compareReports);
  const coveredBookCount = books.filter((book) => book.covered).length;
  const uncoveredBookCount = books.length - coveredBookCount;
  const status: KnowledgeCoverageStatus =
    hasStructuralIssue ? "unavailable" : books.length > 0 && uncoveredBookCount === 0 ? "ready" : "incomplete";

  return {
    status,
    manifestStatus: manifestResult.status,
    targetBookCount: books.length,
    coveredBookCount,
    uncoveredBookCount,
    manifestSourceCount: manifestSources.length,
    books,
    manifestIssues: manifestResult.issues,
  };
};

export const buildKnowledgeCoverageReport = async (options: {
  repository?: KnowledgeCoverageRepository;
  loadManifest?: () => Promise<KnowledgeEditorialManifestResult>;
} = {}): Promise<KnowledgeCoverageReport> => {
  const repository = options.repository ?? createPrismaKnowledgeCoverageRepository();
  const loadManifest = options.loadManifest ?? (() => buildKnowledgeEditorialManifest());

  let targets: KnowledgeCoverageBookTarget[];
  try {
    targets = await repository.listActiveStudyGroupBookTargets();
  } catch (_error) {
    return buildUnavailableReport("unavailable", []);
  }

  let manifestResult: KnowledgeEditorialManifestResult;
  try {
    manifestResult = await loadManifest();
  } catch (_error) {
    return buildUnavailableReport("unavailable", [{ code: "KNOWLEDGE_COVERAGE_MANIFEST_UNAVAILABLE" }]);
  }

  return evaluateKnowledgeCoverage(targets, manifestResult);
};
