import { describe, expect, it } from "vitest";

import {
  getKnowledgeFileExists,
  normalizeKnowledgeFilePath,
  resolveKnowledgeFilePath,
} from "../src/modules/admin/knowledge/filesystem";

describe("admin knowledge filesystem", () => {
  it("normaliza e valida arquivo markdown existente", async () => {
    expect(normalizeKnowledgeFilePath("data/knowledge/README.md")).toBe("data/knowledge/README.md");
    await expect(resolveKnowledgeFilePath("data/knowledge/README.md")).resolves.toEqual({
      filePath: "data/knowledge/README.md",
      exists: true,
    });
  });

  it("rejeita path absoluto, traversal e extensao nao markdown", () => {
    expect(() => normalizeKnowledgeFilePath("/data/knowledge/README.md")).toThrow("Caminho");
    expect(() => normalizeKnowledgeFilePath("data/knowledge/../README.md")).toThrow("Caminho");
    expect(() => normalizeKnowledgeFilePath("data/knowledge/file.txt")).toThrow("Markdown");
  });

  it("retorna false para arquivo removido ou inexistente sem expor path absoluto", async () => {
    await expect(getKnowledgeFileExists("data/knowledge/arquivo-inexistente.md")).resolves.toBe(false);
  });
});
