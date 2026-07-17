export type { GovernedCorpusOperationalStatus } from "../../../knowledge/governedCorpus";

export const KNOWLEDGE_BOOK_STATUSES = ["active", "archived"] as const;
export const KNOWLEDGE_DOCUMENT_TYPES = [
  "readme",
  "orientacoes",
  "demo",
  "visao_geral",
  "tema",
  "capitulo",
  "faq",
  "palavras_chave",
  "other",
] as const;
export const KNOWLEDGE_EDITORIAL_STATUSES = [
  "draft",
  "needs_review",
  "reviewed",
  "approved",
  "archived",
] as const;

export type KnowledgeBookStatus = (typeof KNOWLEDGE_BOOK_STATUSES)[number];
export type KnowledgeDocumentType = (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];
export type KnowledgeEditorialStatus = (typeof KNOWLEDGE_EDITORIAL_STATUSES)[number];
export type KnowledgeSortOrder = "asc" | "desc";
export type KnowledgeBookSortField = "title" | "sortOrder" | "createdAt" | "updatedAt" | "status";
export type KnowledgeDocumentSortField =
  | "title"
  | "sortOrder"
  | "createdAt"
  | "updatedAt"
  | "type"
  | "editorialStatus";

export const DEFAULT_KNOWLEDGE_PAGE = 1;
export const DEFAULT_KNOWLEDGE_PAGE_SIZE = 10;
export const MAX_KNOWLEDGE_PAGE_SIZE = 50;
export const MAX_KNOWLEDGE_TEXT_LENGTH = 2000;
export const MAX_KNOWLEDGE_SUMMARY_LENGTH = 8000;
export const MAX_KNOWLEDGE_ARRAY_ITEMS = 30;
export const MAX_KNOWLEDGE_TAG_LENGTH = 80;
export const MAX_KNOWLEDGE_ID_LENGTH = 160;

export interface KnowledgeBookRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: KnowledgeBookStatus;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBookAggregate {
  documentsTotal: number;
  documentsByEditorialStatus: Record<KnowledgeEditorialStatus, number>;
}

export interface KnowledgeDocumentRecord {
  id: string;
  bookId: string;
  catalogKey: string | null;
  filePath: string;
  title: string;
  description: string;
  summary: string;
  type: KnowledgeDocumentType;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  editorialStatus: KnowledgeEditorialStatus;
  editorialNotes: string;
  sortOrder: number;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByName?: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  approvedByName?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  book?: Pick<KnowledgeBookRecord, "id" | "slug" | "title" | "status">;
}

export interface PaginatedKnowledgeResult<T> {
  records: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListKnowledgeBooksInput {
  status?: KnowledgeBookStatus;
  search?: string;
  sortBy: KnowledgeBookSortField;
  sortOrder: KnowledgeSortOrder;
  page: number;
  pageSize: number;
}

export interface ListKnowledgeDocumentsInput {
  bookId?: string;
  bookSlug?: string;
  type?: KnowledgeDocumentType;
  editorialStatus?: KnowledgeEditorialStatus;
  bookStatus?: KnowledgeBookStatus;
  teacherReviewRecommended?: boolean;
  hasSensitiveTopics?: boolean;
  search?: string;
  sortBy: KnowledgeDocumentSortField;
  sortOrder: KnowledgeSortOrder;
  page: number;
  pageSize: number;
}

export interface CreateKnowledgeBookInput {
  slug: string;
  title: string;
  description: string;
  status: KnowledgeBookStatus;
  sortOrder: number;
}

export interface UpdateKnowledgeBookInput {
  slug?: string;
  title?: string;
  description?: string;
  status?: KnowledgeBookStatus;
  sortOrder?: number;
  version: number;
}

export interface CreateKnowledgeDocumentInput {
  bookId: string;
  filePath: string;
  catalogKey: string | null;
  title: string;
  description: string;
  summary: string;
  type: KnowledgeDocumentType;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  editorialNotes: string;
  sortOrder: number;
}

export interface UpdateKnowledgeDocumentInput {
  bookId?: string;
  title?: string;
  description?: string;
  summary?: string;
  type?: KnowledgeDocumentType;
  tags?: string[];
  sensitiveTopics?: string[];
  teacherReviewRecommended?: boolean;
  editorialNotes?: string;
  sortOrder?: number;
  version: number;
}

export interface TransitionKnowledgeDocumentInput {
  editorialStatus: KnowledgeEditorialStatus;
  editorialNotes?: string;
  version: number;
}

export interface KnowledgeFilesystemValidation {
  filePath: string;
  exists: boolean;
}

export interface KnowledgeCatalogEntry {
  catalogKey: string;
  filePath: string;
  title: string;
  bookTitle: string;
  type: KnowledgeDocumentType;
  description: string;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  sortOrder: number;
}

export interface KnowledgeCatalogResult {
  createdBooks: number;
  createdDocuments: number;
  updatedDocuments: number;
  unchangedDocuments: number;
  missingRegisteredFiles: string[];
  failedEntries: Array<{
    catalogKey?: string;
    filePath?: string;
    code: string;
  }>;
}

export type KnowledgeMutationResult<T> =
  | { status: "updated"; record: T }
  | { status: "not_found" }
  | { status: "conflict" };
