import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import {
  createMemoryKnowledgeRepository,
  createMemoryKnowledgeState,
} from "../src/modules/admin/knowledge/repository";
import {
  resetKnowledgeRepositoryForTesting,
  setKnowledgeRepositoryForTesting,
} from "../src/modules/admin/knowledge/service";
import { resetAuthStore } from "../src/modules/auth/auth.service";

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });
  return response.body.data.token as string;
};

describe("admin knowledge documents routes", () => {
  beforeEach(() => {
    resetAuthStore();
    let nextId = 1;
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
          createdAt: "2026-07-16T12:00:00.000Z",
          updatedAt: "2026-07-16T12:00:00.000Z",
        },
      ],
    }), {
      nowProvider: () => new Date("2026-07-16T12:00:00.000Z"),
      idProvider: () => `doc-${nextId++}`,
    }));
  });

  afterEach(() => {
    resetKnowledgeRepositoryForTesting();
  });

  it("cria, lista, consulta, atualiza e transiciona documento", async () => {
    const token = await loginAsAdmin();

    const created = await request(app)
      .post("/api/admin/knowledge/documents")
      .set("Authorization", `Bearer ${token}`)
      .send({
        bookId: "book-1",
        filePath: "data/knowledge/README.md",
        catalogKey: "knowledge-readme",
        title: "README",
        type: "readme",
      });

    expect(created.status).toBe(201);
    expect(created.body.data.filePath).toBe("data/knowledge/README.md");

    const list = await request(app)
      .get("/api/admin/knowledge/documents")
      .query({ bookSlug: "emmanuel" })
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data.items).toHaveLength(1);

    const detail = await request(app)
      .get("/api/admin/knowledge/documents/doc-1")
      .set("Authorization", `Bearer ${token}`);
    expect(detail.body.data.fileExists).toBe(true);
    expect(detail.body.data).not.toHaveProperty("content");

    const updated = await request(app)
      .patch("/api/admin/knowledge/documents/doc-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "README atualizado", version: 1 });
    expect(updated.body.data.version).toBe(2);

    const reviewed = await request(app)
      .patch("/api/admin/knowledge/documents/doc-1/editorial-status")
      .set("Authorization", `Bearer ${token}`)
      .send({ editorialStatus: "reviewed", version: 2 });
    expect(reviewed.body.data.editorialStatus).toBe("reviewed");
    expect(reviewed.body.data.reviewedBy.id).toBe("user-admin-demo");
  });

  it("rejeita arquivo duplicado", async () => {
    const token = await loginAsAdmin();
    const body = {
      bookId: "book-1",
      filePath: "data/knowledge/README.md",
      title: "README",
      type: "readme",
    };
    await request(app).post("/api/admin/knowledge/documents").set("Authorization", `Bearer ${token}`).send(body);
    const response = await request(app).post("/api/admin/knowledge/documents").set("Authorization", `Bearer ${token}`).send(body);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("KNOWLEDGE_DOCUMENT_ALREADY_EXISTS");
  });
});
