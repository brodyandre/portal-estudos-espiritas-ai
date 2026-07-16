import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryKnowledgeRepository,
  createMemoryKnowledgeState,
} from "../src/modules/admin/knowledge/repository";
import {
  createKnowledgeDocument,
  transitionKnowledgeDocument,
  updateKnowledgeDocument,
  resetKnowledgeRepositoryForTesting,
  setKnowledgeRepositoryForTesting,
} from "../src/modules/admin/knowledge/service";
import type { AuthUser } from "../src/modules/auth/auth.types";

const admin: AuthUser = {
  id: "admin-1",
  fullName: "Admin",
  email: "admin@example.com",
  role: "admin",
  status: "active",
};

const now = "2026-07-16T12:00:00.000Z";

describe("admin knowledge documents service", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(now));
    setKnowledgeRepositoryForTesting(createMemoryKnowledgeRepository(createMemoryKnowledgeState({
      books: [
        {
          id: "book-1",
          slug: "emmanuel",
          title: "Emmanuel",
          description: "",
          status: "active",
          sortOrder: 0,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "book-archived",
          slug: "archived",
          title: "Archived",
          description: "",
          status: "archived",
          sortOrder: 1,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }), { nowProvider: () => new Date(now), idProvider: () => "doc-1" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetKnowledgeRepositoryForTesting();
  });

  it("cria documento seguro e força revisão para temas sensíveis", async () => {
    const document = await createKnowledgeDocument(admin, {
      bookId: "book-1",
      filePath: "data/knowledge/README.md",
      catalogKey: "readme",
      title: "README",
      description: "",
      summary: "",
      type: "readme",
      tags: ["Base", "base"],
      sensitiveTopics: ["Saude"],
      teacherReviewRecommended: false,
      editorialNotes: "",
      sortOrder: 0,
    });

    expect(document.teacherReviewRecommended).toBe(true);
    expect(document.tags).toEqual(["base"]);
    expect(document.sensitiveTopics).toEqual(["saude"]);
  });

  it("bloqueia criacao em livro arquivado", async () => {
    await expect(createKnowledgeDocument(admin, {
      bookId: "book-archived",
      filePath: "data/knowledge/README.md",
      catalogKey: null,
      title: "README",
      description: "",
      summary: "",
      type: "readme",
      tags: [],
      sensitiveTopics: [],
      teacherReviewRecommended: false,
      editorialNotes: "",
      sortOrder: 0,
    })).rejects.toMatchObject({ code: "KNOWLEDGE_BOOK_ARCHIVED" });
  });

  it("aplica transicoes editoriais e concorrencia otimista", async () => {
    await createKnowledgeDocument(admin, {
      bookId: "book-1",
      filePath: "data/knowledge/README.md",
      catalogKey: null,
      title: "README",
      description: "",
      summary: "",
      type: "readme",
      tags: [],
      sensitiveTopics: [],
      teacherReviewRecommended: false,
      editorialNotes: "",
      sortOrder: 0,
    });

    const reviewed = await transitionKnowledgeDocument(admin, "doc-1", {
      editorialStatus: "reviewed",
      version: 1,
    });
    expect(reviewed.reviewedByUserId).toBe("admin-1");
    const approved = await transitionKnowledgeDocument(admin, "doc-1", {
      editorialStatus: "approved",
      version: 2,
    });
    expect(approved.approvedByUserId).toBe("admin-1");
    await expect(updateKnowledgeDocument(admin, "doc-1", { version: 2, title: "Conflito" })).rejects.toMatchObject({
      code: "KNOWLEDGE_CONFLICT",
    });
  });

  it("rejeita transicao proibida", async () => {
    await createKnowledgeDocument(admin, {
      bookId: "book-1",
      filePath: "data/knowledge/README.md",
      catalogKey: null,
      title: "README",
      description: "",
      summary: "",
      type: "readme",
      tags: [],
      sensitiveTopics: [],
      teacherReviewRecommended: false,
      editorialNotes: "",
      sortOrder: 0,
    });

    await expect(transitionKnowledgeDocument(admin, "doc-1", {
      editorialStatus: "approved",
      version: 1,
    })).rejects.toMatchObject({ code: "KNOWLEDGE_EDITORIAL_TRANSITION_NOT_ALLOWED" });
  });
});
