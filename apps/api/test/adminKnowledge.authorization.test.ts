import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { createMemoryKnowledgeRepository } from "../src/modules/admin/knowledge/repository";
import {
  resetKnowledgeRepositoryForTesting,
  setKnowledgeRepositoryForTesting,
} from "../src/modules/admin/knowledge/service";
import { resetAuthStore } from "../src/modules/auth/auth.service";

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

describe("admin knowledge authorization", () => {
  beforeEach(() => {
    resetAuthStore();
    setKnowledgeRepositoryForTesting(createMemoryKnowledgeRepository());
  });

  afterEach(() => {
    resetKnowledgeRepositoryForTesting();
  });

  it("rejeita requisicao sem token", async () => {
    const response = await request(app).get("/api/admin/knowledge/books");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejeita token invalido", async () => {
    const response = await request(app)
      .get("/api/admin/knowledge/books")
      .set("Authorization", "Bearer invalido");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejeita aluno e professor", async () => {
    const studentToken = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const teacherToken = await loginAs("professor.demo@example.com", "ProfessorDemo@123");

    const studentResponse = await request(app)
      .get("/api/admin/knowledge/books")
      .set("Authorization", `Bearer ${studentToken}`);
    const teacherResponse = await request(app)
      .get("/api/admin/knowledge/books")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(studentResponse.status).toBe(403);
    expect(teacherResponse.status).toBe(403);
    expect(studentResponse.body.error.code).toBe("FORBIDDEN");
    expect(teacherResponse.body.error.code).toBe("FORBIDDEN");
  });

  it("permite admin autenticado", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const response = await request(app)
      .get("/api/admin/knowledge/books")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
