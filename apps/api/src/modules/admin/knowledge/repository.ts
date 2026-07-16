import {
  KnowledgeBookStatus as PrismaKnowledgeBookStatus,
  KnowledgeDocumentType as PrismaKnowledgeDocumentType,
  KnowledgeEditorialStatus as PrismaKnowledgeEditorialStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { getPrismaClient } from "../../../database/prisma";
import type {
  CreateKnowledgeBookInput,
  CreateKnowledgeDocumentInput,
  KnowledgeBookAggregate,
  KnowledgeBookRecord,
  KnowledgeBookStatus,
  KnowledgeDocumentRecord,
  KnowledgeDocumentType,
  KnowledgeEditorialStatus,
  KnowledgeMutationResult,
  ListKnowledgeBooksInput,
  ListKnowledgeDocumentsInput,
  PaginatedKnowledgeResult,
  UpdateKnowledgeBookInput,
  UpdateKnowledgeDocumentInput,
} from "./types";

export interface KnowledgeRepository {
  listBooks(input: ListKnowledgeBooksInput): Promise<PaginatedKnowledgeResult<KnowledgeBookRecord>>;
  createBook(input: CreateKnowledgeBookInput): Promise<KnowledgeBookRecord>;
  findBookById(id: string): Promise<KnowledgeBookRecord | null>;
  findBookBySlug(slug: string): Promise<KnowledgeBookRecord | null>;
  getBookAggregate(bookId: string): Promise<KnowledgeBookAggregate>;
  updateBook(id: string, input: UpdateKnowledgeBookInput): Promise<KnowledgeMutationResult<KnowledgeBookRecord>>;
  listDocuments(input: ListKnowledgeDocumentsInput): Promise<PaginatedKnowledgeResult<KnowledgeDocumentRecord>>;
  createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord>;
  findDocumentById(id: string): Promise<KnowledgeDocumentRecord | null>;
  findDocumentByFilePath(filePath: string): Promise<KnowledgeDocumentRecord | null>;
  findDocumentByCatalogKey(catalogKey: string): Promise<KnowledgeDocumentRecord | null>;
  updateDocument(id: string, input: UpdateKnowledgeDocumentInput): Promise<KnowledgeMutationResult<KnowledgeDocumentRecord>>;
  transitionDocument(input: {
    id: string;
    version: number;
    editorialStatus: KnowledgeEditorialStatus;
    editorialNotes?: string;
    reviewedAt?: string | null;
    reviewedByUserId?: string | null;
    approvedAt?: string | null;
    approvedByUserId?: string | null;
  }): Promise<KnowledgeMutationResult<KnowledgeDocumentRecord>>;
  upsertCatalogBook(input: CreateKnowledgeBookInput): Promise<{ record: KnowledgeBookRecord; created: boolean }>;
  upsertCatalogDocument(input: CreateKnowledgeDocumentInput): Promise<{ record: KnowledgeDocumentRecord; created: boolean; changed: boolean }>;
}

type PrismaKnowledgeDocumentWithRelations = Prisma.KnowledgeDocumentGetPayload<{
  include: {
    book: true;
    reviewedByUser: { select: { fullName: true } };
    approvedByUser: { select: { fullName: true } };
  };
}>;

const toBookStatus = (status: PrismaKnowledgeBookStatus): KnowledgeBookStatus =>
  status === PrismaKnowledgeBookStatus.ACTIVE ? "active" : "archived";

const toPrismaBookStatus = (status: KnowledgeBookStatus): PrismaKnowledgeBookStatus =>
  status === "active" ? PrismaKnowledgeBookStatus.ACTIVE : PrismaKnowledgeBookStatus.ARCHIVED;

const toDocumentType = (type: PrismaKnowledgeDocumentType): KnowledgeDocumentType => {
  const map: Record<PrismaKnowledgeDocumentType, KnowledgeDocumentType> = {
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

const toPrismaDocumentType = (type: KnowledgeDocumentType): PrismaKnowledgeDocumentType => {
  const map: Record<KnowledgeDocumentType, PrismaKnowledgeDocumentType> = {
    readme: PrismaKnowledgeDocumentType.README,
    orientacoes: PrismaKnowledgeDocumentType.ORIENTACOES,
    demo: PrismaKnowledgeDocumentType.DEMO,
    visao_geral: PrismaKnowledgeDocumentType.VISAO_GERAL,
    tema: PrismaKnowledgeDocumentType.TEMA,
    capitulo: PrismaKnowledgeDocumentType.CAPITULO,
    faq: PrismaKnowledgeDocumentType.FAQ,
    palavras_chave: PrismaKnowledgeDocumentType.PALAVRAS_CHAVE,
    other: PrismaKnowledgeDocumentType.OTHER,
  };
  return map[type];
};

const toEditorialStatus = (status: PrismaKnowledgeEditorialStatus): KnowledgeEditorialStatus => {
  const map: Record<PrismaKnowledgeEditorialStatus, KnowledgeEditorialStatus> = {
    DRAFT: "draft",
    NEEDS_REVIEW: "needs_review",
    REVIEWED: "reviewed",
    APPROVED: "approved",
    ARCHIVED: "archived",
  };
  return map[status];
};

const toPrismaEditorialStatus = (status: KnowledgeEditorialStatus): PrismaKnowledgeEditorialStatus => {
  const map: Record<KnowledgeEditorialStatus, PrismaKnowledgeEditorialStatus> = {
    draft: PrismaKnowledgeEditorialStatus.DRAFT,
    needs_review: PrismaKnowledgeEditorialStatus.NEEDS_REVIEW,
    reviewed: PrismaKnowledgeEditorialStatus.REVIEWED,
    approved: PrismaKnowledgeEditorialStatus.APPROVED,
    archived: PrismaKnowledgeEditorialStatus.ARCHIVED,
  };
  return map[status];
};

const toIso = (date: Date) => date.toISOString();
const nullableIso = (date: Date | null) => (date ? date.toISOString() : null);

const mapPrismaBook = (book: Prisma.KnowledgeBookGetPayload<object>): KnowledgeBookRecord => ({
  id: book.id,
  slug: book.slug,
  title: book.title,
  description: book.description,
  status: toBookStatus(book.status),
  sortOrder: book.sortOrder,
  version: book.version,
  createdAt: toIso(book.createdAt),
  updatedAt: toIso(book.updatedAt),
});

const mapPrismaDocument = (document: PrismaKnowledgeDocumentWithRelations): KnowledgeDocumentRecord => ({
  id: document.id,
  bookId: document.bookId,
  catalogKey: document.catalogKey,
  filePath: document.filePath,
  title: document.title,
  description: document.description,
  summary: document.summary,
  type: toDocumentType(document.type),
  tags: document.tags,
  sensitiveTopics: document.sensitiveTopics,
  teacherReviewRecommended: document.teacherReviewRecommended,
  editorialStatus: toEditorialStatus(document.editorialStatus),
  editorialNotes: document.editorialNotes,
  sortOrder: document.sortOrder,
  reviewedAt: nullableIso(document.reviewedAt),
  reviewedByUserId: document.reviewedByUserId,
  reviewedByName: document.reviewedByUser?.fullName ?? null,
  approvedAt: nullableIso(document.approvedAt),
  approvedByUserId: document.approvedByUserId,
  approvedByName: document.approvedByUser?.fullName ?? null,
  version: document.version,
  createdAt: toIso(document.createdAt),
  updatedAt: toIso(document.updatedAt),
  book: {
    id: document.book.id,
    slug: document.book.slug,
    title: document.book.title,
    status: toBookStatus(document.book.status),
  },
});

const buildTotalPages = (total: number, pageSize: number) => Math.ceil(total / pageSize);

const documentInclude = {
  book: true,
  reviewedByUser: { select: { fullName: true } },
  approvedByUser: { select: { fullName: true } },
} satisfies Prisma.KnowledgeDocumentInclude;

type KnowledgePrismaClient = Pick<PrismaClient, "knowledgeBook" | "knowledgeDocument" | "$transaction">;

export const createPrismaKnowledgeRepository = (
  prisma: KnowledgePrismaClient = getPrismaClient(),
): KnowledgeRepository => {
  const listBooksWhere = (input: ListKnowledgeBooksInput): Prisma.KnowledgeBookWhereInput => ({
    ...(input.status ? { status: toPrismaBookStatus(input.status) } : {}),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  });

  const listDocumentsWhere = (input: ListKnowledgeDocumentsInput): Prisma.KnowledgeDocumentWhereInput => ({
    ...(input.bookId ? { bookId: input.bookId } : {}),
    ...(input.bookSlug || input.bookStatus
      ? {
          book: {
            ...(input.bookSlug ? { slug: input.bookSlug } : {}),
            ...(input.bookStatus ? { status: toPrismaBookStatus(input.bookStatus) } : {}),
          },
        }
      : {}),
    ...(input.type ? { type: toPrismaDocumentType(input.type) } : {}),
    ...(input.editorialStatus ? { editorialStatus: toPrismaEditorialStatus(input.editorialStatus) } : {}),
    ...(input.teacherReviewRecommended !== undefined
      ? { teacherReviewRecommended: input.teacherReviewRecommended }
      : {}),
    ...(input.hasSensitiveTopics !== undefined
      ? { sensitiveTopics: input.hasSensitiveTopics ? { isEmpty: false } : { isEmpty: true } }
      : {}),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
            { summary: { contains: input.search, mode: "insensitive" } },
            { filePath: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  });

  return {
    async listBooks(input) {
      const where = listBooksWhere(input);
      const orderBy = [{ [input.sortBy]: input.sortOrder }, { id: "asc" }] as Prisma.KnowledgeBookOrderByWithRelationInput[];
      const [records, total] = await prisma.$transaction([
        prisma.knowledgeBook.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        prisma.knowledgeBook.count({ where }),
      ]);
      return { records: records.map(mapPrismaBook), page: input.page, pageSize: input.pageSize, total, totalPages: buildTotalPages(total, input.pageSize) };
    },
    async createBook(input) {
      return mapPrismaBook(await prisma.knowledgeBook.create({
        data: { ...input, status: toPrismaBookStatus(input.status) },
      }));
    },
    async findBookById(id) {
      const book = await prisma.knowledgeBook.findUnique({ where: { id } });
      return book ? mapPrismaBook(book) : null;
    },
    async findBookBySlug(slug) {
      const book = await prisma.knowledgeBook.findUnique({ where: { slug } });
      return book ? mapPrismaBook(book) : null;
    },
    async getBookAggregate(bookId) {
      const documents = await prisma.knowledgeDocument.groupBy({
        by: ["editorialStatus"],
        where: { bookId },
        _count: { _all: true },
      });
      const documentsByEditorialStatus = {
        draft: 0,
        needs_review: 0,
        reviewed: 0,
        approved: 0,
        archived: 0,
      };
      for (const item of documents) {
        documentsByEditorialStatus[toEditorialStatus(item.editorialStatus)] = item._count._all;
      }
      return {
        documentsTotal: documents.reduce((total, item) => total + item._count._all, 0),
        documentsByEditorialStatus,
      };
    },
    async updateBook(id, input) {
      const data: Prisma.KnowledgeBookUpdateManyMutationInput = {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: toPrismaBookStatus(input.status) } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        version: { increment: 1 },
      };
      const result = await prisma.knowledgeBook.updateMany({ where: { id, version: input.version }, data });
      if (result.count === 0) {
        return (await prisma.knowledgeBook.findUnique({ where: { id } })) ? { status: "conflict" } : { status: "not_found" };
      }
      const record = await prisma.knowledgeBook.findUniqueOrThrow({ where: { id } });
      return { status: "updated", record: mapPrismaBook(record) };
    },
    async listDocuments(input) {
      const where = listDocumentsWhere(input);
      const orderBy = [{ [input.sortBy]: input.sortOrder }, { id: "asc" }] as Prisma.KnowledgeDocumentOrderByWithRelationInput[];
      const [records, total] = await prisma.$transaction([
        prisma.knowledgeDocument.findMany({
          where,
          include: documentInclude,
          orderBy,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        prisma.knowledgeDocument.count({ where }),
      ]);
      return { records: records.map(mapPrismaDocument), page: input.page, pageSize: input.pageSize, total, totalPages: buildTotalPages(total, input.pageSize) };
    },
    async createDocument(input) {
      return mapPrismaDocument(await prisma.knowledgeDocument.create({
        data: {
          ...input,
          catalogKey: input.catalogKey,
          type: toPrismaDocumentType(input.type),
        },
        include: documentInclude,
      }));
    },
    async findDocumentById(id) {
      const document = await prisma.knowledgeDocument.findUnique({ where: { id }, include: documentInclude });
      return document ? mapPrismaDocument(document) : null;
    },
    async findDocumentByFilePath(filePath) {
      const document = await prisma.knowledgeDocument.findUnique({ where: { filePath }, include: documentInclude });
      return document ? mapPrismaDocument(document) : null;
    },
    async findDocumentByCatalogKey(catalogKey) {
      const document = await prisma.knowledgeDocument.findUnique({ where: { catalogKey }, include: documentInclude });
      return document ? mapPrismaDocument(document) : null;
    },
    async updateDocument(id, input) {
      const data: Prisma.KnowledgeDocumentUpdateManyMutationInput = {
        ...(input.bookId !== undefined ? { bookId: input.bookId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.type !== undefined ? { type: toPrismaDocumentType(input.type) } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.sensitiveTopics !== undefined ? { sensitiveTopics: input.sensitiveTopics } : {}),
        ...(input.teacherReviewRecommended !== undefined ? { teacherReviewRecommended: input.teacherReviewRecommended } : {}),
        ...(input.editorialNotes !== undefined ? { editorialNotes: input.editorialNotes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        version: { increment: 1 },
      };
      const result = await prisma.knowledgeDocument.updateMany({ where: { id, version: input.version }, data });
      if (result.count === 0) {
        return (await prisma.knowledgeDocument.findUnique({ where: { id } })) ? { status: "conflict" } : { status: "not_found" };
      }
      return { status: "updated", record: mapPrismaDocument(await prisma.knowledgeDocument.findUniqueOrThrow({ where: { id }, include: documentInclude })) };
    },
    async transitionDocument(input) {
      const data: Prisma.KnowledgeDocumentUpdateManyMutationInput = {
        editorialStatus: toPrismaEditorialStatus(input.editorialStatus),
        ...(input.editorialNotes !== undefined ? { editorialNotes: input.editorialNotes } : {}),
        ...(input.reviewedAt !== undefined ? { reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null } : {}),
        ...(input.reviewedByUserId !== undefined ? { reviewedByUserId: input.reviewedByUserId } : {}),
        ...(input.approvedAt !== undefined ? { approvedAt: input.approvedAt ? new Date(input.approvedAt) : null } : {}),
        ...(input.approvedByUserId !== undefined ? { approvedByUserId: input.approvedByUserId } : {}),
        version: { increment: 1 },
      };
      const result = await prisma.knowledgeDocument.updateMany({ where: { id: input.id, version: input.version }, data });
      if (result.count === 0) {
        return (await prisma.knowledgeDocument.findUnique({ where: { id: input.id } })) ? { status: "conflict" } : { status: "not_found" };
      }
      return { status: "updated", record: mapPrismaDocument(await prisma.knowledgeDocument.findUniqueOrThrow({ where: { id: input.id }, include: documentInclude })) };
    },
    async upsertCatalogBook(input) {
      const existing = await prisma.knowledgeBook.findUnique({ where: { slug: input.slug } });
      if (existing) {
        return { record: mapPrismaBook(existing), created: false };
      }
      return { record: await this.createBook(input), created: true };
    },
    async upsertCatalogDocument(input) {
      const existing = await prisma.knowledgeDocument.findUnique({ where: { filePath: input.filePath }, include: documentInclude });
      if (!existing) {
        return { record: await this.createDocument(input), created: true, changed: true };
      }
      return { record: mapPrismaDocument(existing), created: false, changed: false };
    },
  };
};

const cloneBook = (book: KnowledgeBookRecord): KnowledgeBookRecord => ({ ...book });
const cloneDocument = (document: KnowledgeDocumentRecord): KnowledgeDocumentRecord => ({
  ...document,
  tags: [...document.tags],
  sensitiveTopics: [...document.sensitiveTopics],
  book: document.book ? { ...document.book } : undefined,
});

export interface MemoryKnowledgeState {
  books: KnowledgeBookRecord[];
  documents: KnowledgeDocumentRecord[];
}

export const createMemoryKnowledgeState = (state: Partial<MemoryKnowledgeState> = {}): MemoryKnowledgeState => ({
  books: (state.books ?? []).map(cloneBook),
  documents: (state.documents ?? []).map(cloneDocument),
});

export const createMemoryKnowledgeRepository = (
  state = createMemoryKnowledgeState(),
  options: { nowProvider?: () => Date; idProvider?: () => string } = {},
): KnowledgeRepository => {
  const nowProvider = options.nowProvider ?? (() => new Date(Date.now()));
  const idProvider = options.idProvider ?? (() => `knowledge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const hydrateDocument = (document: KnowledgeDocumentRecord) => {
    const book = state.books.find((item) => item.id === document.bookId);
    return cloneDocument({
      ...document,
      book: book ? { id: book.id, slug: book.slug, title: book.title, status: book.status } : document.book,
    });
  };
  const paginate = <T>(records: T[], page: number, pageSize: number): PaginatedKnowledgeResult<T> => ({
    records: records.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: records.length,
    totalPages: buildTotalPages(records.length, pageSize),
  });
  const compare = <T extends { id: string }>(field: keyof T, order: "asc" | "desc") => (a: T, b: T) => {
    const direction = order === "asc" ? 1 : -1;
    const primary = String(a[field] ?? "").localeCompare(String(b[field] ?? "")) * direction;
    return primary || a.id.localeCompare(b.id);
  };
  const createBookRecord = (input: CreateKnowledgeBookInput): KnowledgeBookRecord => {
    const now = nowProvider().toISOString();
    return { id: idProvider(), ...input, version: 1, createdAt: now, updatedAt: now };
  };
  const createDocumentRecord = (input: CreateKnowledgeDocumentInput): KnowledgeDocumentRecord => {
    const now = nowProvider().toISOString();
    return {
      id: idProvider(),
      ...input,
      editorialStatus: "draft",
      reviewedAt: null,
      reviewedByUserId: null,
      approvedAt: null,
      approvedByUserId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  };

  return {
    async listBooks(input) {
      let records = state.books.map(cloneBook);
      if (input.status) records = records.filter((book) => book.status === input.status);
      if (input.search) {
        const search = input.search.toLowerCase();
        records = records.filter((book) => [book.title, book.slug, book.description].some((value) => value.toLowerCase().includes(search)));
      }
      records.sort(compare(input.sortBy, input.sortOrder));
      return paginate(records, input.page, input.pageSize);
    },
    async createBook(input) {
      const record = createBookRecord(input);
      state.books.push(record);
      return cloneBook(record);
    },
    async findBookById(id) {
      const book = state.books.find((item) => item.id === id);
      return book ? cloneBook(book) : null;
    },
    async findBookBySlug(slug) {
      const book = state.books.find((item) => item.slug === slug);
      return book ? cloneBook(book) : null;
    },
    async getBookAggregate(bookId) {
      const documentsByEditorialStatus = { draft: 0, needs_review: 0, reviewed: 0, approved: 0, archived: 0 };
      for (const document of state.documents.filter((item) => item.bookId === bookId)) {
        documentsByEditorialStatus[document.editorialStatus] += 1;
      }
      return {
        documentsTotal: Object.values(documentsByEditorialStatus).reduce((total, count) => total + count, 0),
        documentsByEditorialStatus,
      };
    },
    async updateBook(id, input) {
      const index = state.books.findIndex((item) => item.id === id);
      if (index < 0) return { status: "not_found" };
      if (state.books[index].version !== input.version) return { status: "conflict" };
      state.books[index] = {
        ...state.books[index],
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        version: state.books[index].version + 1,
        updatedAt: nowProvider().toISOString(),
      };
      return { status: "updated", record: cloneBook(state.books[index]) };
    },
    async listDocuments(input) {
      let records = state.documents.map(hydrateDocument);
      if (input.bookId) records = records.filter((document) => document.bookId === input.bookId);
      if (input.bookSlug) records = records.filter((document) => document.book?.slug === input.bookSlug);
      if (input.bookStatus) records = records.filter((document) => document.book?.status === input.bookStatus);
      if (input.type) records = records.filter((document) => document.type === input.type);
      if (input.editorialStatus) records = records.filter((document) => document.editorialStatus === input.editorialStatus);
      if (input.teacherReviewRecommended !== undefined) records = records.filter((document) => document.teacherReviewRecommended === input.teacherReviewRecommended);
      if (input.hasSensitiveTopics !== undefined) records = records.filter((document) => input.hasSensitiveTopics ? document.sensitiveTopics.length > 0 : document.sensitiveTopics.length === 0);
      if (input.search) {
        const search = input.search.toLowerCase();
        records = records.filter((document) => [document.title, document.description, document.summary, document.filePath].some((value) => value.toLowerCase().includes(search)));
      }
      records.sort(compare(input.sortBy, input.sortOrder));
      return paginate(records, input.page, input.pageSize);
    },
    async createDocument(input) {
      const record = createDocumentRecord(input);
      state.documents.push(record);
      return hydrateDocument(record);
    },
    async findDocumentById(id) {
      const document = state.documents.find((item) => item.id === id);
      return document ? hydrateDocument(document) : null;
    },
    async findDocumentByFilePath(filePath) {
      const document = state.documents.find((item) => item.filePath === filePath);
      return document ? hydrateDocument(document) : null;
    },
    async findDocumentByCatalogKey(catalogKey) {
      const document = state.documents.find((item) => item.catalogKey === catalogKey);
      return document ? hydrateDocument(document) : null;
    },
    async updateDocument(id, input) {
      const index = state.documents.findIndex((item) => item.id === id);
      if (index < 0) return { status: "not_found" };
      if (state.documents[index].version !== input.version) return { status: "conflict" };
      state.documents[index] = {
        ...state.documents[index],
        ...(input.bookId !== undefined ? { bookId: input.bookId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.sensitiveTopics !== undefined ? { sensitiveTopics: input.sensitiveTopics } : {}),
        ...(input.teacherReviewRecommended !== undefined ? { teacherReviewRecommended: input.teacherReviewRecommended } : {}),
        ...(input.editorialNotes !== undefined ? { editorialNotes: input.editorialNotes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        version: state.documents[index].version + 1,
        updatedAt: nowProvider().toISOString(),
      };
      return { status: "updated", record: hydrateDocument(state.documents[index]) };
    },
    async transitionDocument(input) {
      const index = state.documents.findIndex((item) => item.id === input.id);
      if (index < 0) return { status: "not_found" };
      if (state.documents[index].version !== input.version) return { status: "conflict" };
      state.documents[index] = {
        ...state.documents[index],
        editorialStatus: input.editorialStatus,
        ...(input.editorialNotes !== undefined ? { editorialNotes: input.editorialNotes } : {}),
        ...(input.reviewedAt !== undefined ? { reviewedAt: input.reviewedAt } : {}),
        ...(input.reviewedByUserId !== undefined ? { reviewedByUserId: input.reviewedByUserId } : {}),
        ...(input.approvedAt !== undefined ? { approvedAt: input.approvedAt } : {}),
        ...(input.approvedByUserId !== undefined ? { approvedByUserId: input.approvedByUserId } : {}),
        version: state.documents[index].version + 1,
        updatedAt: nowProvider().toISOString(),
      };
      return { status: "updated", record: hydrateDocument(state.documents[index]) };
    },
    async upsertCatalogBook(input) {
      const existing = state.books.find((book) => book.slug === input.slug);
      if (existing) return { record: cloneBook(existing), created: false };
      const record = createBookRecord(input);
      state.books.push(record);
      return { record: cloneBook(record), created: true };
    },
    async upsertCatalogDocument(input) {
      const existing = state.documents.find((document) => document.filePath === input.filePath);
      if (existing) return { record: hydrateDocument(existing), created: false, changed: false };
      const record = createDocumentRecord(input);
      state.documents.push(record);
      return { record: hydrateDocument(record), created: true, changed: true };
    },
  };
};
