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

describe("admin knowledge books routes", () => {
  beforeEach(() => {
    resetAuthStore();
    setKnowledgeRepositoryForTesting(createMemoryKnowledgeRepository(createMemoryKnowledgeState(), {
      nowProvider: () => new Date("2026-07-16T12:00:00.000Z"),
      idProvider: () => "book-1",
    }));
  });

  afterEach(() => {
    resetKnowledgeRepositoryForTesting();
  });

  it("cria, lista, consulta e atualiza livro", async () => {
    const token = await loginAsAdmin();

    const created = await request(app)
      .post("/api/admin/knowledge/books")
      .set("Authorization", `Bearer ${token}`)
      .send({ slug: "emmanuel", title: "Emmanuel" });

    expect(created.status).toBe(201);
    expect(created.body.data.version).toBe(1);

    const list = await request(app)
      .get("/api/admin/knowledge/books")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data.items).toHaveLength(1);

    const detail = await request(app)
      .get("/api/admin/knowledge/books/book-1")
      .set("Authorization", `Bearer ${token}`);
    expect(detail.body.data.aggregate.documentsTotal).toBe(0);

    const updated = await request(app)
      .patch("/api/admin/knowledge/books/book-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Emmanuel atualizado", version: 1 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.version).toBe(2);
  });

  it("retorna conflito de versao", async () => {
    const token = await loginAsAdmin();
    await request(app)
      .post("/api/admin/knowledge/books")
      .set("Authorization", `Bearer ${token}`)
      .send({ slug: "emmanuel", title: "Emmanuel" });

    const response = await request(app)
      .patch("/api/admin/knowledge/books/book-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Conflito", version: 2 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("KNOWLEDGE_CONFLICT");
  });
});
