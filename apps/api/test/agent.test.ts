import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import {
  resetAnswerGraphRetrieverContextForTesting,
  setAnswerGraphRetrieverContextForTesting,
} from "../src/agent/answer-graph";
import { GovernedCorpusError, type GovernedCorpusDocument } from "../src/knowledge/governedCorpus";
import type { GovernedRetrieverContext } from "../src/rag/governedRetriever";
import { createKeywordRetriever } from "../src/rag/retriever";

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
    "capela racas adamicas civilizacoes antigas historia espiritual prudencia",
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
  setAnswerGraphRetrieverContextForTesting(async () => context);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetAnswerGraphRetrieverContextForTesting();
});

describe("POST /api/agent/lesson-plan", () => {
  it("retorna fallback claro quando Ollama nao esta disponivel", async () => {
    const response = await request(app).post("/api/agent/lesson-plan").send({
      groupId: "emmanuel",
      theme: "Constancia no estudo durante a semana",
      teacherNote: "Reservar um momento para acolhimento inicial.",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.usedFallback).toBe(true);
    expect(response.body.data.kind).toBe("lesson-plan");
    expect(response.body.data.provider).toBe("fallback");
    expect(response.body.data.usedFallback).toBe(true);
    expect(response.body.data.reviewNote).toContain("revisao humana");
    expect(response.body.data.fallbackReason).toBeTruthy();
  });
});

describe("POST /api/agent/answer", () => {
  it.each([
    {
      groupId: "emmanuel",
      question: "Como continuar estudando mesmo desanimado?",
      expectedGroupName: "Emmanuel",
      expectedKeyword: "desanimado",
      expectedSensitiveTopic: /sofrimento|desanimo|professor/iu,
    },
    {
      groupId: "emmanuel",
      question: "A prece muda meus problemas?",
      expectedGroupName: undefined,
      expectedKeyword: "prece",
      expectedSensitiveTopic: /professor|serenidade|revis/iu,
    },
    {
      groupId: "emmanuel",
      question: "O que e Capela?",
      expectedGroupName: "A Caminho da Luz",
      expectedKeyword: "capela",
      expectedSensitiveTopic: /capela|prudencia|professor/iu,
    },
    {
      groupId: "emmanuel",
      question: "Como entender racas adamicas?",
      expectedGroupName: "A Caminho da Luz",
      expectedKeyword: "racas adamicas",
      expectedSensitiveTopic: /racas adamicas|prudencia|professor/iu,
    },
    {
      groupId: "a-caminho-da-luz",
      question: "Como viver o Evangelho na pratica?",
      expectedGroupName: undefined,
      expectedKeyword: "evangelho",
      expectedSensitiveTopic: /professor|revis|evangelho/iu,
    },
  ])(
    "retorna resposta curta e revisavel para a pergunta: $question",
    async ({ groupId, question, expectedGroupName, expectedKeyword, expectedSensitiveTopic }) => {
      const response = await request(app).post("/api/agent/answer").send({
        groupId,
        question,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.answer).toBe("string");
      expect(response.body.data.answer.length).toBeGreaterThan(20);
      expect(response.body.data.answer.length).toBeLessThan(900);
      expect(response.body.data.group).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          bookTitle: expect.any(String),
          matchMode: expect.any(String),
        }),
      );

      if (expectedGroupName) {
        expect(response.body.data.group.name).toBe(expectedGroupName);
      }

      expect(Array.isArray(response.body.data.sources)).toBe(true);
      expect(response.body.data.sources.length).toBeGreaterThan(0);
      expect(response.body.data.sources[0]).toEqual(
        expect.objectContaining({
          source: expect.any(String),
          title: expect.any(String),
          score: expect.any(Number),
        }),
      );
      expect(Array.isArray(response.body.data.keywords)).toBe(true);
      expect(
        response.body.data.keywords.some((keyword: string) =>
          keyword.toLowerCase().includes(expectedKeyword),
        ),
      ).toBe(true);
      expect(response.body.data.needsTeacherReview).toBe(true);
      expect(Array.isArray(response.body.data.safetyNotes)).toBe(true);
      expect(response.body.data.safetyNotes.join(" ")).toMatch(expectedSensitiveTopic);
      expect(typeof response.body.data.suggestedTeacherFollowUp).toBe("string");
      expect(response.body.data.suggestedTeacherFollowUp).toContain("professor");
      expect(response.body.meta).toEqual(
        expect.objectContaining({
          provider: expect.any(String),
          usedFallback: expect.any(Boolean),
        }),
      );
    },
  );

  it("nao expoe arquivos fora do snapshot governado nem metadados internos nas fontes", async () => {
    const response = await request(app).post("/api/agent/answer").send({
      groupId: "emmanuel",
      question: "Existe algo sobre orfao draft ou prece?",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(JSON.stringify(response.body.data.sources)).not.toContain("orfao.md");
    expect(JSON.stringify(response.body.data.sources)).not.toContain("draft.md");
    expect(JSON.stringify(response.body)).not.toContain("absolutePath");
    expect(JSON.stringify(response.body)).not.toContain("test-fingerprint");
  });

  it("mantem fallback de provider quando ha contexto governado valido", async () => {
    const response = await request(app).post("/api/agent/answer").send({
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

  it("falha fechado quando o corpus governado esta indisponivel", async () => {
    setAnswerGraphRetrieverContextForTesting(async () => {
      throw new GovernedCorpusError(
        "GOVERNED_CORPUS_MANIFEST_UNAVAILABLE",
        "Manifesto editorial indisponivel para montar o corpus governado.",
        { issues: [{ filePath: "/tmp/repositorio/data/knowledge/segredo.md" }] },
      );
    });

    const response = await request(app).post("/api/agent/answer").send({
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

    const response = await request(app).post("/api/agent/answer").send({
      groupId: "emmanuel",
      question: "A prece ajuda?",
    });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("KNOWLEDGE_CORPUS_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("/tmp");
    expect(JSON.stringify(response.body)).not.toContain("usedFallback");
  });
});
