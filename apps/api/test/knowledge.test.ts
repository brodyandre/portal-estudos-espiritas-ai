import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import { GovernedCorpusError, type GovernedCorpusDocument } from "../src/knowledge/governedCorpus";
import {
  resetKnowledgeRetrieverContextForTesting,
  setKnowledgeRetrieverContextForTesting,
} from "../src/modules/knowledge/knowledge.service";
import { createKeywordRetriever } from "../src/rag/retriever";
import type { GovernedRetrieverContext } from "../src/rag/governedRetriever";
import * as documentLoader from "../src/rag/documentLoader";
import * as retrieverModule from "../src/rag/retriever";

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
    bookId: `book-${id}`,
    catalogKey: id,
    documentTitle: title,
    bookTitle: book,
    bookSlug: book.toLowerCase().replace(/\s+/gu, "-"),
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
    "prece acolhimento serenidade encontro fraterno",
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
    "constancia estudo desanimado perseveranca aplicacao pratica",
    {
      filename: "emmanuel_tema_constancia.md",
      path: "data/knowledge/emmanuel/emmanuel_tema_constancia.md",
      tags: ["constancia", "emmanuel"],
    },
  ),
  buildDocument(
    "a_caminho_da_luz_tema_civilizacoes_antigas",
    "A Caminho da Luz - civilizacoes antigas e Capela",
    "A Caminho da Luz",
    "A Caminho da Luz",
    "capela civilizacoes antigas historia espiritual prudencia",
    {
      filename: "a_caminho_da_luz_tema_civilizacoes_antigas.md",
      path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_civilizacoes_antigas.md",
      tags: ["capela", "historia"],
      sensitiveTopics: ["Capela"],
      teacherReviewRecommended: true,
    },
  ),
  buildDocument(
    "a_caminho_da_luz_tema_jesus_e_evangelho",
    "A Caminho da Luz - Jesus e Evangelho",
    "A Caminho da Luz",
    "A Caminho da Luz",
    "evangelho jesus moral pratica espiritual",
    {
      filename: "a_caminho_da_luz_tema_jesus_e_evangelho.md",
      path: "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_jesus_e_evangelho.md",
      tags: ["evangelho", "jesus"],
    },
  ),
];

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

beforeEach(async () => {
  const context = await createContext();
  setKnowledgeRetrieverContextForTesting(async () => context);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetKnowledgeRetrieverContextForTesting();
});

describe("GET /api/knowledge", () => {
  it("retorna a visao geral a partir do corpus governado", async () => {
    const response = await request(app).get("/api/knowledge");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.totalGroups).toBe(2);
    expect(response.body.data.totalFiles).toBe(4);
    expect(response.body.data.groups).toHaveLength(2);
    expect(response.body.data.groups[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        book: expect.any(String),
        summary: expect.any(String),
        fileCount: expect.any(Number),
        tags: expect.any(Array),
        types: expect.any(Array),
      }),
    );
    expect(response.body.data.sharedFiles).toEqual([
      expect.objectContaining({ filename: "orientacoes_do_grupo.md" }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain("test-fingerprint");
    expect(JSON.stringify(response.body)).not.toContain("absolutePath");
  });
});

describe("GET /api/knowledge/groups", () => {
  it("retorna os grupos aceitos pela base de conhecimento", async () => {
    const response = await request(app).get("/api/knowledge/groups");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBe(2);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "emmanuel", name: "Emmanuel" }),
        expect.objectContaining({
          id: "a_caminho_da_luz",
          name: "A Caminho da Luz",
        }),
      ]),
    );
  });
});

describe("GET /api/knowledge/:group", () => {
  it("retorna a base resumida do grupo Emmanuel sem conteudo longo", async () => {
    const response = await request(app).get("/api/knowledge/emmanuel");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "emmanuel",
        name: "Emmanuel",
        book: "Emmanuel",
      }),
    );
    expect(response.body.data.featuredFiles).toEqual([
      expect.objectContaining({
        filename: "emmanuel_tema_constancia.md",
        type: "tema",
        tags: expect.any(Array),
        summary: expect.any(String),
      }),
    ]);
    expect(response.body.data.featuredFiles[0].content).toBeUndefined();
  });

  it("retorna a base resumida do grupo A Caminho da Luz", async () => {
    const response = await request(app).get("/api/knowledge/a_caminho_da_luz");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "a_caminho_da_luz",
        name: "A Caminho da Luz",
        book: "A Caminho da Luz",
      }),
    );
    expect(response.body.data.featuredFiles.length).toBeGreaterThan(0);
  });
});

describe("GET /api/knowledge/:group/files", () => {
  it("lista apenas arquivos governados do grupo sem conteudo integral", async () => {
    const response = await request(app).get("/api/knowledge/a_caminho_da_luz/files");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toEqual(
      expect.objectContaining({ count: 2, group: "a_caminho_da_luz" }),
    );
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "a_caminho_da_luz_tema_civilizacoes_antigas.md",
          teacherReviewRecommended: true,
        }),
        expect.objectContaining({
          filename: "a_caminho_da_luz_tema_jesus_e_evangelho.md",
          teacherReviewRecommended: false,
        }),
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain("content");
    expect(JSON.stringify(response.body)).not.toContain("absolutePath");
    expect(JSON.stringify(response.body)).not.toContain("test-fingerprint");
  });
});

describe("GET /api/knowledge/search", () => {
  it("encontra material compartilhado para a busca por prece usando corpus governado", async () => {
    const response = await request(app).get("/api/knowledge/search").query({ q: "prece" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBeGreaterThan(0);
    expect(response.body.data.query).toBe("prece");
    expect(response.body.data.items.some((item: { filename: string }) => item.filename === "orientacoes_do_grupo.md")).toBe(true);
  });

  it("encontra material sensivel para a busca por capela", async () => {
    const response = await request(app).get("/api/knowledge/search").query({ q: "capela" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBeGreaterThan(0);
    expect(
      response.body.data.items.some(
        (item: { title: string; teacherReviewRecommended: boolean }) =>
          /capela|civilizacoes antigas/iu.test(item.title) && item.teacherReviewRecommended,
      ),
    ).toBe(true);
  });

  it("nao retorna arquivo orfao nem item inelegivel ausentes do snapshot", async () => {
    const response = await request(app).get("/api/knowledge/search").query({ q: "orfao draft" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("orfao.md");
    expect(JSON.stringify(response.body)).not.toContain("draft.md");
  });

  it("preserva zero resultados como sucesso publico", async () => {
    const emptyContext = await createContext([]);
    setKnowledgeRetrieverContextForTesting(async () => emptyContext);

    const response = await request(app).get("/api/knowledge/search").query({ q: "termo-sem-correspondencia" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.meta.count).toBe(0);
    expect(response.body.data.guidance).toContain("Ainda nao encontrei");
  });

  it("falha fechado quando o corpus esta indisponivel sem expor detalhes internos", async () => {
    setKnowledgeRetrieverContextForTesting(async () => {
      throw new GovernedCorpusError(
        "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
        "Manifesto editorial indisponivel para montar o corpus governado.",
        { issues: [{ filePath: "/tmp/repositorio/data/knowledge/segredo.md" }] },
      );
    });

    const response = await request(app).get("/api/knowledge/search").query({ q: "prece" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "KNOWLEDGE_CORPUS_UNAVAILABLE",
        message: "Base de conhecimento temporariamente indisponivel.",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("/tmp");
    expect(JSON.stringify(response.body)).not.toContain("issues");
  });

  it("falha fechado quando o retriever falha durante a busca", async () => {
    const context = await createContext();
    setKnowledgeRetrieverContextForTesting(async () => ({
      ...context,
      retriever: {
        ...context.retriever,
        search: async () => {
          throw new Error("/tmp/repositorio/data/knowledge/segredo.md");
        },
      },
    }));

    const response = await request(app).get("/api/knowledge/search").query({ q: "prece" });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("/tmp");
  });

  it("nao chama loader legado nem cria retriever sem documentos governados no fluxo publico", async () => {
    const loadLegacy = vi.spyOn(documentLoader, "loadKnowledgeDocuments");
    const createRetriever = vi.spyOn(retrieverModule, "createKeywordRetriever");

    const response = await request(app).get("/api/knowledge/search").query({ q: "prece" });

    expect(response.status).toBe(200);
    expect(loadLegacy).not.toHaveBeenCalled();
    expect(createRetriever).not.toHaveBeenCalled();
  });

  it("usa contexto atualizado quando a identidade fisica muda", async () => {
    const firstContext = await createContext([
      buildDocument("primeiro", "Primeiro", "Emmanuel", "Emmanuel", "prece antiga"),
    ], "corpus-antigo");
    const secondContext = await createContext([
      buildDocument("segundo", "Segundo", "Emmanuel", "Emmanuel", "prece nova"),
    ], "corpus-novo");
    const contexts = [firstContext, secondContext];
    setKnowledgeRetrieverContextForTesting(async () => contexts.shift() ?? secondContext);

    const first = await request(app).get("/api/knowledge/search").query({ q: "antiga" });
    const second = await request(app).get("/api/knowledge/search").query({ q: "nova" });

    expect(first.body.data.items).toEqual([
      expect.objectContaining({ filename: "primeiro.md" }),
    ]);
    expect(second.body.data.items).toEqual([
      expect.objectContaining({ filename: "segundo.md" }),
    ]);
  });
});
