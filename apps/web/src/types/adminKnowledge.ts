export const ADMIN_KNOWLEDGE_BOOK_STATUSES = ["active", "archived"] as const;
export const ADMIN_KNOWLEDGE_DOCUMENT_TYPES = [
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
export const ADMIN_KNOWLEDGE_EDITORIAL_STATUSES = [
  "draft",
  "needs_review",
  "reviewed",
  "approved",
  "archived",
] as const;

export type AdminKnowledgeBookStatus = (typeof ADMIN_KNOWLEDGE_BOOK_STATUSES)[number];
export type AdminKnowledgeDocumentType = (typeof ADMIN_KNOWLEDGE_DOCUMENT_TYPES)[number];
export type AdminKnowledgeEditorialStatus = (typeof ADMIN_KNOWLEDGE_EDITORIAL_STATUSES)[number];
export type AdminKnowledgeSortOrder = "asc" | "desc";
export type AdminKnowledgeBookSortBy = "title" | "sortOrder" | "createdAt" | "updatedAt" | "status";
export type AdminKnowledgeDocumentSortBy =
  | "title"
  | "sortOrder"
  | "createdAt"
  | "updatedAt"
  | "type"
  | "editorialStatus";

export interface AdminKnowledgePaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminKnowledgeBookAggregate {
  documentsTotal: number;
  documentsByEditorialStatus: Record<AdminKnowledgeEditorialStatus, number>;
}

export interface AdminKnowledgeBook {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: AdminKnowledgeBookStatus;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  aggregate?: AdminKnowledgeBookAggregate;
}

export interface AdminKnowledgeDocumentBookSummary {
  id: string;
  slug?: string;
  title?: string;
  status?: AdminKnowledgeBookStatus;
}

export interface AdminKnowledgeUserSummary {
  id: string;
  name: string | null;
}

export interface AdminKnowledgeDocument {
  id: string;
  bookId: string;
  book: AdminKnowledgeDocumentBookSummary;
  catalogKey: string | null;
  filePath: string;
  title: string;
  description: string;
  summary: string;
  type: AdminKnowledgeDocumentType;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  editorialStatus: AdminKnowledgeEditorialStatus;
  editorialNotes: string;
  sortOrder: number;
  reviewedAt: string | null;
  reviewedBy: AdminKnowledgeUserSummary | null;
  approvedAt: string | null;
  approvedBy: AdminKnowledgeUserSummary | null;
  fileExists?: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminKnowledgeBooksFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AdminKnowledgeBookStatus | "all";
  sortBy?: AdminKnowledgeBookSortBy;
  sortOrder?: AdminKnowledgeSortOrder;
}

export interface AdminKnowledgeDocumentsFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  bookId?: string;
  type?: AdminKnowledgeDocumentType | "all";
  editorialStatus?: AdminKnowledgeEditorialStatus | "all";
  teacherReviewRecommended?: boolean | "all";
  hasSensitiveTopics?: boolean | "all";
  sortBy?: AdminKnowledgeDocumentSortBy;
  sortOrder?: AdminKnowledgeSortOrder;
}

export interface CreateAdminKnowledgeBookInput {
  slug: string;
  title: string;
  description: string;
  status: AdminKnowledgeBookStatus;
  sortOrder: number;
}

export interface UpdateAdminKnowledgeBookInput {
  slug?: string;
  title?: string;
  description?: string;
  status?: AdminKnowledgeBookStatus;
  sortOrder?: number;
  version: number;
}

export interface CreateAdminKnowledgeDocumentInput {
  bookId: string;
  filePath: string;
  catalogKey: string | null;
  title: string;
  description: string;
  summary: string;
  type: AdminKnowledgeDocumentType;
  tags: string[];
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  editorialNotes: string;
  sortOrder: number;
}

export interface UpdateAdminKnowledgeDocumentInput {
  bookId?: string;
  title?: string;
  description?: string;
  summary?: string;
  type?: AdminKnowledgeDocumentType;
  tags?: string[];
  sensitiveTopics?: string[];
  teacherReviewRecommended?: boolean;
  editorialNotes?: string;
  sortOrder?: number;
  version: number;
}

export interface TransitionAdminKnowledgeDocumentInput {
  editorialStatus: AdminKnowledgeEditorialStatus;
  editorialNotes?: string;
  version: number;
}

export interface AdminKnowledgeListResult<TItem> {
  items: TItem[];
  meta: AdminKnowledgePaginationMeta;
}

export interface AdminKnowledgeConflictState<TDraft, TRecord> {
  draft: TDraft;
  current: TRecord | null;
  message: string;
}

export interface AdminKnowledgeBookFormState {
  slug: string;
  title: string;
  description: string;
  status: AdminKnowledgeBookStatus;
  sortOrder: string;
  version?: number;
}

export interface AdminKnowledgeDocumentFormState {
  bookId: string;
  filePath: string;
  catalogKey: string;
  title: string;
  description: string;
  summary: string;
  type: AdminKnowledgeDocumentType;
  tags: string;
  sensitiveTopics: string;
  teacherReviewRecommended: boolean;
  editorialNotes: string;
  sortOrder: string;
  version?: number;
}
