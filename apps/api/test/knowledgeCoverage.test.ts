import { describe, expect, it } from "vitest";

import {
  buildKnowledgeCoverageReport,
  evaluateKnowledgeCoverage,
  type KnowledgeCoverageBookTarget,
} from "../src/knowledge/coverage";
import type {
  KnowledgeEditorialManifestResult,
  KnowledgeManifestDocumentType,
  KnowledgeManifestSource,
} from "../src/knowledge/manifest";

const target = (
  studyGroupId: string,
  book: {
    id: string;
    slug: string;
    title: string;
    status?: "active" | "archived";
  },
): KnowledgeCoverageBookTarget => ({
  studyGroupId,
  knowledgeBookId: book.id,
  book: {
    id: book.id,
    slug: book.slug,
    title: book.title,
    status: book.status ?? "active",
  },
});

const emmanuel = target("emmanuel", {
  id: "book-emmanuel",
  slug: "emmanuel",
  title: "Emmanuel",
});

const aCaminho = target("a-caminho-da-luz", {
  id: "book-a-caminho",
  slug: "a-caminho-da-luz",
  title: "A Caminho da Luz",
});

const source = (
  book: NonNullable<KnowledgeCoverageBookTarget["book"]>,
  overrides: Partial<KnowledgeManifestSource> = {},
): KnowledgeManifestSource => ({
  manifestSourceId: `${book.id}:1`,
  documentId: `doc-${book.slug}`,
  bookId: book.id,
  catalogKey: `${book.slug}-tema`,
  documentTitle: `Documento ${book.title}`,
  bookTitle: book.title,
  bookSlug: book.slug,
  documentVersion: 1,
  filePath: `data/knowledge/${book.slug}/tema.md`,
  type: "tema",
  description: "",
  summary: "",
  tags: [],
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  origin: "catalog",
  ...overrides,
});

const manifest = (
  sources: KnowledgeManifestSource[],
  options: {
    status?: "ready" | "empty";
    issues?: KnowledgeEditorialManifestResult["issues"];
  } = {},
): KnowledgeEditorialManifestResult => ({
  status: options.status ?? (sources.length > 0 ? "ready" : "empty"),
  manifest: {
    schemaVersion: 1,
    fingerprint: "test-fingerprint",
    sources,
  },
  issues: options.issues ?? [],
});

const reportFor = (
  targets: KnowledgeCoverageBookTarget[],
  sources: KnowledgeManifestSource[],
  options: {
    status?: "ready" | "empty";
    issues?: KnowledgeEditorialManifestResult["issues"];
  } = {},
) => evaluateKnowledgeCoverage(targets, manifest(sources, options));

describe("governed knowledge coverage audit", () => {
  it("reports ready when every active study group book has a pedagogical manifest source", () => {
    const report = reportFor([emmanuel, aCaminho], [
      source(emmanuel.book),
      source(aCaminho.book),
    ]);

    expect(report.status).toBe("ready");
    expect(report.targetBookCount).toBe(2);
    expect(report.coveredBookCount).toBe(2);
    expect(report.uncoveredBookCount).toBe(0);
  });

  it("reports incomplete when one active book has zero pedagogical sources", () => {
    const report = reportFor([emmanuel, aCaminho], [source(emmanuel.book)]);

    expect(report.status).toBe("incomplete");
    const aCaminhoReport = report.books.find((book) => book.bookSlug === "a-caminho-da-luz");
    expect(aCaminhoReport).toMatchObject({
      covered: false,
      reasons: ["NO_PEDAGOGICAL_MANIFEST_SOURCE"],
    });
  });

  it("does not count cataloged draft, needs_review or reviewed documents outside the manifest", () => {
    const report = reportFor([emmanuel], [], { status: "empty" });

    expect(report.status).toBe("incomplete");
    expect(report.books).toEqual([
      expect.objectContaining({
        bookSlug: "emmanuel",
        manifestSourceCount: 0,
        pedagogicalSourceCount: 0,
        covered: false,
        reasons: ["NO_PEDAGOGICAL_MANIFEST_SOURCE"],
      }),
    ]);
  });

  it("does not treat README-only manifest sources as pedagogical coverage", () => {
    const readmeSource = source(emmanuel.book, {
      manifestSourceId: "book-emmanuel:readme",
      type: "readme" satisfies KnowledgeManifestDocumentType,
    });

    const report = reportFor([emmanuel], [readmeSource]);

    expect(report.status).toBe("incomplete");
    expect(report.books[0]).toMatchObject({
      manifestSourceCount: 1,
      pedagogicalSourceCount: 0,
      covered: false,
      reasons: ["NO_PEDAGOGICAL_MANIFEST_SOURCE"],
    });
  });

  it("does not use shared manifest sources to cover another book", () => {
    const sharedBook = {
      id: "book-shared",
      slug: "shared",
      title: "Conteudos compartilhados",
      status: "active" as const,
    };

    const report = reportFor([aCaminho], [source(sharedBook)]);

    expect(report.status).toBe("incomplete");
    expect(report.books[0]).toMatchObject({
      bookSlug: "a-caminho-da-luz",
      manifestSourceCount: 0,
      pedagogicalSourceCount: 0,
      covered: false,
      reasons: ["NO_PEDAGOGICAL_MANIFEST_SOURCE"],
    });
  });

  it("deduplicates multiple active study groups pointing to the same active book", () => {
    const secondGroup = target("emmanuel-sabado", emmanuel.book);
    const report = reportFor([emmanuel, secondGroup], [source(emmanuel.book)]);

    expect(report.status).toBe("ready");
    expect(report.targetBookCount).toBe(1);
    expect(report.books[0].studyGroupIds).toEqual(["emmanuel", "emmanuel-sabado"]);
  });

  it("does not create a target when there are no active study group book targets", async () => {
    const report = await buildKnowledgeCoverageReport({
      repository: { listActiveStudyGroupBookTargets: async () => [] },
      loadManifest: async () => manifest([source(emmanuel.book)]),
    });

    expect(report.status).toBe("incomplete");
    expect(report.targetBookCount).toBe(0);
    expect(report.books).toEqual([]);
  });

  it("reports unavailable when an active study group has no linked knowledge book", () => {
    const report = reportFor([{
      studyGroupId: "sem-livro",
      knowledgeBookId: null,
      book: null,
    }], []);

    expect(report.status).toBe("unavailable");
    expect(report.books[0]).toMatchObject({
      bookId: null,
      covered: false,
      reasons: ["STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK"],
    });
  });

  it("reports unavailable when an active study group points to a missing knowledge book", () => {
    const report = reportFor([{
      studyGroupId: "livro-ausente",
      knowledgeBookId: "book-missing",
      book: null,
    }], []);

    expect(report.status).toBe("unavailable");
    expect(report.books[0]).toMatchObject({
      bookId: "book-missing",
      covered: false,
      reasons: ["STUDY_GROUP_KNOWLEDGE_BOOK_NOT_FOUND"],
    });
  });

  it("reports unavailable when an active study group points to an archived book", () => {
    const archived = target("arquivo", {
      id: "book-archived",
      slug: "arquivo",
      title: "Arquivo",
      status: "archived",
    });

    const report = reportFor([archived], []);

    expect(report.status).toBe("unavailable");
    expect(report.books[0]).toMatchObject({
      bookId: "book-archived",
      covered: false,
      reasons: ["STUDY_GROUP_KNOWLEDGE_BOOK_NOT_ACTIVE"],
    });
  });

  it("preserves fail-closed coverage when manifest issues remove the only candidate source", () => {
    const report = reportFor([aCaminho], [], {
      status: "empty",
      issues: [{
        code: "KNOWLEDGE_FILE_NOT_FOUND",
        documentId: "doc-a-caminho",
        filePath: "data/knowledge/a-caminho-da-luz/ausente.md",
      }],
    });

    expect(report.status).toBe("incomplete");
    expect(report.manifestIssues).toEqual([
      {
        code: "KNOWLEDGE_FILE_NOT_FOUND",
        documentId: "doc-a-caminho",
        filePath: "data/knowledge/a-caminho-da-luz/ausente.md",
      },
    ]);
    expect(report.books[0]).toMatchObject({
      bookSlug: "a-caminho-da-luz",
      covered: false,
      reasons: ["NO_PEDAGOGICAL_MANIFEST_SOURCE"],
    });
  });
});
