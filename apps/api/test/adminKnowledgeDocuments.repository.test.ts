import { describe, expect, it } from "vitest";

import {
  createMemoryKnowledgeRepository,
  createMemoryKnowledgeState,
} from "../src/modules/admin/knowledge/repository";

const now = "2026-07-16T12:00:00.000Z";

describe("admin knowledge documents repository", () => {
  it("lista com filtros, paginacao e ordenacao deterministica", async () => {
    const repository = createMemoryKnowledgeRepository(createMemoryKnowledgeState({
      books: [
        { id: "book-1", slug: "emmanuel", title: "Emmanuel", description: "", status: "active", sortOrder: 0, version: 1, createdAt: now, updatedAt: now },
      ],
      documents: [
        { id: "doc-2", bookId: "book-1", catalogKey: null, filePath: "data/knowledge/emmanuel/visao_geral.md", title: "B", description: "", summary: "", type: "tema", tags: [], sensitiveTopics: [], teacherReviewRecommended: false, editorialStatus: "draft", editorialNotes: "", sortOrder: 2, reviewedAt: null, reviewedByUserId: null, approvedAt: null, approvedByUserId: null, version: 1, createdAt: now, updatedAt: now },
        { id: "doc-1", bookId: "book-1", catalogKey: null, filePath: "data/knowledge/README.md", title: "A", description: "", summary: "", type: "readme", tags: [], sensitiveTopics: ["saude"], teacherReviewRecommended: true, editorialStatus: "reviewed", editorialNotes: "", sortOrder: 1, reviewedAt: now, reviewedByUserId: "admin-1", approvedAt: null, approvedByUserId: null, version: 1, createdAt: now, updatedAt: now },
      ],
    }));

    const result = await repository.listDocuments({
      bookSlug: "emmanuel",
      hasSensitiveTopics: true,
      page: 1,
      pageSize: 10,
      sortBy: "sortOrder",
      sortOrder: "asc",
    });

    expect(result.records.map((document) => document.id)).toEqual(["doc-1"]);
    expect(result.total).toBe(1);
  });

  it("retorna conflito quando version nao coincide", async () => {
    const repository = createMemoryKnowledgeRepository(createMemoryKnowledgeState({
      documents: [
        { id: "doc-1", bookId: "book-1", catalogKey: null, filePath: "data/knowledge/README.md", title: "A", description: "", summary: "", type: "readme", tags: [], sensitiveTopics: [], teacherReviewRecommended: false, editorialStatus: "draft", editorialNotes: "", sortOrder: 1, reviewedAt: null, reviewedByUserId: null, approvedAt: null, approvedByUserId: null, version: 3, createdAt: now, updatedAt: now },
      ],
    }));

    await expect(repository.updateDocument("missing", { version: 1, title: "x" })).resolves.toEqual({ status: "not_found" });
    await expect(repository.updateDocument("doc-1", { version: 2, title: "x" })).resolves.toEqual({ status: "conflict" });
  });
});
