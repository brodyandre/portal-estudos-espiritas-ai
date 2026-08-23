import { describe, expect, it } from "vitest";

import type { AuthUser } from "../src/modules/auth/auth.types";
import {
  createMemoryBookAccessRepository,
  createMemoryBookAccessState,
  type MemoryBookAccessGroup,
} from "../src/modules/book-access/book-access.repository";
import { createBookAccessService } from "../src/modules/book-access/book-access.service";

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "student-1",
  fullName: "Aluno Teste",
  email: "aluno@example.com",
  role: "student",
  status: "active",
  mustChangePassword: false,
  passwordChangedAt: null,
  permissions: [],
  ...overrides,
});

const activeGroup = (
  id: string,
  name: string,
  bookTitle = name,
): MemoryBookAccessGroup => ({
  id,
  name,
  status: "active",
  knowledgeBook: {
    id: `book-${id}`,
    slug: id,
    title: bookTitle,
    status: "active",
  },
});

const createService = (options: {
  groups?: MemoryBookAccessGroup[];
  users?: Array<{ id: string; groupSlug: string | null }>;
  teacherGroupMemberships?: Array<{ userId: string; groupId: string }>;
} = {}) => {
  const state = createMemoryBookAccessState({
    users: options.users ?? [
      { id: "student-1", groupSlug: "emmanuel" },
      { id: "student-empty", groupSlug: null },
      { id: "student-invalid", groupSlug: "fantasma" },
      { id: "teacher-1", groupSlug: null },
      { id: "teacher-two-groups", groupSlug: null },
    ],
    groups: options.groups ?? [
      activeGroup("emmanuel", "Emmanuel"),
      activeGroup("a-caminho-da-luz", "A Caminho da Luz"),
      {
        ...activeGroup("grupo-inativo", "Grupo Inativo"),
        status: "inactive",
      },
    ],
    teacherGroupMemberships: options.teacherGroupMemberships ?? [
      { userId: "teacher-1", groupId: "emmanuel" },
      { userId: "teacher-two-groups", groupId: "emmanuel" },
      { userId: "teacher-two-groups", groupId: "a-caminho-da-luz" },
    ],
  });

  return createBookAccessService({
    repository: createMemoryBookAccessRepository(state),
  });
};

describe("book access service", () => {
  it("rejeita usuario ausente e papeis nao autorizados", async () => {
    const service = createService();

    await expect(service.resolveBookAccessScope(undefined)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      statusCode: 401,
    });
    await expect(
      service.resolveBookAccessScope(makeUser({ role: "admin" })),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    await expect(
      service.resolveBookAccessScope(makeUser({ role: "visitor" })),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("autoriza aluno somente pelo grupo persistido no usuario", async () => {
    const service = createService();

    await expect(service.resolveBookAccessScope(makeUser())).resolves.toEqual({
      actorId: "student-1",
      role: "student",
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
    });
  });

  it("retorna escopo vazio para aluno sem grupo e falha fechado para grupo inexistente", async () => {
    const service = createService();

    await expect(
      service.resolveBookAccessScope(makeUser({ id: "student-empty" })),
    ).resolves.toEqual({
      actorId: "student-empty",
      role: "student",
      groups: [],
    });
    await expect(
      service.resolveBookAccessScope(makeUser({ id: "student-invalid" })),
    ).rejects.toMatchObject({
      code: "BOOK_ACCESS_CATALOG_UNAVAILABLE",
      statusCode: 503,
      details: { reason: "STUDY_GROUP_NOT_FOUND" },
    });
  });

  it("omite grupo inativo sem abrir acesso a livro", async () => {
    const service = createService({
      users: [{ id: "student-1", groupSlug: "grupo-inativo" }],
      groups: [
        {
          ...activeGroup("grupo-inativo", "Grupo Inativo"),
          status: "inactive",
        },
      ],
      teacherGroupMemberships: [{ userId: "teacher-1", groupId: "grupo-inativo" }],
    });

    await expect(service.resolveBookAccessScope(makeUser())).resolves.toEqual({
      actorId: "student-1",
      role: "student",
      groups: [],
    });
    await expect(
      service.resolveBookAccessScope(makeUser({ id: "teacher-1", role: "teacher" })),
    ).resolves.toEqual({
      actorId: "teacher-1",
      role: "teacher",
      groups: [],
    });
  });

  it("autoriza professor por TeacherStudyGroup e ordena todos os grupos ativos", async () => {
    const service = createService();
    const result = await service.resolveBookAccessScope(
      makeUser({ id: "teacher-two-groups", role: "teacher" }),
    );

    expect(result).toEqual({
      actorId: "teacher-two-groups",
      role: "teacher",
      groups: [
        {
          id: "a-caminho-da-luz",
          name: "A Caminho da Luz",
          knowledgeBook: {
            id: "book-a-caminho-da-luz",
            slug: "a-caminho-da-luz",
            title: "A Caminho da Luz",
          },
        },
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
    });
  });

  it("retorna escopo vazio para professor sem vinculos", async () => {
    const service = createService();

    await expect(
      service.resolveBookAccessScope(makeUser({ id: "teacher-empty", role: "teacher" })),
    ).resolves.toEqual({
      actorId: "teacher-empty",
      role: "teacher",
      groups: [],
    });
  });

  it("falha fechado quando grupo ativo nao possui KnowledgeBook", async () => {
    const service = createService({
      groups: [
        {
          id: "emmanuel",
          name: "Emmanuel",
          status: "active",
          knowledgeBook: null,
        },
      ],
      teacherGroupMemberships: [{ userId: "teacher-1", groupId: "emmanuel" }],
    });

    await expect(service.resolveBookAccessScope(makeUser())).rejects.toMatchObject({
      code: "BOOK_ACCESS_CATALOG_UNAVAILABLE",
      statusCode: 503,
      details: { reason: "STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK" },
    });
    await expect(
      service.resolveBookAccessScope(makeUser({ id: "teacher-1", role: "teacher" })),
    ).rejects.toMatchObject({
      code: "BOOK_ACCESS_CATALOG_UNAVAILABLE",
      statusCode: 503,
      details: { reason: "STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK" },
    });
  });

  it("falha fechado quando livro vinculado esta inativo", async () => {
    const service = createService({
      groups: [
        {
          ...activeGroup("emmanuel", "Emmanuel"),
          knowledgeBook: {
            id: "book-emmanuel",
            slug: "emmanuel",
            title: "Emmanuel",
            status: "archived",
          },
        },
      ],
      teacherGroupMemberships: [{ userId: "teacher-1", groupId: "emmanuel" }],
    });

    await expect(service.resolveBookAccessScope(makeUser())).rejects.toMatchObject({
      code: "BOOK_ACCESS_CATALOG_UNAVAILABLE",
      statusCode: 503,
      details: { reason: "KNOWLEDGE_BOOK_INACTIVE" },
    });
  });

  it("resolve livro selecionado somente dentro do escopo autorizado", async () => {
    const service = createService();

    await expect(
      service.resolveSelectedBookAccess(
        makeUser({ id: "teacher-two-groups", role: "teacher" }),
        "a-caminho-da-luz",
      ),
    ).resolves.toMatchObject({
      id: "a-caminho-da-luz",
      knowledgeBook: { slug: "a-caminho-da-luz" },
    });
    await expect(
      service.resolveSelectedBookAccess(makeUser(), "a-caminho-da-luz"),
    ).rejects.toMatchObject({
      code: "BOOK_ACCESS_FORBIDDEN",
      statusCode: 403,
    });
    await expect(
      service.resolveSelectedBookAccess(
        makeUser({ id: "teacher-1", role: "teacher" }),
        "grupo-inventado",
      ),
    ).rejects.toMatchObject({
      code: "BOOK_ACCESS_FORBIDDEN",
      statusCode: 403,
    });
  });
});
