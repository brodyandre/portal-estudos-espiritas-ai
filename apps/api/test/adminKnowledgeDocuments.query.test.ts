import { describe, expect, it } from "vitest";

import {
  parseCreateKnowledgeDocumentBody,
  parseKnowledgeDocumentsListQuery,
  parseTransitionKnowledgeDocumentBody,
  parseUpdateKnowledgeDocumentBody,
} from "../src/modules/admin/knowledge/query";

describe("admin knowledge documents query parser", () => {
  it("parseia filtros validos", () => {
    expect(parseKnowledgeDocumentsListQuery({
      type: "tema",
      editorialStatus: "draft",
      teacherReviewRecommended: "true",
      hasSensitiveTopics: "false",
    })).toMatchObject({
      type: "tema",
      editorialStatus: "draft",
      teacherReviewRecommended: true,
      hasSensitiveTopics: false,
    });
  });

  it("rejeita enums, booleanos e campos extras invalidos", () => {
    expect(() => parseKnowledgeDocumentsListQuery({ type: "pdf" })).toThrow("Parâmetros inválidos");
    expect(() => parseKnowledgeDocumentsListQuery({ teacherReviewRecommended: "yes" })).toThrow("Parâmetros inválidos");
    expect(() => parseCreateKnowledgeDocumentBody({ title: "x", extra: true })).toThrow("Dados inválidos");
  });

  it("normaliza arrays e valida version/transicao", () => {
    const body = parseCreateKnowledgeDocumentBody({
      bookId: "book-1",
      filePath: "data/knowledge/README.md",
      title: "README",
      type: "readme",
      tags: [" Base ", "base"],
      sensitiveTopics: [" Saude "],
    });
    expect(body.tags).toEqual(["base"]);
    expect(body.teacherReviewRecommended).toBe(true);
    expect(parseUpdateKnowledgeDocumentBody({ version: 1, tags: ["A", "a"] }).tags).toEqual(["a"]);
    expect(parseTransitionKnowledgeDocumentBody({ version: 1, editorialStatus: "reviewed" })).toMatchObject({
      version: 1,
      editorialStatus: "reviewed",
    });
  });
});
