import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { createMemoryAuthRepository } from "../src/modules/auth/auth.repository";
import { resetAuthStore, setAuthRepositoryForTesting } from "../src/modules/auth/auth.service";
import {
  createMemoryBookAccessRepository,
  createMemoryBookAccessState,
  type MemoryBookAccessGroup,
} from "../src/modules/book-access/book-access.repository";
import {
  resetBookAccessServiceDependenciesForTesting,
  setBookAccessServiceDependenciesForTesting,
} from "../src/modules/book-access/book-access.service";

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const activeGroup = (id: string, name: string): MemoryBookAccessGroup => ({
  id,
  name,
  status: "active",
  knowledgeBook: {
    id: `book-${id}`,
    slug: id,
    title: name,
    status: "active",
  },
});

const installAuthStateWithVisitor = () => {
  const baseRepository = createMemoryAuthRepository();
  const visitor = {
    id: "user-visitor-demo",
    fullName: "Visitante Demonstrativo",
    email: "visitante.demo@example.com",
    passwordHash: bcrypt.hashSync("VisitanteDemo@123", 10),
    role: "visitor" as const,
    status: "active" as const,
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
    mustChangePassword: false,
    passwordChangedAt: null,
  };

  setAuthRepositoryForTesting({
    ...baseRepository,
    async getByEmail(email) {
      if (email.trim().toLowerCase() === visitor.email) {
        return { ...visitor };
      }

      return baseRepository.getByEmail(email);
    },
    async getById(id) {
      if (id === visitor.id) {
        return { ...visitor };
      }

      return baseRepository.getById(id);
    },
  });
};

const installState = (options: {
  studentGroupSlug?: string | null;
  groups?: MemoryBookAccessGroup[];
  teacherGroupMemberships?: Array<{ userId: string; groupId: string }>;
} = {}) => {
  const state = createMemoryBookAccessState({
    users: [
      {
        id: "user-aluno-demo",
        groupSlug: options.studentGroupSlug === undefined
          ? "emmanuel"
          : options.studentGroupSlug,
      },
      { id: "user-professor-demo", groupSlug: null },
      { id: "user-admin-demo", groupSlug: null },
    ],
    groups: options.groups ?? [
      activeGroup("emmanuel", "Emmanuel"),
      activeGroup("a-caminho-da-luz", "A Caminho da Luz"),
    ],
    teacherGroupMemberships: options.teacherGroupMemberships ?? [
      { userId: "user-professor-demo", groupId: "emmanuel" },
    ],
  });

  setBookAccessServiceDependenciesForTesting({
    repository: createMemoryBookAccessRepository(state),
  });
};

describe("GET /api/me/book-access", () => {
  beforeEach(() => {
    resetAuthStore();
    resetBookAccessServiceDependenciesForTesting();
    installState();
  });

  it("rejeita usuario nao autenticado", async () => {
    const response = await request(app).get("/api/me/book-access");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejeita admin sem expor livros", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const response = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(JSON.stringify(response.body)).not.toContain("Emmanuel");
  });

  it("rejeita visitor autenticado sem expor livros ou grupos", async () => {
    installAuthStateWithVisitor();
    const token = await loginAs("visitante.demo@example.com", "VisitanteDemo@123");
    const response = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);
    const serializedBody = JSON.stringify(response.body);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(serializedBody).not.toContain("Emmanuel");
    expect(serializedBody).not.toContain("A Caminho da Luz");
    expect(serializedBody).not.toContain("book-emmanuel");
    expect(serializedBody).not.toContain("book-a-caminho-da-luz");
    expect(serializedBody).not.toContain("a-caminho-da-luz");
  });

  it("retorna apenas o livro do grupo do aluno", async () => {
    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Acesso aos livros de estudo carregado com sucesso.",
      data: {
        groups: [
          {
            id: "emmanuel",
            name: "Emmanuel",
            knowledgeBook: {
              id: "book-emmanuel",
              slug: "emmanuel",
              title: "Emmanuel",
            },
          },
        ],
      },
      meta: {
        count: 1,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("a-caminho-da-luz");
  });

  it("retorna todos os livros dos grupos vinculados ao professor sem depender de meetings", async () => {
    installState({
      teacherGroupMemberships: [
        { userId: "user-professor-demo", groupId: "emmanuel" },
        { userId: "user-professor-demo", groupId: "a-caminho-da-luz" },
      ],
    });

    const token = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const response = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.meta.count).toBe(2);
    expect(response.body.data.groups.map((group: { id: string }) => group.id)).toEqual([
      "a-caminho-da-luz",
      "emmanuel",
    ]);
  });

  it("retorna sucesso vazio para professor sem vinculos", async () => {
    installState({ teacherGroupMemberships: [] });

    const token = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const response = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ groups: [] });
    expect(response.body.meta.count).toBe(0);
  });

  it("retorna sucesso vazio para aluno sem grupo", async () => {
    installState({ studentGroupSlug: null });

    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ groups: [] });
    expect(response.body.meta.count).toBe(0);
  });

  it("falha fechado quando grupo ativo nao possui KnowledgeBook", async () => {
    installState({
      groups: [
        {
          id: "emmanuel",
          name: "Emmanuel",
          status: "active",
          knowledgeBook: null,
        },
      ],
    });

    const token = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const response = await request(app)
      .get("/api/me/book-access")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("BOOK_ACCESS_CATALOG_UNAVAILABLE");
    expect(response.body.error.details).toEqual({
      reason: "STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK",
    });
  });
});
