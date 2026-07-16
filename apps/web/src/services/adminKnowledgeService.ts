import { ServiceRequestError, requestJson } from "./api";
import type {
  AdminKnowledgeBook,
  AdminKnowledgeBookAggregate,
  AdminKnowledgeBooksFilters,
  AdminKnowledgeBookStatus,
  AdminKnowledgeDocument,
  AdminKnowledgeDocumentsFilters,
  AdminKnowledgeDocumentType,
  AdminKnowledgeEditorialStatus,
  AdminKnowledgeListResult,
  AdminKnowledgePaginationMeta,
  CreateAdminKnowledgeBookInput,
  CreateAdminKnowledgeDocumentInput,
  TransitionAdminKnowledgeDocumentInput,
  UpdateAdminKnowledgeBookInput,
  UpdateAdminKnowledgeDocumentInput,
} from "../types/adminKnowledge";
import {
  ADMIN_KNOWLEDGE_BOOK_STATUSES,
  ADMIN_KNOWLEDGE_DOCUMENT_TYPES,
  ADMIN_KNOWLEDGE_EDITORIAL_STATUSES,
} from "../types/adminKnowledge";

interface ApiListData {
  items: unknown;
}

const BASE_PATH = "/api/admin/knowledge";

const invalidEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para o catálogo editorial.",
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isStringOrNull = (value: unknown): value is string | null => isString(value) || value === null;
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isInteger = (value: unknown, minimum = 0): value is number =>
  typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= minimum;

const isBookStatus = (value: unknown): value is AdminKnowledgeBookStatus =>
  ADMIN_KNOWLEDGE_BOOK_STATUSES.includes(value as AdminKnowledgeBookStatus);

const isDocumentType = (value: unknown): value is AdminKnowledgeDocumentType =>
  ADMIN_KNOWLEDGE_DOCUMENT_TYPES.includes(value as AdminKnowledgeDocumentType);

const isEditorialStatus = (value: unknown): value is AdminKnowledgeEditorialStatus =>
  ADMIN_KNOWLEDGE_EDITORIAL_STATUSES.includes(value as AdminKnowledgeEditorialStatus);

const mapStringArray = (value: unknown) => {
  if (!Array.isArray(value) || !value.every(isString)) {
    throw invalidEnvelopeError();
  }
  return value;
};

const mapMeta = (value: unknown): AdminKnowledgePaginationMeta => {
  if (!isRecord(value)) throw invalidEnvelopeError();
  const { page, pageSize, total, totalPages } = value;
  if (!isInteger(page, 1) || !isInteger(pageSize, 1) || !isInteger(total) || !isInteger(totalPages)) {
    throw invalidEnvelopeError();
  }
  return { page, pageSize, total, totalPages };
};

const mapAggregate = (value: unknown): AdminKnowledgeBookAggregate => {
  if (!isRecord(value) || !isInteger(value.documentsTotal) || !isRecord(value.documentsByEditorialStatus)) {
    throw invalidEnvelopeError();
  }
  const documentsTotal = value.documentsTotal;
  const byStatus = value.documentsByEditorialStatus;
  const documentsByEditorialStatus = Object.fromEntries(
    ADMIN_KNOWLEDGE_EDITORIAL_STATUSES.map((status) => {
      const count = byStatus[status];
      if (!isInteger(count)) throw invalidEnvelopeError();
      return [status, count];
    }),
  ) as Record<AdminKnowledgeEditorialStatus, number>;
  return { documentsTotal, documentsByEditorialStatus };
};

const mapBook = (value: unknown): AdminKnowledgeBook => {
  if (!isRecord(value)) throw invalidEnvelopeError();
  const { id, slug, title, description, status, sortOrder, version, createdAt, updatedAt, aggregate } = value;
  if (
    !isString(id) ||
    !isString(slug) ||
    !isString(title) ||
    !isString(description) ||
    !isBookStatus(status) ||
    !isInteger(sortOrder) ||
    !isInteger(version, 1) ||
    !isString(createdAt) ||
    !isString(updatedAt)
  ) {
    throw invalidEnvelopeError();
  }
  return {
    id,
    slug,
    title,
    description,
    status,
    sortOrder,
    version,
    createdAt,
    updatedAt,
    ...(aggregate !== undefined ? { aggregate: mapAggregate(aggregate) } : {}),
  };
};

const mapBookSummary = (value: unknown) => {
  if (!isRecord(value) || !isString(value.id)) throw invalidEnvelopeError();
  if (value.slug !== undefined && !isString(value.slug)) throw invalidEnvelopeError();
  if (value.title !== undefined && !isString(value.title)) throw invalidEnvelopeError();
  if (value.status !== undefined && !isBookStatus(value.status)) throw invalidEnvelopeError();
  return {
    id: value.id,
    ...(value.slug !== undefined ? { slug: value.slug } : {}),
    ...(value.title !== undefined ? { title: value.title } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
  };
};

const mapUserSummary = (value: unknown) => {
  if (value === null) return null;
  if (!isRecord(value) || !isString(value.id) || !isStringOrNull(value.name)) throw invalidEnvelopeError();
  return { id: value.id, name: value.name };
};

const mapDocument = (value: unknown): AdminKnowledgeDocument => {
  if (!isRecord(value)) throw invalidEnvelopeError();
  const {
    id,
    book,
    bookId,
    catalogKey,
    filePath,
    title,
    description,
    summary,
    type,
    tags,
    sensitiveTopics,
    teacherReviewRecommended,
    editorialStatus,
    editorialNotes,
    sortOrder,
    reviewedAt,
    reviewedBy,
    approvedAt,
    approvedBy,
    fileExists,
    version,
    createdAt,
    updatedAt,
  } = value;

  if (
    !isString(id) ||
    !isString(bookId) ||
    !isStringOrNull(catalogKey) ||
    !isString(filePath) ||
    !isString(title) ||
    !isString(description) ||
    !isString(summary) ||
    !isDocumentType(type) ||
    !isBoolean(teacherReviewRecommended) ||
    !isEditorialStatus(editorialStatus) ||
    !isString(editorialNotes) ||
    !isInteger(sortOrder) ||
    !isStringOrNull(reviewedAt) ||
    !isStringOrNull(approvedAt) ||
    !isInteger(version, 1) ||
    !isString(createdAt) ||
    !isString(updatedAt)
  ) {
    throw invalidEnvelopeError();
  }

  if (fileExists !== undefined && !isBoolean(fileExists)) {
    throw invalidEnvelopeError();
  }

  return {
    id,
    bookId,
    book: mapBookSummary(book),
    catalogKey,
    filePath,
    title,
    description,
    summary,
    type,
    tags: mapStringArray(tags),
    sensitiveTopics: mapStringArray(sensitiveTopics),
    teacherReviewRecommended,
    editorialStatus,
    editorialNotes,
    sortOrder,
    reviewedAt,
    reviewedBy: mapUserSummary(reviewedBy),
    approvedAt,
    approvedBy: mapUserSummary(approvedBy),
    ...(fileExists !== undefined ? { fileExists } : {}),
    version,
    createdAt,
    updatedAt,
  };
};

const appendParam = (
  query: URLSearchParams,
  key: string,
  value: unknown,
) => {
  if (value === undefined || value === "all") return;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return;
  const serialized = typeof value === "string" ? value.trim() : String(value);
  if (serialized) query.set(key, serialized);
};

const buildPath = (path: string, params?: object) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) appendParam(query, key, value);
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
};

const mapList = <T>(payload: { data?: unknown; meta?: unknown }, mapper: (value: unknown) => T): AdminKnowledgeListResult<T> => {
  if (!isRecord(payload.data) || !Array.isArray(payload.data.items) || !payload.meta) {
    throw invalidEnvelopeError();
  }
  return {
    items: payload.data.items.map(mapper),
    meta: mapMeta(payload.meta),
  };
};

export const listAdminKnowledgeBooks = async (
  filters: AdminKnowledgeBooksFilters = {},
): Promise<AdminKnowledgeListResult<AdminKnowledgeBook>> => {
  const payload = await requestJson<ApiListData>({
    path: buildPath(`${BASE_PATH}/books`, filters),
  });
  return mapList(payload, mapBook);
};

export const createAdminKnowledgeBook = async (
  input: CreateAdminKnowledgeBookInput,
): Promise<AdminKnowledgeBook> => {
  const payload = await requestJson<unknown>({
    path: `${BASE_PATH}/books`,
    init: { method: "POST", body: JSON.stringify(input) },
  });
  return mapBook(payload.data);
};

export const getAdminKnowledgeBook = async (bookId: string): Promise<AdminKnowledgeBook> => {
  const payload = await requestJson<unknown>({
    path: `${BASE_PATH}/books/${encodeURIComponent(bookId)}`,
  });
  return mapBook(payload.data);
};

export const updateAdminKnowledgeBook = async (
  bookId: string,
  input: UpdateAdminKnowledgeBookInput,
): Promise<AdminKnowledgeBook> => {
  const payload = await requestJson<unknown>({
    path: `${BASE_PATH}/books/${encodeURIComponent(bookId)}`,
    init: { method: "PATCH", body: JSON.stringify(input) },
  });
  return mapBook(payload.data);
};

export const listAdminKnowledgeDocuments = async (
  filters: AdminKnowledgeDocumentsFilters = {},
): Promise<AdminKnowledgeListResult<AdminKnowledgeDocument>> => {
  const payload = await requestJson<ApiListData>({
    path: buildPath(`${BASE_PATH}/documents`, filters),
  });
  return mapList(payload, mapDocument);
};

export const createAdminKnowledgeDocument = async (
  input: CreateAdminKnowledgeDocumentInput,
): Promise<AdminKnowledgeDocument> => {
  const payload = await requestJson<unknown>({
    path: `${BASE_PATH}/documents`,
    init: { method: "POST", body: JSON.stringify(input) },
  });
  return mapDocument(payload.data);
};

export const getAdminKnowledgeDocument = async (
  documentId: string,
): Promise<AdminKnowledgeDocument> => {
  const payload = await requestJson<unknown>({
    path: `${BASE_PATH}/documents/${encodeURIComponent(documentId)}`,
  });
  return mapDocument(payload.data);
};

export const updateAdminKnowledgeDocument = async (
  documentId: string,
  input: UpdateAdminKnowledgeDocumentInput,
): Promise<AdminKnowledgeDocument> => {
  const payload = await requestJson<unknown>({
    path: `${BASE_PATH}/documents/${encodeURIComponent(documentId)}`,
    init: { method: "PATCH", body: JSON.stringify(input) },
  });
  return mapDocument(payload.data);
};

export const transitionAdminKnowledgeDocument = async (
  documentId: string,
  input: TransitionAdminKnowledgeDocumentInput,
): Promise<AdminKnowledgeDocument> => {
  const payload = await requestJson<unknown>({
    path: `${BASE_PATH}/documents/${encodeURIComponent(documentId)}/editorial-status`,
    init: { method: "PATCH", body: JSON.stringify(input) },
  });
  return mapDocument(payload.data);
};
