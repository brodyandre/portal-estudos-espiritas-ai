import bcrypt from "bcryptjs";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import {
  resetAnswerGraphRetrieverContextForTesting,
  setAnswerGraphRetrieverContextForTesting,
} from "../src/agent/answer-graph";
import {
  resetLlmForTesting,
  setLlmChatModelFactoryForTesting,
  setLlmRuntimeConfigForTesting,
} from "../src/agent/llm";
import { GovernedCorpusError, type GovernedCorpusDocument } from "../src/knowledge/governedCorpus";
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
import type { GovernedRetrieverContext } from "../src/rag/governedRetriever";
import { createKeywordRetriever } from "../src/rag/retriever";
import type { RetrieveOptions, RetrievedChunk } from "../src/rag/types";

const BOOK_EMMANUEL_ID = "book-emmanuel";
const BOOK_A_CAMINHO_ID = "book-a-caminho-da-luz";
const BOOK_SHARED_ID = "book-shared";

const routeBodies = {
  "/api/agent/lesson-plan": {
    groupId: "emmanuel",
    theme: "Constancia no estudo durante a semana",
    teacherNote: "Reservar acolhimento inicial.",
  },
  "/api/agent/reflection-questions": {
    groupId: "emmanuel",
    theme: "Constancia no estudo durante a semana",
    questionCount: 5,
  },
  "/api/agent/summarize": {
    groupId: "emmanuel",
    theme: "Constancia",
    sourceText: "Texto autorizado para resumir com calma, cuidado fraterno e revisao humana.",
  },
  "/api/agent/answer": {
    groupId: "emmanuel",
    question: "Como estudar com calma quando nao entendo tudo de uma vez?",
  },
} as const;

const teacherOnlyRoutes = [
  "/api/agent/lesson-plan",
  "/api/agent/reflection-questions",
  "/api/agent/summarize",
] as const;

const allAgentRoutes = [...teacherOnlyRoutes, "/api/agent/answer"] as const;

const bookSlugFor = (book: string) => {
  if (book === "Emmanuel") {
    return "emmanuel";
  }

  if (book === "A Caminho da Luz") {
    return "a-caminho-da-luz";
  }

  return "shared";
};

const bookIdFor = (book: string) => {
  if (book === "Emmanuel") {
    return BOOK_EMMANUEL_ID;
  }

  if (book === "A Caminho da Luz") {
    return BOOK_A_CAMINHO_ID;
  }

  return BOOK_SHARED_ID;
};

const buildDocument = (
  id: string,
  title: string,
  group: string,
  book: string,
  content: string,
  overrides: Partial<GovernedCorpusDocument> = {},
): GovernedCorpusDocument => ({
  id,
  title,
  group,
  book,
  source: "resumo autoral demonstrativo",
  sourceLabel: `${book} · ${title}`,
  filename: `${id}.md`,
  path: `data/knowledge/${id}.md`,
  type: "tema",
  tags: [id, "estudo"],
  description: `Descricao ${title}`,
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  purpose: "apoio para respostas simples",
  content,
  rawContent: content,
  frontmatter: {
    title,
    group,
    purpose: "apoio para respostas simples",
    source: "resumo autoral demonstrativo",
  },
  charCount: content.length,
  wordCount: content.split(/\s+/u).filter(Boolean).length,
  editorial: {
    manifestFingerprint: "test-fingerprint",
    manifestSourceId: `${id}:1`,
    documentId: id,
    bookId: bookIdFor(book),
    catalogKey: id,
    documentTitle: title,
    bookTitle: book,
    bookSlug: bookSlugFor(book),
    documentVersion: 1,
    origin: "catalog",
  },
  ...overrides,
});

const governedDocuments = [
  buildDocument(
    "orientacoes_do_grupo",
    "Orientacoes do grupo",
    "Compartilhado",
    "Base compartilhada",
    "prece serenidade acolhimento encontro fraterno problemas cotidianos",
    {
      filename: "orientacoes_do_grupo.md",
      path: "data/knowledge/orientacoes_do_grupo.md",
      type: "orientacoes",
      tags: ["orientacoes", "convivio", "prece"],
    },
  ),
  buildDocument(
    "emmanuel_tema_constancia",
    "Emmanuel - constancia no estudo",
    "Emmanuel",
    "Emmanuel",
    "desanimado constancia estudo perseveranca aplicacao pratica semana",
    {
      filename: "emmanuel_tema_constancia.md",
      path: "data/knowledge/emmanuel/emmanuel_tema_constancia.md",
      tags: ["desanimado", "constancia", "emmanuel"],
    },
  ),
  buildDocument(
    "a_caminho_da_luz_tema_civilizacoes_antigas",
    "A Caminho da Luz - civilizacoes antigas e Capela",
    "A Caminho da Luz",
    "A Caminho da Luz",
    "capela capela capela racas adamicas civilizacoes antigas historia espiritual prudencia",
    {
      filename: "a_caminho_da_luz_tema_civilizacoes_antigas.md",
      path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_civilizacoes_antigas.md",
      tags: ["capela", "racas adamicas", "historia"],
      sensitiveTopics: ["Capela", "racas adamicas"],
      teacherReviewRecommended: true,
    },
  ),
  buildDocument(
    "a_caminho_da_luz_tema_jesus_e_evangelho",
    "A Caminho da Luz - Jesus e Evangelho",
    "A Caminho da Luz",
    "A Caminho da Luz",
    "evangelho jesus moral pratica espiritual vivencia cotidiana",
    {
      filename: "a_caminho_da_luz_tema_jesus_e_evangelho.md",
      path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_jesus_e_evangelho.md",
      tags: ["evangelho", "jesus"],
    },
  ),
];

const activeGroup = (id: string, name: string, bookId: string): MemoryBookAccessGroup => ({
  id,
  name,
  status: "active",
  knowledgeBook: {
    id: bookId,
    slug: id,
    title: name,
    status: "active",
  },
});

const installBookAccessState = (options: {
  studentGroupSlug?: string | null;
  teacherGroupMemberships?: Array<{ userId: string; groupId: string }>;
  groups?: MemoryBookAccessGroup[];
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
      activeGroup("emmanuel", "Emmanuel", BOOK_EMMANUEL_ID),
      activeGroup("a-caminho-da-luz", "A Caminho da Luz", BOOK_A_CAMINHO_ID),
    ],
    teacherGroupMemberships: options.teacherGroupMemberships ?? [
      { userId: "user-professor-demo", groupId: "emmanuel" },
    ],
  });

  setBookAccessServiceDependenciesForTesting({
    repository: createMemoryBookAccessRepository(state),
  });
};

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

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  const token = response.body.data?.token as string | undefined;

  if (!token) {
    throw new Error(`Login de teste falhou para ${email}`);
  }

  return token;
};

const loginAsStudent = () => loginAs("aluno.demo@example.com", "AlunoDemo@123");
const loginAsTeacher = () => loginAs("professor.demo@example.com", "ProfessorDemo@123");
const loginAsAdmin = () => loginAs("admin.demo@example.com", "AdminDemo@123");
const loginAsVisitor = async () => {
  installAuthStateWithVisitor();
  return loginAs("visitante.demo@example.com", "VisitanteDemo@123");
};

const createContext = async (
  documents: readonly GovernedCorpusDocument[] = governedDocuments,
  corpusFingerprint = "test-corpus-fingerprint",
): Promise<GovernedRetrieverContext> => ({
  cacheKey: {
    manifestFingerprint: "test-fingerprint",
    corpusFingerprint,
  },
  manifestFingerprint: "test-fingerprint",
  corpusFingerprint,
  documents,
  retriever: await createKeywordRetriever({ documents }),
});

const createInstrumentedContext = async (
  documents: readonly GovernedCorpusDocument[] = governedDocuments,
) => {
  const context = await createContext(documents);
  const searchCalls: Array<{
    query: string;
    options: RetrieveOptions | undefined;
    resultBookIds: string[];
    resultBookSlugs: string[];
    resultGroups: string[];
  }> = [];
  const baseRetriever = context.retriever;

  return {
    context: {
      ...context,
      retriever: {
        ...baseRetriever,
        async search(query: string, options?: RetrieveOptions) {
          const results = await baseRetriever.search(query, options);
          searchCalls.push({
            query,
            options,
            resultBookIds: results.map((result) => result.editorial?.bookId ?? "missing"),
            resultBookSlugs: results.map((result) => result.editorial?.bookSlug ?? "missing"),
            resultGroups: results.map((result) => result.group),
          });

          return results;
        },
      },
    },
    searchCalls,
  };
};

const createScriptedContext = async (secondSearchResults: RetrievedChunk[]) => {
  const context = await createContext();
  const searchCalls: Array<{ query: string; options: RetrieveOptions | undefined }> = [];

  return {
    context: {
      ...context,
      retriever: {
        ...context.retriever,
        async search(query: string, options?: RetrieveOptions) {
          searchCalls.push({ query, options });
          return searchCalls.length === 1 ? [] : secondSearchResults;
        },
      },
    },
    searchCalls,
  };
};

const getAuthorizedBookIds = (searchCalls: Array<{ resultBookIds: string[] }>) =>
  searchCalls.flatMap((call) => call.resultBookIds);

const expectEverySearchScopedTo = (
  searchCalls: Array<{ options: RetrieveOptions | undefined }>,
  bookId: string,
) => {
  expect(searchCalls.length).toBeGreaterThan(0);
  expect(searchCalls.every((call) => call.options?.editorialScope?.bookId === bookId)).toBe(true);
  expect(searchCalls.every((call) => call.options?.editorialScope?.includeShared === true)).toBe(true);
};

beforeEach(async () => {
  resetAuthStore();
  resetBookAccessServiceDependenciesForTesting();
  installBookAccessState();
  const context = await createContext();
  setAnswerGraphRetrieverContextForTesting(async () => context);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetAuthStore();
  resetBookAccessServiceDependenciesForTesting();
  resetAnswerGraphRetrieverContextForTesting();
  resetLlmForTesting();
});

describe("agent route authorization", () => {
  it.each(allAgentRoutes)("rejeita anonymous em %s", async (route) => {
    const response = await request(app).post(route).send(routeBodies[route]);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it.each(teacherOnlyRoutes)("rejeita student em rota teacher-only: %s", async (route) => {
    const token = await loginAsStudent();
    const response = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${token}`)
      .send(routeBodies[route]);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it.each(teacherOnlyRoutes)("permite teacher em rota teacher-only: %s", async (route) => {
    const token = await loginAsTeacher();
    const response = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${token}`)
      .send(routeBodies[route]);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it.each(allAgentRoutes)("rejeita admin sem bypass em %s", async (route) => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${token}`)
      .send(routeBodies[route]);
    const serializedBody = JSON.stringify(response.body);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(serializedBody).not.toContain(BOOK_EMMANUEL_ID);
    expect(serializedBody).not.toContain(BOOK_A_CAMINHO_ID);
  });

  it.each(allAgentRoutes)("rejeita visitor sem vazar escopo em %s", async (route) => {
    const token = await loginAsVisitor();
    const response = await request(app)
      .post(route)
      .set("Authorization", `Bearer ${token}`)
      .send(routeBodies[route]);
    const serializedBody = JSON.stringify(response.body);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(serializedBody).not.toContain("Emmanuel");
    expect(serializedBody).not.toContain("A Caminho da Luz");
    expect(serializedBody).not.toContain(BOOK_EMMANUEL_ID);
    expect(serializedBody).not.toContain(BOOK_A_CAMINHO_ID);
  });

  it.each(["student", "teacher"] as const)("permite %s em /api/agent/answer", async (role) => {
    const token = role === "student" ? await loginAsStudent() : await loginAsTeacher();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send(routeBodies["/api/agent/answer"]);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "emmanuel",
        name: "Emmanuel",
        bookTitle: "Emmanuel",
        matchMode: "selected_group",
      }),
    );
  });
});

describe("agent canonical book access", () => {
  it("usa livro canonico no fallback de lesson-plan quando bookTitle do cliente e forjado", async () => {
    const token = await loginAsTeacher();
    const response = await request(app)
      .post("/api/agent/lesson-plan")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...routeBodies["/api/agent/lesson-plan"],
        bookTitle: "A Caminho da Luz",
      });
    const serializedDraft = JSON.stringify(response.body.data);

    expect(response.status).toBe(200);
    expect(serializedDraft).toContain("Emmanuel");
    expect(serializedDraft).not.toContain("A Caminho da Luz");
  });

  it("mantem resposta em Emmanuel quando bookTitle forjado tenta trocar o livro", async () => {
    const { context, searchCalls } = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => context);
    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "emmanuel",
        bookTitle: "A Caminho da Luz",
        question: "Como estudar com constancia e calma?",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "emmanuel",
        name: "Emmanuel",
        bookTitle: "Emmanuel",
        matchMode: "selected_group",
      }),
    );
    expectEverySearchScopedTo(searchCalls, BOOK_EMMANUEL_ID);
    expect(getAuthorizedBookIds(searchCalls)).not.toContain(BOOK_A_CAMINHO_ID);
    expect(JSON.stringify(response.body.data.sources)).not.toContain("A Caminho da Luz");
  });

  it.each([
    "O que A Caminho da Luz diz sobre Capela?",
    "Como entender Capela com prudencia?",
  ])("nao troca o grupo quando a pergunta menciona outro livro: %s", async (question) => {
    const { context, searchCalls } = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => context);
    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupId: "emmanuel", question });

    expect(response.status).toBe(200);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "emmanuel",
        name: "Emmanuel",
        bookTitle: "Emmanuel",
        matchMode: "selected_group",
      }),
    );
    expect(response.body.data.safetyNotes.join(" ")).toMatch(/permanece limitada ao grupo selecionado/iu);
    expectEverySearchScopedTo(searchCalls, BOOK_EMMANUEL_ID);
    expect(getAuthorizedBookIds(searchCalls)).not.toContain(BOOK_A_CAMINHO_ID);
  });

  it("impede chunk de outro livro mesmo quando ele teria score maior", async () => {
    const { context, searchCalls } = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => context);
    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "emmanuel",
        question: "Capela capela capela racas adamicas civilizacoes antigas?",
      });

    expect(response.status).toBe(200);
    expectEverySearchScopedTo(searchCalls, BOOK_EMMANUEL_ID);
    expect(getAuthorizedBookIds(searchCalls)).not.toContain(BOOK_A_CAMINHO_ID);
    expect(JSON.stringify(response.body.data.sources)).not.toContain("civilizacoes antigas e Capela");
  });

  it("mantem o fallback de busca restrito ao mesmo editorialBookId", async () => {
    const emmanuelResult = (await createKeywordRetriever({ documents: governedDocuments }))
      .getIndex()
      .chunks.find((chunk) => chunk.editorial?.bookId === BOOK_EMMANUEL_ID);

    if (!emmanuelResult) {
      throw new Error("Fixture sem chunk Emmanuel");
    }

    const { context, searchCalls } = await createScriptedContext([
      {
        ...emmanuelResult,
        score: 0.6,
      },
    ]);
    setAnswerGraphRetrieverContextForTesting(async () => context);
    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupId: "emmanuel", question: "Tema sem resultado primario suficiente?" });

    expect(response.status).toBe(200);
    expect(searchCalls).toHaveLength(2);
    expectEverySearchScopedTo(searchCalls, BOOK_EMMANUEL_ID);
  });

  it("professor com dois grupos escolhe um unico livro por request", async () => {
    installBookAccessState({
      teacherGroupMemberships: [
        { userId: "user-professor-demo", groupId: "emmanuel" },
        { userId: "user-professor-demo", groupId: "a-caminho-da-luz" },
      ],
    });
    const token = await loginAsTeacher();

    const emmanuelContext = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => emmanuelContext.context);
    const emmanuelResponse = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupId: "emmanuel", question: "Como estudar com constancia?" });

    expect(emmanuelResponse.status).toBe(200);
    expectEverySearchScopedTo(emmanuelContext.searchCalls, BOOK_EMMANUEL_ID);
    expect(getAuthorizedBookIds(emmanuelContext.searchCalls)).not.toContain(BOOK_A_CAMINHO_ID);

    const caminhoContext = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => caminhoContext.context);
    const caminhoResponse = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupId: "a-caminho-da-luz", question: "Como estudar Evangelho na pratica?" });

    expect(caminhoResponse.status).toBe(200);
    expectEverySearchScopedTo(caminhoContext.searchCalls, BOOK_A_CAMINHO_ID);
    expect(getAuthorizedBookIds(caminhoContext.searchCalls)).not.toContain(BOOK_EMMANUEL_ID);
  });

  it("teacher single-group nao alcanca retriever ao pedir grupo nao autorizado", async () => {
    const { context, searchCalls } = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => context);
    const token = await loginAsTeacher();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "a-caminho-da-luz",
        question: "Como estudar Evangelho na pratica?",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("BOOK_ACCESS_FORBIDDEN");
    expect(searchCalls).toHaveLength(0);
  });

  it("student nao alcanca retriever ao pedir outro grupo", async () => {
    const { context, searchCalls } = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => context);
    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "a-caminho-da-luz",
        question: "Como estudar Evangelho na pratica?",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("BOOK_ACCESS_FORBIDDEN");
    expect(searchCalls).toHaveLength(0);
  });

  it("preserva erro de catalogo BookAccess antes do retrieval", async () => {
    installBookAccessState({
      groups: [
        {
          id: "emmanuel",
          name: "Emmanuel",
          status: "active",
          knowledgeBook: null,
        },
      ],
    });
    const { context, searchCalls } = await createInstrumentedContext();
    setAnswerGraphRetrieverContextForTesting(async () => context);
    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send(routeBodies["/api/agent/answer"]);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("BOOK_ACCESS_CATALOG_UNAVAILABLE");
    expect(response.body.error.details).toEqual({
      reason: "STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK",
    });
    expect(searchCalls).toHaveLength(0);
  });
});

describe("agent corpus and provider errors", () => {
  it("mantem fallback de provider quando ha contexto governado valido", async () => {
    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "emmanuel",
        question: "Como continuar estudando mesmo desanimado?",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toEqual(
      expect.objectContaining({
        provider: "fallback",
        usedFallback: true,
      }),
    );
    expect(response.body.data.sources.length).toBeGreaterThan(0);
    expect(response.body.data.fallbackReason).toContain("Ollama desativado");
  });

  it("retorna provider Groq quando o LLM remoto responde com contexto governado valido", async () => {
    setLlmRuntimeConfigForTesting({
      provider: "groq",
      ollamaModel: "llama3.1:8b",
      ollamaBaseUrl: "http://127.0.0.1:11434",
      groqApiKey: "groq-test-key",
      groqModel: "groq-model-test",
    });
    setLlmChatModelFactoryForTesting(() => ({
      invoke: vi.fn().mockResolvedValue({
        content:
          "Resposta inicial: o estudo pode seguir em passos pequenos e constantes, sempre com revisao do professor.",
      }),
    }));

    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "emmanuel",
        question: "Como continuar estudando mesmo desanimado?",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toEqual(
      expect.objectContaining({
        provider: "groq",
        usedFallback: false,
      }),
    );
    expect(response.body.data.provider).toBe("groq");
    expect(response.body.data.usedFallback).toBe(false);
    expect(response.body.data.fallbackReason).toBeUndefined();
    expect(response.body.data.sources.length).toBeGreaterThan(0);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "emmanuel",
        matchMode: "selected_group",
      }),
    );
  });

  it("falha fechado quando o corpus governado esta indisponivel depois de autorizacao valida", async () => {
    setAnswerGraphRetrieverContextForTesting(async () => {
      throw new GovernedCorpusError(
        "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
        "Manifesto editorial indisponivel para montar o corpus governado.",
        { issues: [{ filePath: "/tmp/repositorio/data/knowledge/segredo.md" }] },
      );
    });

    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "emmanuel",
        question: "A prece ajuda?",
      });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "KNOWLEDGE_CORPUS_UNAVAILABLE",
        message: "Base de conhecimento temporariamente indisponivel.",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("/tmp");
    expect(JSON.stringify(response.body)).not.toContain("usedFallback");
  });

  it("falha fechado quando a busca no retriever governado falha", async () => {
    const context = await createContext();
    setAnswerGraphRetrieverContextForTesting(async () => ({
      ...context,
      retriever: {
        ...context.retriever,
        search: async () => {
          throw new Error("/tmp/repositorio/data/knowledge/segredo.md");
        },
      },
    }));

    const token = await loginAsStudent();
    const response = await request(app)
      .post("/api/agent/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        groupId: "emmanuel",
        question: "A prece ajuda?",
      });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("/tmp");
    expect(JSON.stringify(response.body)).not.toContain("usedFallback");
  });
});
