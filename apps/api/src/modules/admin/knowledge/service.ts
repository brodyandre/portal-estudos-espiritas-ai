import { hasRole } from "../../../auth/roles";
import { AppError } from "../../../lib/app-error";
import type { AuthUser } from "../../auth/auth.types";
import { getKnowledgeFileExists, resolveKnowledgeFilePath } from "./filesystem";
import {
  createPrismaKnowledgeRepository,
  type KnowledgeRepository,
} from "./repository";
import type {
  CreateKnowledgeBookInput,
  CreateKnowledgeDocumentInput,
  KnowledgeBookRecord,
  KnowledgeDocumentRecord,
  KnowledgeEditorialStatus,
  ListKnowledgeBooksInput,
  ListKnowledgeDocumentsInput,
  TransitionKnowledgeDocumentInput,
  UpdateKnowledgeBookInput,
  UpdateKnowledgeDocumentInput,
} from "./types";

let knowledgeRepository: KnowledgeRepository = createPrismaKnowledgeRepository();

const assertAdminActor = (authUser: AuthUser | undefined) => {
  if (!authUser) {
    throw new AppError({
      statusCode: 401,
      code: "AUTH_REQUIRED",
      message: "Faça login no ambiente local para continuar.",
    });
  }
  if (!hasRole(authUser, "admin")) {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }
  return authUser;
};

const normalizeList = (values: string[]) => [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];

const assertSensitiveTopicRule = (sensitiveTopics: string[], teacherReviewRecommended: boolean) => {
  if (sensitiveTopics.length > 0 && !teacherReviewRecommended) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ADMIN_KNOWLEDGE_INPUT",
      message: "Temas sensíveis exigem recomendação de revisão por professor.",
    });
  }
};

const mapMutationResult = <T>(result: { status: "updated"; record: T } | { status: "not_found" } | { status: "conflict" }, notFoundCode: string, notFoundMessage: string) => {
  if (result.status === "updated") return result.record;
  if (result.status === "not_found") {
    throw new AppError({ statusCode: 404, code: notFoundCode, message: notFoundMessage });
  }
  throw new AppError({
    statusCode: 409,
    code: "KNOWLEDGE_CONFLICT",
    message: "O registro foi alterado por outro processo. Recarregue e tente novamente.",
  });
};

const assertBookExists = async (bookId: string) => {
  const book = await knowledgeRepository.findBookById(bookId);
  if (!book) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_BOOK_NOT_FOUND",
      message: "Livro da base de conhecimento não encontrado.",
    });
  }
  return book;
};

const assertActiveBookForDocument = (book: KnowledgeBookRecord) => {
  if (book.status === "archived") {
    throw new AppError({
      statusCode: 409,
      code: "KNOWLEDGE_BOOK_ARCHIVED",
      message: "Livro arquivado não aceita alterações editoriais ativas.",
    });
  }
};

export const listKnowledgeBooks = async (authUser: AuthUser | undefined, input: ListKnowledgeBooksInput) => {
  assertAdminActor(authUser);
  return knowledgeRepository.listBooks(input);
};

export const createKnowledgeBook = async (authUser: AuthUser | undefined, input: CreateKnowledgeBookInput) => {
  assertAdminActor(authUser);
  if (await knowledgeRepository.findBookBySlug(input.slug)) {
    throw new AppError({
      statusCode: 409,
      code: "KNOWLEDGE_BOOK_SLUG_ALREADY_EXISTS",
      message: "Já existe um livro com este slug.",
    });
  }
  return knowledgeRepository.createBook(input);
};

export const getKnowledgeBook = async (authUser: AuthUser | undefined, bookId: string) => {
  assertAdminActor(authUser);
  const book = await knowledgeRepository.findBookById(bookId);
  if (!book) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_BOOK_NOT_FOUND",
      message: "Livro da base de conhecimento não encontrado.",
    });
  }
  return {
    book,
    aggregate: await knowledgeRepository.getBookAggregate(book.id),
  };
};

export const updateKnowledgeBook = async (
  authUser: AuthUser | undefined,
  bookId: string,
  input: UpdateKnowledgeBookInput,
) => {
  assertAdminActor(authUser);
  if (input.slug) {
    const existing = await knowledgeRepository.findBookBySlug(input.slug);
    if (existing && existing.id !== bookId) {
      throw new AppError({
        statusCode: 409,
        code: "KNOWLEDGE_BOOK_SLUG_ALREADY_EXISTS",
        message: "Já existe um livro com este slug.",
      });
    }
  }
  return mapMutationResult(
    await knowledgeRepository.updateBook(bookId, input),
    "KNOWLEDGE_BOOK_NOT_FOUND",
    "Livro da base de conhecimento não encontrado.",
  );
};

export const listKnowledgeDocuments = async (authUser: AuthUser | undefined, input: ListKnowledgeDocumentsInput) => {
  assertAdminActor(authUser);
  return knowledgeRepository.listDocuments(input);
};

export const createKnowledgeDocument = async (
  authUser: AuthUser | undefined,
  input: CreateKnowledgeDocumentInput,
) => {
  assertAdminActor(authUser);
  const book = await assertBookExists(input.bookId);
  assertActiveBookForDocument(book);
  const file = await resolveKnowledgeFilePath(input.filePath);
  if (await knowledgeRepository.findDocumentByFilePath(file.filePath)) {
    throw new AppError({
      statusCode: 409,
      code: "KNOWLEDGE_DOCUMENT_ALREADY_EXISTS",
      message: "Já existe documento cadastrado para este arquivo.",
    });
  }
  if (input.catalogKey && await knowledgeRepository.findDocumentByCatalogKey(input.catalogKey)) {
    throw new AppError({
      statusCode: 409,
      code: "KNOWLEDGE_CATALOG_KEY_ALREADY_EXISTS",
      message: "Já existe documento cadastrado para esta chave de catálogo.",
    });
  }
  const sensitiveTopics = normalizeList(input.sensitiveTopics);
  const teacherReviewRecommended = input.teacherReviewRecommended || sensitiveTopics.length > 0;
  assertSensitiveTopicRule(sensitiveTopics, teacherReviewRecommended);
  return knowledgeRepository.createDocument({
    ...input,
    filePath: file.filePath,
    tags: normalizeList(input.tags),
    sensitiveTopics,
    teacherReviewRecommended,
  });
};

export const getKnowledgeDocument = async (authUser: AuthUser | undefined, documentId: string) => {
  assertAdminActor(authUser);
  const document = await knowledgeRepository.findDocumentById(documentId);
  if (!document) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_DOCUMENT_NOT_FOUND",
      message: "Documento da base de conhecimento não encontrado.",
    });
  }
  return {
    document,
    fileExists: await getKnowledgeFileExists(document.filePath),
  };
};

export const updateKnowledgeDocument = async (
  authUser: AuthUser | undefined,
  documentId: string,
  input: UpdateKnowledgeDocumentInput,
) => {
  assertAdminActor(authUser);
  if (input.bookId) {
    const book = await assertBookExists(input.bookId);
    assertActiveBookForDocument(book);
  }
  const current = await knowledgeRepository.findDocumentById(documentId);
  if (!current) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_DOCUMENT_NOT_FOUND",
      message: "Documento da base de conhecimento não encontrado.",
    });
  }
  const sensitiveTopics = input.sensitiveTopics !== undefined ? normalizeList(input.sensitiveTopics) : current.sensitiveTopics;
  const teacherReviewRecommended = input.teacherReviewRecommended ?? current.teacherReviewRecommended;
  assertSensitiveTopicRule(sensitiveTopics, teacherReviewRecommended);
  return mapMutationResult(
    await knowledgeRepository.updateDocument(documentId, {
      ...input,
      ...(input.tags !== undefined ? { tags: normalizeList(input.tags) } : {}),
      ...(input.sensitiveTopics !== undefined ? { sensitiveTopics } : {}),
    }),
    "KNOWLEDGE_DOCUMENT_NOT_FOUND",
    "Documento da base de conhecimento não encontrado.",
  );
};

const ALLOWED_TRANSITIONS: Record<KnowledgeEditorialStatus, KnowledgeEditorialStatus[]> = {
  draft: ["needs_review", "reviewed", "archived"],
  needs_review: ["reviewed", "archived"],
  reviewed: ["approved", "needs_review", "archived"],
  approved: ["needs_review", "archived"],
  archived: ["draft"],
};

const assertTransitionAllowed = (from: KnowledgeEditorialStatus, to: KnowledgeEditorialStatus) => {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new AppError({
      statusCode: 409,
      code: "KNOWLEDGE_EDITORIAL_TRANSITION_NOT_ALLOWED",
      message: "Transição editorial não permitida.",
    });
  }
};

export const transitionKnowledgeDocument = async (
  authUser: AuthUser | undefined,
  documentId: string,
  input: TransitionKnowledgeDocumentInput,
) => {
  const actor = assertAdminActor(authUser);
  const current = await knowledgeRepository.findDocumentById(documentId);
  if (!current) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_DOCUMENT_NOT_FOUND",
      message: "Documento da base de conhecimento não encontrado.",
    });
  }
  assertTransitionAllowed(current.editorialStatus, input.editorialStatus);
  if (input.editorialStatus === "approved") {
    if (!current.reviewedAt || !current.reviewedByUserId) {
      throw new AppError({
        statusCode: 409,
        code: "KNOWLEDGE_EDITORIAL_TRANSITION_NOT_ALLOWED",
        message: "Documento precisa de revisão antes da aprovação.",
      });
    }
    if (current.book?.status === "archived") {
      throw new AppError({
        statusCode: 409,
        code: "KNOWLEDGE_BOOK_ARCHIVED",
        message: "Livro arquivado não permite aprovação de documentos.",
      });
    }
  }
  const now = new Date(Date.now()).toISOString();
  const transitionData = {
    id: documentId,
    version: input.version,
    editorialStatus: input.editorialStatus,
    ...(input.editorialNotes !== undefined ? { editorialNotes: input.editorialNotes } : {}),
    ...(input.editorialStatus === "reviewed" ? { reviewedAt: now, reviewedByUserId: actor.id } : {}),
    ...(input.editorialStatus === "approved" ? { approvedAt: now, approvedByUserId: actor.id } : {}),
    ...(input.editorialStatus === "draft"
      ? { reviewedAt: null, reviewedByUserId: null, approvedAt: null, approvedByUserId: null }
      : {}),
    ...(input.editorialStatus === "needs_review"
      ? { approvedAt: null, approvedByUserId: null }
      : {}),
  };
  return mapMutationResult(
    await knowledgeRepository.transitionDocument(transitionData),
    "KNOWLEDGE_DOCUMENT_NOT_FOUND",
    "Documento da base de conhecimento não encontrado.",
  );
};

export const setKnowledgeRepositoryForTesting = (repository: KnowledgeRepository) => {
  knowledgeRepository = repository;
};

export const resetKnowledgeRepositoryForTesting = () => {
  knowledgeRepository = createPrismaKnowledgeRepository();
};

export const getKnowledgeRepositoryForCatalog = () => knowledgeRepository;
