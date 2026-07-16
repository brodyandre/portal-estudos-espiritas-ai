import { describe, expect, it } from "vitest";

import {
  parseCreateKnowledgeBookBody,
  parseKnowledgeBooksListQuery,
  parseUpdateKnowledgeBookBody,
} from "../src/modules/admin/knowledge/query";

describe("admin knowledge books query parser", () => {
  it("aplica defaults e filtros validos", () => {
    expect(parseKnowledgeBooksListQuery({ status: "active", search: "emmanuel" })).toMatchObject({
      page: 1,
      pageSize: 10,
      status: "active",
      search: "emmanuel",
      sortBy: "sortOrder",
      sortOrder: "asc",
    });
  });

  it("rejeita query extra, array inesperado e pageSize acima do limite", () => {
    expect(() => parseKnowledgeBooksListQuery({ extra: "x" })).toThrow("Parâmetros inválidos");
    expect(() => parseKnowledgeBooksListQuery({ status: ["active"] })).toThrow("Parâmetros inválidos");
    expect(() => parseKnowledgeBooksListQuery({ pageSize: "51" })).toThrow("Parâmetros inválidos");
  });

  it("normaliza slug e exige version em updates", () => {
    expect(parseCreateKnowledgeBookBody({ slug: "emmanuel", title: "Emmanuel" }).slug).toBe("emmanuel");
    expect(parseUpdateKnowledgeBookBody({ title: "Novo", version: 2 })).toEqual({ title: "Novo", version: 2 });
    expect(() => parseUpdateKnowledgeBookBody({ title: "Novo" })).toThrow("Dados inválidos");
  });
});
