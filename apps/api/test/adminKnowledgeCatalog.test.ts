import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { catalogKnowledgeBase } from "../src/modules/admin/knowledge/catalog";
import {
  createMemoryKnowledgeRepository,
  createMemoryKnowledgeState,
} from "../src/modules/admin/knowledge/repository";
import {
  getKnowledgeRepositoryForCatalog,
  resetKnowledgeRepositoryForTesting,
  setKnowledgeRepositoryForTesting,
} from "../src/modules/admin/knowledge/service";

describe("admin knowledge catalog", () => {
  beforeEach(() => {
    let nextId = 1;
    setKnowledgeRepositoryForTesting(createMemoryKnowledgeRepository(createMemoryKnowledgeState(), {
      nowProvider: () => new Date("2026-07-16T12:00:00.000Z"),
      idProvider: () => `knowledge-${nextId++}`,
    }));
  });

  afterEach(() => {
    resetKnowledgeRepositoryForTesting();
  });

  it("executa primeira catalogacao e reexecucao sem duplicidade", async () => {
    const first = await catalogKnowledgeBase();
    const second = await catalogKnowledgeBase();

    expect(first.createdBooks).toBeGreaterThan(0);
    expect(first.createdDocuments).toBeGreaterThan(0);
    expect(first.failedEntries).toEqual([]);
    expect(second.createdBooks).toBe(0);
    expect(second.createdDocuments).toBe(0);
    expect(second.unchangedDocuments).toBe(first.createdDocuments);
  });

  it("cria colecao shared para conteudos compartilhados", async () => {
    await catalogKnowledgeBase();
    const repository = getKnowledgeRepositoryForCatalog();
    const shared = await repository.findBookBySlug("shared");
    expect(shared).toMatchObject({
      slug: "shared",
      title: "Conteúdos compartilhados",
    });
  });
});
