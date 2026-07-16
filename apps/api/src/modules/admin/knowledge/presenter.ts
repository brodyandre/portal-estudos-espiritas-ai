import type {
  KnowledgeBookAggregate,
  KnowledgeBookRecord,
  KnowledgeDocumentRecord,
  PaginatedKnowledgeResult,
} from "./types";

export const presentKnowledgeBook = (book: KnowledgeBookRecord, aggregate?: KnowledgeBookAggregate) => ({
  id: book.id,
  slug: book.slug,
  title: book.title,
  description: book.description,
  status: book.status,
  sortOrder: book.sortOrder,
  version: book.version,
  createdAt: book.createdAt,
  updatedAt: book.updatedAt,
  ...(aggregate ? { aggregate } : {}),
});

export const presentKnowledgeBookList = (result: PaginatedKnowledgeResult<KnowledgeBookRecord>) => ({
  items: result.records.map((book) => presentKnowledgeBook(book)),
  meta: {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  },
});

export const presentKnowledgeDocument = (
  document: KnowledgeDocumentRecord,
  options: { fileExists?: boolean } = {},
) => ({
  id: document.id,
  book: document.book
    ? {
        id: document.book.id,
        slug: document.book.slug,
        title: document.book.title,
        status: document.book.status,
      }
    : { id: document.bookId },
  bookId: document.bookId,
  catalogKey: document.catalogKey,
  filePath: document.filePath,
  title: document.title,
  description: document.description,
  summary: document.summary,
  type: document.type,
  tags: document.tags,
  sensitiveTopics: document.sensitiveTopics,
  teacherReviewRecommended: document.teacherReviewRecommended,
  editorialStatus: document.editorialStatus,
  editorialNotes: document.editorialNotes,
  sortOrder: document.sortOrder,
  reviewedAt: document.reviewedAt,
  reviewedBy: document.reviewedByUserId
    ? {
        id: document.reviewedByUserId,
        name: document.reviewedByName ?? null,
      }
    : null,
  approvedAt: document.approvedAt,
  approvedBy: document.approvedByUserId
    ? {
        id: document.approvedByUserId,
        name: document.approvedByName ?? null,
      }
    : null,
  version: document.version,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
  ...(options.fileExists !== undefined ? { fileExists: options.fileExists } : {}),
});

export const presentKnowledgeDocumentList = (result: PaginatedKnowledgeResult<KnowledgeDocumentRecord>) => ({
  items: result.records.map((document) => presentKnowledgeDocument(document)),
  meta: {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  },
});
