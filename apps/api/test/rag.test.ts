import { beforeAll, describe, expect, it } from "vitest";

import { loadKnowledgeDocuments } from "../src/rag/documentLoader";
import { createKeywordRetriever } from "../src/rag/retriever";
import type { KeywordRetriever, KnowledgeDocument } from "../src/rag/types";

describe("RAG local", () => {
  let documents: KnowledgeDocument[] = [];
  let retriever: KeywordRetriever;

  beforeAll(async () => {
    documents = await loadKnowledgeDocuments();
    retriever = await createKeywordRetriever({ documents });
  });

  it("carrega os dois grupos com metadados completos", async () => {
    expect(documents.length).toBeGreaterThan(20);
    expect(documents.some((document) => document.group === "Emmanuel")).toBe(true);
    expect(documents.some((document) => document.group === "A Caminho da Luz")).toBe(true);

    const emmanuelDocument = documents.find(
      (document) => document.filename === "emmanuel_tema_constancia.md",
    );
    const capelaDocument = documents.find(
      (document) => document.filename === "a_caminho_da_luz_tema_civilizacoes_antigas.md",
    );

    expect(emmanuelDocument).toEqual(
      expect.objectContaining({
        title: "Emmanuel - constancia no estudo",
        group: "Emmanuel",
        book: "Emmanuel",
        source: expect.stringContaining("autoral"),
        filename: "emmanuel_tema_constancia.md",
        path: "data/knowledge/emmanuel/emmanuel_tema_constancia.md",
        teacherReviewRecommended: false,
      }),
    );
    expect(emmanuelDocument?.tags).toContain("constancia");
    expect(Array.isArray(emmanuelDocument?.sensitiveTopics)).toBe(true);

    expect(capelaDocument).toEqual(
      expect.objectContaining({
        group: "A Caminho da Luz",
        book: "A Caminho da Luz",
        teacherReviewRecommended: true,
      }),
    );
    expect(capelaDocument?.sensitiveTopics).toContain("Capela");
  });

  it("recupera contexto sobre prece a partir das orientacoes compartilhadas", async () => {
    const results = await retriever.search("prece", {
      group: "Emmanuel",
      book: "Emmanuel",
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.path === "data/knowledge/orientacoes_do_grupo.md")).toBe(true);
  });

  it("recupera contexto de constancia para Emmanuel", async () => {
    const results = await retriever.search("constância", {
      group: "Emmanuel",
      book: "Emmanuel",
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (result) => result.path === "data/knowledge/emmanuel/emmanuel_tema_constancia.md",
      ),
    ).toBe(true);
  });

  it("recupera contexto sobre Capela com revisao humana recomendada", async () => {
    const results = await retriever.search("Capela", {
      group: "A Caminho da Luz",
      book: "A Caminho da Luz",
      limit: 3,
    });

    const capelaResult = results.find((result) =>
      result.path ===
      "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_civilizacoes_antigas.md",
    );

    expect(capelaResult).toBeDefined();
    expect(capelaResult?.teacherReviewRecommended).toBe(true);
    expect(capelaResult?.sensitiveTopics).toContain("Capela");
  });

  it("recupera contexto sobre Evangelho com filtro por livro", async () => {
    const results = await retriever.search("Evangelho", {
      group: "A Caminho da Luz",
      book: "A Caminho da Luz",
      limit: 4,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some((result) =>
        result.path ===
          "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_jesus_e_evangelho.md" ||
        result.path ===
          "data/knowledge/a_caminho_da_luz/a_caminho_da_luz_tema_espiritismo_e_futuro.md",
      ),
    ).toBe(true);
  });

  it("recupera contexto sobre mediunidade e preserva metadados sensiveis", async () => {
    const results = await retriever.search("mediunidade", {
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (result) =>
          result.teacherReviewRecommended &&
          result.sensitiveTopics.some((topic) => topic.toLowerCase() === "mediunidade"),
      ),
    ).toBe(true);

    expect(results[0]).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        group: expect.any(String),
        book: expect.any(String),
        source: expect.any(String),
        filename: expect.any(String),
        path: expect.any(String),
        tags: expect.any(Array),
        sensitiveTopics: expect.any(Array),
        teacherReviewRecommended: expect.any(Boolean),
      }),
    );
  });
});
