import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { ServiceRequestError } from "../services/api";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const book = {
  id: "book-1",
  slug: "emmanuel",
  title: "Emmanuel",
  description: "",
  status: "active",
  sortOrder: 1,
  version: 2,
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

const document = {
  id: "doc-1",
  bookId: "book-1",
  book: { id: "book-1", slug: "emmanuel", title: "Emmanuel", status: "active" },
  catalogKey: "emmanuel-visao",
  filePath: "data/knowledge/emmanuel/visao.md",
  title: "Visão geral",
  description: "",
  summary: "",
  type: "tema",
  tags: ["emmanuel"],
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  editorialStatus: "draft",
  editorialNotes: "",
  sortOrder: 1,
  reviewedAt: null,
  reviewedBy: null,
  approvedAt: null,
  approvedBy: null,
  version: 1,
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

const listEnvelope = (items: unknown[]) => ({
  success: true,
  message: "ok",
  data: { items },
  meta: { page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0 },
});

const itemEnvelope = (item: unknown) => ({
  success: true,
  message: "ok",
  data: item,
});

describe("adminKnowledgeService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("serializa filtros de livros e omite valores vazios", async () => {
    const { listAdminKnowledgeBooks } = await import("../services/adminKnowledgeService");
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope([book]))));

    await listAdminKnowledgeBooks({
      page: 2,
      pageSize: 10,
      search: "  Emmanuel  ",
      status: "active",
      sortBy: "title",
      sortOrder: "desc",
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/knowledge/books?page=2&pageSize=10&search=Emmanuel&status=active&sortBy=title&sortOrder=desc",
      expect.any(Object),
    );
  });

  it("serializa filtros booleanos de documentos", async () => {
    const { listAdminKnowledgeDocuments } = await import("../services/adminKnowledgeService");
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope([document]))));

    await listAdminKnowledgeDocuments({
      bookId: "book-1",
      type: "tema",
      editorialStatus: "draft",
      teacherReviewRecommended: true,
      hasSensitiveTopics: false,
      sortBy: "editorialStatus",
      sortOrder: "asc",
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/knowledge/documents?bookId=book-1&type=tema&editorialStatus=draft&teacherReviewRecommended=true&hasSensitiveTopics=false&sortBy=editorialStatus&sortOrder=asc",
      expect.any(Object),
    );
  });

  it("mapeia envelope de detalhe e propaga token de autenticação", async () => {
    const { getAdminKnowledgeDocument } = await import("../services/adminKnowledgeService");
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "jwt-local");
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: "admin-1",
        fullName: "Admin",
        email: "admin@example.com",
        role: "admin",
        status: "active",
        mustChangePassword: false,
        permissions: [],
      }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(itemEnvelope({ ...document, fileExists: true }))));

    const result = await getAdminKnowledgeDocument("doc-1");

    expect(result.fileExists).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt-local" }),
      }),
    );
  });

  it("rejeita envelope inválido", async () => {
    const { listAdminKnowledgeBooks } = await import("../services/adminKnowledgeService");
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope([{ ...book, status: "unknown" }]))));

    await expect(listAdminKnowledgeBooks()).rejects.toMatchObject({
      message: "Resposta inválida do servidor para o catálogo editorial.",
    });
  });

  it("preserva código de conflito e rate limit", async () => {
    const { updateAdminKnowledgeBook } = await import("../services/adminKnowledgeService");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          {
            success: false,
            error: {
              code: "KNOWLEDGE_CONFLICT",
              message: "Conflito",
              details: { retryAfterSeconds: 30 },
            },
          },
          false,
        ),
      ),
    );

    await expect(updateAdminKnowledgeBook("book-1", { version: 1, title: "Novo" })).rejects.toMatchObject({
      code: "KNOWLEDGE_CONFLICT",
      retryAfterSeconds: 30,
    });
  });
});
