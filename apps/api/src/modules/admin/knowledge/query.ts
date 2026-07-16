import { AppError } from "../../../lib/app-error";
import {
  DEFAULT_KNOWLEDGE_PAGE,
  DEFAULT_KNOWLEDGE_PAGE_SIZE,
  KNOWLEDGE_BOOK_STATUSES,
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_EDITORIAL_STATUSES,
  MAX_KNOWLEDGE_ARRAY_ITEMS,
  MAX_KNOWLEDGE_ID_LENGTH,
  MAX_KNOWLEDGE_PAGE_SIZE,
  MAX_KNOWLEDGE_SUMMARY_LENGTH,
  MAX_KNOWLEDGE_TAG_LENGTH,
  MAX_KNOWLEDGE_TEXT_LENGTH,
  type CreateKnowledgeBookInput,
  type CreateKnowledgeDocumentInput,
  type KnowledgeBookSortField,
  type KnowledgeBookStatus,
  type KnowledgeDocumentSortField,
  type KnowledgeDocumentType,
  type KnowledgeEditorialStatus,
  type KnowledgeSortOrder,
  type ListKnowledgeBooksInput,
  type ListKnowledgeDocumentsInput,
  type TransitionKnowledgeDocumentInput,
  type UpdateKnowledgeBookInput,
  type UpdateKnowledgeDocumentInput,
} from "./types";

const BOOK_QUERY_KEYS = new Set(["status", "search", "sortBy", "sortOrder", "page", "pageSize"]);
const DOCUMENT_QUERY_KEYS = new Set([
  "bookId",
  "bookSlug",
  "type",
  "editorialStatus",
  "bookStatus",
  "teacherReviewRecommended",
  "hasSensitiveTopics",
  "search",
  "sortBy",
  "sortOrder",
  "page",
  "pageSize",
]);
const BOOK_SORT_FIELDS: KnowledgeBookSortField[] = ["title", "sortOrder", "createdAt", "updatedAt", "status"];
const DOCUMENT_SORT_FIELDS: KnowledgeDocumentSortField[] = [
  "title",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "type",
  "editorialStatus",
];
const SORT_ORDERS: KnowledgeSortOrder[] = ["asc", "desc"];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const buildInvalidQueryError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_KNOWLEDGE_QUERY",
    message: "Parâmetros inválidos para consultar a base de conhecimento.",
  });

const buildInvalidInputError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_KNOWLEDGE_INPUT",
    message: "Dados inválidos para administrar a base de conhecimento.",
  });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const assertAllowedKeys = (record: Record<string, unknown>, allowedKeys: Set<string>, error: AppError) => {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw error;
    }
  }
};

const getOptionalQueryString = (query: Record<string, unknown>, key: string) => {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value) || typeof value !== "string") {
    throw buildInvalidQueryError();
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseInteger = (value: unknown, error: AppError) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw error;
  }
  return value;
};

const parsePositiveVersion = (value: unknown) => {
  const version = parseInteger(value, buildInvalidInputError());
  if (version < 1) {
    throw buildInvalidInputError();
  }
  return version;
};

const parseOptionalIntegerQuery = (query: Record<string, unknown>, key: string) => {
  const value = getOptionalQueryString(query, key);
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d+$/u.test(value)) {
    throw buildInvalidQueryError();
  }
  const parsed = Number(value);
  if (parsed < 1) {
    throw buildInvalidQueryError();
  }
  return parsed;
};

const parseEnumQuery = <T extends string>(query: Record<string, unknown>, key: string, allowed: readonly T[]) => {
  const value = getOptionalQueryString(query, key);
  if (value === undefined) {
    return undefined;
  }
  if (!allowed.includes(value as T)) {
    throw buildInvalidQueryError();
  }
  return value as T;
};

const parseBooleanQuery = (query: Record<string, unknown>, key: string) => {
  const value = getOptionalQueryString(query, key);
  if (value === undefined) {
    return undefined;
  }
  if (value !== "true" && value !== "false") {
    throw buildInvalidQueryError();
  }
  return value === "true";
};

const parsePage = (query: Record<string, unknown>) => {
  const pageSize = parseOptionalIntegerQuery(query, "pageSize") ?? DEFAULT_KNOWLEDGE_PAGE_SIZE;
  if (pageSize > MAX_KNOWLEDGE_PAGE_SIZE) {
    throw buildInvalidQueryError();
  }
  return {
    page: parseOptionalIntegerQuery(query, "page") ?? DEFAULT_KNOWLEDGE_PAGE,
    pageSize,
  };
};

const parseOptionalText = (body: Record<string, unknown>, key: string, maxLength = MAX_KNOWLEDGE_TEXT_LENGTH) => {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw buildInvalidInputError();
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw buildInvalidInputError();
  }
  return trimmed;
};

const parseRequiredText = (body: Record<string, unknown>, key: string, maxLength = MAX_KNOWLEDGE_TEXT_LENGTH) => {
  const value = parseOptionalText(body, key, maxLength);
  if (!value) {
    throw buildInvalidInputError();
  }
  return value;
};

const parseOptionalIntegerBody = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  return parseInteger(value, buildInvalidInputError());
};

const parseOptionalBooleanBody = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw buildInvalidInputError();
  }
  return value;
};

const parseOptionalEnumBody = <T extends string>(body: Record<string, unknown>, key: string, allowed: readonly T[]) => {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw buildInvalidInputError();
  }
  return value as T;
};

const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

const parseSlug = (body: Record<string, unknown>, key: string, required: boolean) => {
  const value = required ? parseRequiredText(body, key, 120) : parseOptionalText(body, key, 120);
  if (value === undefined) {
    return undefined;
  }
  const slug = normalizeSlug(value);
  if (!SLUG_PATTERN.test(slug)) {
    throw buildInvalidInputError();
  }
  return slug;
};

const parseArray = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > MAX_KNOWLEDGE_ARRAY_ITEMS) {
    throw buildInvalidInputError();
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw buildInvalidInputError();
    }
    const trimmed = item.trim().toLowerCase();
    if (!trimmed || trimmed.length > MAX_KNOWLEDGE_TAG_LENGTH) {
      throw buildInvalidInputError();
    }
    return trimmed;
  });
};

const dedupe = (values: string[] | undefined) => values ? [...new Set(values)] : undefined;

const parseBody = (body: unknown, allowedKeys: Set<string>) => {
  if (!isPlainObject(body)) {
    throw buildInvalidInputError();
  }
  assertAllowedKeys(body, allowedKeys, buildInvalidInputError());
  return body;
};

export const parseKnowledgeRouteParam = (value: string | string[] | undefined) => {
  const normalized = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const trimmed = normalized.trim();
  if (!trimmed || trimmed.length > MAX_KNOWLEDGE_ID_LENGTH) {
    throw buildInvalidInputError();
  }
  return trimmed;
};

export const parseKnowledgeBooksListQuery = (query: Record<string, unknown>): ListKnowledgeBooksInput => {
  assertAllowedKeys(query, BOOK_QUERY_KEYS, buildInvalidQueryError());
  const search = getOptionalQueryString(query, "search");
  if (search && search.length > 120) {
    throw buildInvalidQueryError();
  }
  return {
    ...parsePage(query),
    status: parseEnumQuery<KnowledgeBookStatus>(query, "status", KNOWLEDGE_BOOK_STATUSES),
    search,
    sortBy: parseEnumQuery<KnowledgeBookSortField>(query, "sortBy", BOOK_SORT_FIELDS) ?? "sortOrder",
    sortOrder: parseEnumQuery<KnowledgeSortOrder>(query, "sortOrder", SORT_ORDERS) ?? "asc",
  };
};

export const parseKnowledgeDocumentsListQuery = (query: Record<string, unknown>): ListKnowledgeDocumentsInput => {
  assertAllowedKeys(query, DOCUMENT_QUERY_KEYS, buildInvalidQueryError());
  const search = getOptionalQueryString(query, "search");
  if (search && search.length > 120) {
    throw buildInvalidQueryError();
  }
  return {
    ...parsePage(query),
    bookId: getOptionalQueryString(query, "bookId"),
    bookSlug: getOptionalQueryString(query, "bookSlug"),
    type: parseEnumQuery<KnowledgeDocumentType>(query, "type", KNOWLEDGE_DOCUMENT_TYPES),
    editorialStatus: parseEnumQuery<KnowledgeEditorialStatus>(query, "editorialStatus", KNOWLEDGE_EDITORIAL_STATUSES),
    bookStatus: parseEnumQuery<KnowledgeBookStatus>(query, "bookStatus", KNOWLEDGE_BOOK_STATUSES),
    teacherReviewRecommended: parseBooleanQuery(query, "teacherReviewRecommended"),
    hasSensitiveTopics: parseBooleanQuery(query, "hasSensitiveTopics"),
    search,
    sortBy: parseEnumQuery<KnowledgeDocumentSortField>(query, "sortBy", DOCUMENT_SORT_FIELDS) ?? "sortOrder",
    sortOrder: parseEnumQuery<KnowledgeSortOrder>(query, "sortOrder", SORT_ORDERS) ?? "asc",
  };
};

export const parseCreateKnowledgeBookBody = (body: unknown): CreateKnowledgeBookInput => {
  const record = parseBody(body, new Set(["slug", "title", "description", "status", "sortOrder"]));
  return {
    slug: parseSlug(record, "slug", true) ?? "",
    title: parseRequiredText(record, "title", 200),
    description: parseOptionalText(record, "description") ?? "",
    status: parseOptionalEnumBody<KnowledgeBookStatus>(record, "status", KNOWLEDGE_BOOK_STATUSES) ?? "active",
    sortOrder: parseOptionalIntegerBody(record, "sortOrder") ?? 0,
  };
};

export const parseUpdateKnowledgeBookBody = (body: unknown): UpdateKnowledgeBookInput => {
  const record = parseBody(body, new Set(["slug", "title", "description", "status", "sortOrder", "version"]));
  const input: UpdateKnowledgeBookInput = { version: parsePositiveVersion(record.version) };
  const slug = parseSlug(record, "slug", false);
  const title = parseOptionalText(record, "title", 200);
  const description = parseOptionalText(record, "description");
  const status = parseOptionalEnumBody<KnowledgeBookStatus>(record, "status", KNOWLEDGE_BOOK_STATUSES);
  const sortOrder = parseOptionalIntegerBody(record, "sortOrder");
  if (slug !== undefined) input.slug = slug;
  if (title !== undefined) {
    if (!title) throw buildInvalidInputError();
    input.title = title;
  }
  if (description !== undefined) input.description = description;
  if (status !== undefined) input.status = status;
  if (sortOrder !== undefined) input.sortOrder = sortOrder;
  return input;
};

export const parseCreateKnowledgeDocumentBody = (body: unknown): CreateKnowledgeDocumentInput => {
  const record = parseBody(body, new Set([
    "bookId",
    "filePath",
    "catalogKey",
    "title",
    "description",
    "summary",
    "type",
    "tags",
    "sensitiveTopics",
    "teacherReviewRecommended",
    "editorialNotes",
    "sortOrder",
  ]));
  const sensitiveTopics = dedupe(parseArray(record, "sensitiveTopics")) ?? [];
  return {
    bookId: parseRequiredText(record, "bookId", MAX_KNOWLEDGE_ID_LENGTH),
    filePath: parseRequiredText(record, "filePath", 400),
    catalogKey: parseOptionalText(record, "catalogKey", 180) ?? null,
    title: parseRequiredText(record, "title", 240),
    description: parseOptionalText(record, "description") ?? "",
    summary: parseOptionalText(record, "summary", MAX_KNOWLEDGE_SUMMARY_LENGTH) ?? "",
    type: parseOptionalEnumBody<KnowledgeDocumentType>(record, "type", KNOWLEDGE_DOCUMENT_TYPES) ?? (() => {
      throw buildInvalidInputError();
    })(),
    tags: dedupe(parseArray(record, "tags")) ?? [],
    sensitiveTopics,
    teacherReviewRecommended: parseOptionalBooleanBody(record, "teacherReviewRecommended") ?? sensitiveTopics.length > 0,
    editorialNotes: parseOptionalText(record, "editorialNotes") ?? "",
    sortOrder: parseOptionalIntegerBody(record, "sortOrder") ?? 0,
  };
};

export const parseUpdateKnowledgeDocumentBody = (body: unknown): UpdateKnowledgeDocumentInput => {
  const record = parseBody(body, new Set([
    "bookId",
    "title",
    "description",
    "summary",
    "type",
    "tags",
    "sensitiveTopics",
    "teacherReviewRecommended",
    "editorialNotes",
    "sortOrder",
    "version",
  ]));
  const input: UpdateKnowledgeDocumentInput = { version: parsePositiveVersion(record.version) };
  const fields = {
    bookId: parseOptionalText(record, "bookId", MAX_KNOWLEDGE_ID_LENGTH),
    title: parseOptionalText(record, "title", 240),
    description: parseOptionalText(record, "description"),
    summary: parseOptionalText(record, "summary", MAX_KNOWLEDGE_SUMMARY_LENGTH),
    type: parseOptionalEnumBody<KnowledgeDocumentType>(record, "type", KNOWLEDGE_DOCUMENT_TYPES),
    tags: dedupe(parseArray(record, "tags")),
    sensitiveTopics: dedupe(parseArray(record, "sensitiveTopics")),
    teacherReviewRecommended: parseOptionalBooleanBody(record, "teacherReviewRecommended"),
    editorialNotes: parseOptionalText(record, "editorialNotes"),
    sortOrder: parseOptionalIntegerBody(record, "sortOrder"),
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      if (key === "title" && value === "") throw buildInvalidInputError();
      Object.assign(input, { [key]: value });
    }
  }
  return input;
};

export const parseTransitionKnowledgeDocumentBody = (body: unknown): TransitionKnowledgeDocumentInput => {
  const record = parseBody(body, new Set(["editorialStatus", "editorialNotes", "version"]));
  const editorialStatus = parseOptionalEnumBody<KnowledgeEditorialStatus>(record, "editorialStatus", KNOWLEDGE_EDITORIAL_STATUSES);
  if (!editorialStatus) {
    throw buildInvalidInputError();
  }
  const editorialNotes = parseOptionalText(record, "editorialNotes");
  return {
    editorialStatus,
    version: parsePositiveVersion(record.version),
    ...(editorialNotes !== undefined ? { editorialNotes } : {}),
  };
};
