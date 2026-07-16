import { chmod, mkdtemp, mkdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildKnowledgeEditorialManifest,
  createKnowledgeManifestFromCandidates,
  type KnowledgeManifestCatalogCandidate,
} from "../src/knowledge/manifest";
import { resolveKnowledgeFilePath } from "../src/knowledge/filesystem";
import { loadKnowledgeDocuments, loadKnowledgeDocumentsFromManifest } from "../src/rag/documentLoader";
import { searchChunks } from "../src/rag/retriever";
import { splitDocumentIntoChunks } from "../src/rag/textSplitter";

const tempRoots: string[] = [];

const markdownContent = (title = "Documento seguro") => `---
title: "${title}"
group: "Emmanuel"
purpose: "apoio para respostas simples"
source: "resumo autoral demonstrativo produzido para o portal"
---

# ${title}

Conteudo autoral curto para validar o carregamento governado pela fronteira editorial.
`;

const createRepositoryRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "knowledge-manifest-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "data", "knowledge"), { recursive: true });
  return root;
};

const writeKnowledgeFile = async (root: string, relativePath: string, content = markdownContent()) => {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
};

const buildCandidate = (
  overrides: Partial<KnowledgeManifestCatalogCandidate> = {},
): KnowledgeManifestCatalogCandidate => ({
  documentId: "doc-approved",
  bookId: "book-emmanuel",
  catalogKey: "emmanuel-approved",
  filePath: "data/knowledge/emmanuel/aprovado.md",
  documentTitle: "Documento aprovado",
  description: "Descrição editorial",
  summary: "Resumo editorial",
  type: "tema",
  tags: ["Estudo", "Emmanuel"],
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  editorialStatus: "approved",
  documentVersion: 3,
  documentSortOrder: 1,
  documentUpdatedAt: "2026-07-16T10:00:00.000Z",
  book: {
    id: "book-emmanuel",
    slug: "emmanuel",
    title: "Emmanuel",
    status: "active",
    sortOrder: 1,
    version: 2,
    updatedAt: "2026-07-16T09:00:00.000Z",
  },
  ...overrides,
});

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("knowledge filesystem safety", () => {
  it("aceita caminho relativo Markdown dentro de data/knowledge", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/seguro.md");

    const result = await resolveKnowledgeFilePath("data/knowledge/emmanuel/seguro.md", { repositoryRoot: root });

    expect(result.filePath).toBe("data/knowledge/emmanuel/seguro.md");
    expect(result.absolutePath).toContain(root);
  });

  it("aceita extensão Markdown com caixa diferente como o loader legado", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/seguro.MD");

    const result = await resolveKnowledgeFilePath("data/knowledge/emmanuel/seguro.MD", { repositoryRoot: root });

    expect(result.filePath).toBe("data/knowledge/emmanuel/seguro.MD");
  });

  it.each([
    ["caminho absoluto", (root: string) => path.join(root, "data/knowledge/emmanuel/seguro.md")],
    ["caminho absoluto Windows", () => "C:\\data\\knowledge\\emmanuel\\seguro.md"],
    ["path traversal", () => "data/knowledge/../segredo.md"],
    ["segmento vazio", () => "data/knowledge//seguro.md"],
    ["extensão não suportada", () => "data/knowledge/emmanuel/seguro.txt"],
    ["arquivo inexistente", () => "data/knowledge/emmanuel/ausente.md"],
  ])("rejeita %s", async (_caseName, buildPath) => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/seguro.md");

    await expect(resolveKnowledgeFilePath(buildPath(root), { repositoryRoot: root })).rejects.toMatchObject({
      code: expect.stringMatching(/^KNOWLEDGE_FILE_/u),
    });
  });

  it("rejeita diretório no lugar de arquivo regular", async () => {
    const root = await createRepositoryRoot();
    await mkdir(path.join(root, "data/knowledge/emmanuel/diretorio.md"), { recursive: true });

    await expect(
      resolveKnowledgeFilePath("data/knowledge/emmanuel/diretorio.md", { repositoryRoot: root }),
    ).rejects.toMatchObject({ code: "KNOWLEDGE_FILE_NOT_REGULAR" });
  });

  it("rejeita link simbólico que escapa da raiz autorizada", async () => {
    const root = await createRepositoryRoot();
    const outsideFile = path.join(root, "fora.md");
    await writeFile(outsideFile, markdownContent("Arquivo externo"), "utf8");
    await mkdir(path.join(root, "data/knowledge/emmanuel"), { recursive: true });
    await symlink(outsideFile, path.join(root, "data/knowledge/emmanuel/escape.md"));

    await expect(
      resolveKnowledgeFilePath("data/knowledge/emmanuel/escape.md", { repositoryRoot: root }),
    ).rejects.toMatchObject({ code: "KNOWLEDGE_FILE_PATH_INVALID" });
  });

  it("rejeita link simbólico intermediário que escapa da raiz autorizada", async () => {
    const root = await createRepositoryRoot();
    const outsideDir = path.join(root, "fora");
    await mkdir(outsideDir, { recursive: true });
    await writeFile(path.join(outsideDir, "escape.md"), markdownContent("Arquivo externo"), "utf8");
    await symlink(outsideDir, path.join(root, "data/knowledge/atalho"));

    await expect(
      resolveKnowledgeFilePath("data/knowledge/atalho/escape.md", { repositoryRoot: root }),
    ).rejects.toMatchObject({ code: "KNOWLEDGE_FILE_PATH_INVALID" });
  });

  it("rejeita arquivo sem permissão de leitura", async () => {
    const root = await createRepositoryRoot();
    const filePath = path.join(root, "data/knowledge/emmanuel/bloqueado.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/bloqueado.md");
    await chmod(filePath, 0o000);

    await expect(
      resolveKnowledgeFilePath("data/knowledge/emmanuel/bloqueado.md", { repositoryRoot: root }),
    ).rejects.toMatchObject({ code: "KNOWLEDGE_FILE_NOT_READABLE" });
  });
});

describe("knowledge editorial manifest", () => {
  it("seleciona somente livro ativo com documento aprovado", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/draft.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/reviewed.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/archived.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/inactive-book.md");

    const candidates = [
      buildCandidate(),
      buildCandidate({
        documentId: "doc-draft",
        filePath: "data/knowledge/emmanuel/draft.md",
        editorialStatus: "draft",
      }),
      buildCandidate({
        documentId: "doc-reviewed",
        filePath: "data/knowledge/emmanuel/reviewed.md",
        editorialStatus: "reviewed",
      }),
      buildCandidate({
        documentId: "doc-archived",
        filePath: "data/knowledge/emmanuel/archived.md",
        editorialStatus: "archived",
      }),
      buildCandidate({
        documentId: "doc-inactive-book",
        filePath: "data/knowledge/emmanuel/inactive-book.md",
        book: { ...buildCandidate().book, status: "archived" },
      }),
    ];

    const { manifest, issues } = await createKnowledgeManifestFromCandidates(candidates, { repositoryRoot: root });

    expect(manifest.sources).toHaveLength(1);
    expect(manifest.sources[0]).toEqual(expect.objectContaining({ documentId: "doc-approved" }));
    expect(issues.map((issue) => issue.code)).toEqual([
      "KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE",
      "KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE",
      "KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE",
      "KNOWLEDGE_MANIFEST_SOURCE_INELIGIBLE",
    ]);
  });

  it("trata registro incompleto como inelegível seguro", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");

    const { manifest, issues } = await createKnowledgeManifestFromCandidates(
      [buildCandidate({ documentTitle: "" })],
      { repositoryRoot: root },
    );

    expect(manifest.sources).toHaveLength(0);
    expect(issues).toEqual([
      expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_METADATA_INCOMPLETE" }),
    ]);
  });

  it("exclui todos os registros com documentId duplicado sem escolher vencedor arbitrário", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/b.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/a.md");

    const a = buildCandidate({
      documentId: "doc-a",
      filePath: "data/knowledge/emmanuel/a.md",
      documentTitle: "A",
      documentSortOrder: 1,
    });
    const b = buildCandidate({
      documentId: "doc-b",
      filePath: "data/knowledge/emmanuel/b.md",
      documentTitle: "B",
      documentSortOrder: 2,
    });
    const duplicate = buildCandidate({
      documentId: "doc-b",
      filePath: "data/knowledge/emmanuel/b.md",
      documentTitle: "B duplicado",
      documentSortOrder: 3,
    });

    const first = await createKnowledgeManifestFromCandidates([b, duplicate, a], { repositoryRoot: root });

    expect(first.manifest.sources.map((source) => source.documentId)).toEqual(["doc-a"]);
    expect(first.issues).toEqual([
      expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_DUPLICATE_DOCUMENT", documentId: "doc-b" }),
      expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_DUPLICATE_DOCUMENT" }),
    ]);
  });

  it("exclui documentos distintos que apontam para o mesmo arquivo físico", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/mesmo.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/outro.md");

    const sharedFileA = buildCandidate({
      documentId: "doc-shared-a",
      filePath: "data/knowledge/emmanuel/mesmo.md",
      documentTitle: "Compartilhado A",
    });
    const sharedFileB = buildCandidate({
      documentId: "doc-shared-b",
      filePath: "data/knowledge/emmanuel/mesmo.md",
      documentTitle: "Compartilhado B",
    });
    const unrelated = buildCandidate({
      documentId: "doc-outro",
      filePath: "data/knowledge/emmanuel/outro.md",
      documentTitle: "Outro",
    });

    const result = await createKnowledgeManifestFromCandidates([sharedFileB, unrelated, sharedFileA], {
      repositoryRoot: root,
    });

    expect(result.manifest.sources.map((source) => source.documentId)).toEqual(["doc-outro"]);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_DUPLICATE_FILE", documentId: "doc-shared-a" }),
      expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_DUPLICATE_FILE", documentId: "doc-shared-b" }),
    ]);
  });

  it("exclui caminhos distintos que apontam para o mesmo alvo real por symlink interno", async () => {
    const root = await createRepositoryRoot();
    const realFilePath = path.join(root, "data/knowledge/emmanuel/alvo.md");
    const symlinkPath = path.join(root, "data/knowledge/emmanuel/alvo-link.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/alvo.md");
    await symlink(realFilePath, symlinkPath);
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/outro.md");

    const direct = buildCandidate({
      documentId: "doc-direct",
      filePath: "data/knowledge/emmanuel/alvo.md",
      documentTitle: "Alvo direto",
      documentSortOrder: 1,
    });
    const linked = buildCandidate({
      documentId: "doc-link",
      filePath: "data/knowledge/emmanuel/alvo-link.md",
      documentTitle: "Alvo por link",
      documentSortOrder: 2,
    });
    const unrelated = buildCandidate({
      documentId: "doc-unrelated",
      filePath: "data/knowledge/emmanuel/outro.md",
      documentTitle: "Outro",
      documentSortOrder: 3,
    });

    const first = await createKnowledgeManifestFromCandidates([linked, unrelated, direct], { repositoryRoot: root });
    const second = await createKnowledgeManifestFromCandidates([unrelated, direct, linked], { repositoryRoot: root });

    expect(first.manifest.sources.map((source) => source.documentId)).toEqual(["doc-unrelated"]);
    expect(first.issues).toEqual([
      expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_DUPLICATE_FILE", documentId: "doc-direct" }),
      expect.objectContaining({ code: "KNOWLEDGE_MANIFEST_DUPLICATE_FILE", documentId: "doc-link" }),
    ]);
    expect(second.manifest).toEqual(first.manifest);
    expect(second.issues).toEqual(first.issues);
    expect(first.manifest.fingerprint).toBe(second.manifest.fingerprint);
    expect(JSON.stringify(first.manifest)).not.toContain(root);
    expect(JSON.stringify(first.issues)).not.toContain(root);
  });

  it("mantém symlink interno único elegível sem expor alvo real", async () => {
    const root = await createRepositoryRoot();
    const realFilePath = path.join(root, "data/knowledge/emmanuel/alvo-unico.md");
    const symlinkPath = path.join(root, "data/knowledge/emmanuel/alvo-unico-link.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/alvo-unico.md");
    await symlink(realFilePath, symlinkPath);

    const result = await createKnowledgeManifestFromCandidates(
      [
        buildCandidate({
          documentId: "doc-link-unico",
          filePath: "data/knowledge/emmanuel/alvo-unico-link.md",
          documentTitle: "Alvo unico por link",
        }),
      ],
      { repositoryRoot: root },
    );

    expect(result.issues).toEqual([]);
    expect(result.manifest.sources).toEqual([
      expect.objectContaining({
        documentId: "doc-link-unico",
        filePath: "data/knowledge/emmanuel/alvo-unico-link.md",
      }),
    ]);
    expect(JSON.stringify(result.manifest)).not.toContain(root);
  });

  it("ordena e calcula fingerprint determinístico independente da ordem do repository", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/b.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/a.md");

    const a = buildCandidate({
      documentId: "doc-a",
      filePath: "data/knowledge/emmanuel/a.md",
      documentTitle: "A",
      documentSortOrder: 1,
    });
    const b = buildCandidate({
      documentId: "doc-b",
      filePath: "data/knowledge/emmanuel/b.md",
      documentTitle: "B",
      documentSortOrder: 2,
    });

    const first = await createKnowledgeManifestFromCandidates([b, a], { repositoryRoot: root });
    const second = await createKnowledgeManifestFromCandidates([a, b], { repositoryRoot: root });

    expect(first.manifest.sources.map((source) => source.documentId)).toEqual(["doc-a", "doc-b"]);
    expect(first.manifest.fingerprint).toBe(second.manifest.fingerprint);
  });

  it("altera fingerprint quando versão ou referência física relevante muda", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md");
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado-v2.md");

    const first = await createKnowledgeManifestFromCandidates([buildCandidate()], { repositoryRoot: root });
    const changedVersion = await createKnowledgeManifestFromCandidates(
      [buildCandidate({ documentVersion: 4 })],
      { repositoryRoot: root },
    );
    const changedPath = await createKnowledgeManifestFromCandidates(
      [buildCandidate({ filePath: "data/knowledge/emmanuel/aprovado-v2.md" })],
      { repositoryRoot: root },
    );

    expect(first.manifest.fingerprint).not.toBe(changedVersion.manifest.fingerprint);
    expect(first.manifest.fingerprint).not.toBe(changedPath.manifest.fingerprint);
  });

  it("distingue catálogo vazio e catálogo indisponível sem varrer filesystem", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/extra.md");

    const empty = await buildKnowledgeEditorialManifest({
      repository: { listManifestCandidates: async () => [] },
      filesystem: { repositoryRoot: root },
    });
    const unavailable = await buildKnowledgeEditorialManifest({
      repository: {
        listManifestCandidates: async () => {
          throw new Error("database offline");
        },
      },
      filesystem: { repositoryRoot: root },
    });

    expect(empty.status).toBe("empty");
    expect(empty.status !== "unavailable" ? empty.manifest.sources : []).toEqual([]);
    expect(unavailable).toEqual({
      status: "unavailable",
      reason: "catalog_unavailable",
      issues: [{ code: "KNOWLEDGE_MANIFEST_CATALOG_UNAVAILABLE" }],
    });
  });
});

describe("governed knowledge document loader", () => {
  it("carrega somente fontes do manifesto e preserva proveniência editorial sem caminho absoluto", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Manifesto"));
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/extra.md", markdownContent("Extra fora do manifesto"));
    const { manifest } = await createKnowledgeManifestFromCandidates([buildCandidate()], { repositoryRoot: root });

    const documents = await loadKnowledgeDocumentsFromManifest(manifest, { repositoryRoot: root });

    expect(documents).toHaveLength(1);
    expect(documents[0]).toEqual(
      expect.objectContaining({
        id: "doc-approved",
        title: "Documento aprovado",
        path: "data/knowledge/emmanuel/aprovado.md",
        editorial: expect.objectContaining({
          documentId: "doc-approved",
          bookId: "book-emmanuel",
          documentVersion: 3,
          manifestFingerprint: manifest.fingerprint,
        }),
      }),
    );
    expect(documents[0].content).toContain("Conteudo autoral curto");
    expect(documents[0]).not.toHaveProperty("absolutePath");
  });

  it("preserva metadados editoriais tipados em cópias seguras no chunk e no retriever", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/aprovado.md", markdownContent("Manifesto"));
    const { manifest } = await createKnowledgeManifestFromCandidates([buildCandidate()], { repositoryRoot: root });
    const [document] = await loadKnowledgeDocumentsFromManifest(manifest, { repositoryRoot: root });

    const [chunk] = splitDocumentIntoChunks(document);
    const [result] = searchChunks([chunk], "Manifesto", { minScore: 0 });

    expect(chunk.editorial).toEqual(document.editorial);
    expect(chunk.editorial).not.toBe(document.editorial);
    expect(result.editorial).toEqual(document.editorial);
    expect(result.editorial).not.toBe(chunk.editorial);
    expect(result.editorial).not.toHaveProperty("filePath");
  });

  it("falha de forma segura quando arquivo desaparece depois do manifesto", async () => {
    const root = await createRepositoryRoot();
    const filePath = "data/knowledge/emmanuel/aprovado.md";
    await writeKnowledgeFile(root, filePath);
    const { manifest } = await createKnowledgeManifestFromCandidates([buildCandidate()], { repositoryRoot: root });
    await unlink(path.join(root, filePath));

    await expect(loadKnowledgeDocumentsFromManifest(manifest, { repositoryRoot: root })).rejects.toMatchObject({
      code: "KNOWLEDGE_FILE_NOT_FOUND",
    });
  });

  it("mantém o loader legado com caminho absoluto interno real", async () => {
    const root = await createRepositoryRoot();
    await writeKnowledgeFile(root, "data/knowledge/emmanuel/legado.md");

    const documents = await loadKnowledgeDocuments({ knowledgeDir: path.join(root, "data/knowledge") });

    expect(documents).toHaveLength(1);
    expect(documents[0].absolutePath).toBe(path.join(root, "data/knowledge/emmanuel/legado.md"));
  });
});
