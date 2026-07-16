import { readFile } from "node:fs/promises";
import path from "node:path";

import { getKnowledgeFileExists, getKnowledgeRepositoryRoot, normalizeKnowledgeFilePath, resolveKnowledgeFilePath } from "./filesystem";
import { getKnowledgeRepositoryForCatalog } from "./service";
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  type CreateKnowledgeBookInput,
  type KnowledgeCatalogEntry,
  type KnowledgeCatalogResult,
  type KnowledgeDocumentType,
} from "./types";

const SHARED_BOOK: CreateKnowledgeBookInput = {
  slug: "shared",
  title: "Conteúdos compartilhados",
  description: "Coleção reservada para documentos compartilhados da base de conhecimento.",
  status: "active",
  sortOrder: 0,
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid_${key}`);
  }
  return value.trim();
};

const parseStringArray = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`invalid_${key}`);
  return [...new Set(value.map((item) => {
    if (typeof item !== "string" || !item.trim()) throw new Error(`invalid_${key}`);
    return item.trim().toLowerCase();
  }))];
};

const parseCatalogType = (value: string): KnowledgeDocumentType => {
  if (KNOWLEDGE_DOCUMENT_TYPES.includes(value as KnowledgeDocumentType)) {
    return value as KnowledgeDocumentType;
  }
  return "other";
};

const shouldUseSharedBook = (entry: { filePath: string; bookTitle: string; groupTitle: string }) => {
  const pathParts = entry.filePath.split("/");
  const directlyUnderKnowledgeRoot = pathParts.length === 3;
  const normalizedBook = entry.bookTitle.toLowerCase();
  const normalizedGroup = entry.groupTitle.toLowerCase();
  return directlyUnderKnowledgeRoot && (
    normalizedBook.includes("compartilhada") ||
    normalizedGroup.includes("compartilhado")
  );
};

const parseCatalogEntry = (value: unknown, sortOrder: number): KnowledgeCatalogEntry & { groupTitle: string } => {
  if (!isRecord(value)) throw new Error("invalid_entry");
  const filePath = normalizeKnowledgeFilePath(parseString(value, "path"));
  const bookTitle = parseString(value, "book");
  return {
    catalogKey: parseString(value, "id"),
    title: parseString(value, "title"),
    bookTitle,
    groupTitle: typeof value.group === "string" ? value.group.trim() : "",
    filePath,
    type: parseCatalogType(typeof value.type === "string" ? value.type : "other"),
    description: typeof value.description === "string" ? value.description.trim() : "",
    tags: parseStringArray(value, "tags"),
    sensitiveTopics: parseStringArray(value, "sensitiveTopics"),
    teacherReviewRecommended: value.teacherReviewRecommended === true,
    sortOrder,
  };
};

export const catalogKnowledgeBase = async (): Promise<KnowledgeCatalogResult> => {
  const repository = getKnowledgeRepositoryForCatalog();
  const indexPath = path.join(getKnowledgeRepositoryRoot(), "data/knowledge/index.json");
  const parsed = JSON.parse(await readFile(indexPath, "utf8")) as unknown;

  if (!isRecord(parsed) || !Array.isArray(parsed.files)) {
    throw new Error("Knowledge index must contain a files array.");
  }

  const result: KnowledgeCatalogResult = {
    createdBooks: 0,
    createdDocuments: 0,
    updatedDocuments: 0,
    unchangedDocuments: 0,
    missingRegisteredFiles: [],
    failedEntries: [],
  };

  await repository.upsertCatalogBook(SHARED_BOOK).then((bookResult) => {
    if (bookResult.created) result.createdBooks += 1;
  });

  for (const [index, rawEntry] of parsed.files.entries()) {
    try {
      const entry = parseCatalogEntry(rawEntry, index);
      await resolveKnowledgeFilePath(entry.filePath);
      const bookInput = shouldUseSharedBook(entry)
        ? SHARED_BOOK
        : {
            slug: slugify(entry.bookTitle),
            title: entry.bookTitle,
            description: "",
            status: "active" as const,
            sortOrder: index,
          };
      const bookResult = await repository.upsertCatalogBook(bookInput);
      if (bookResult.created) result.createdBooks += 1;
      const documentResult = await repository.upsertCatalogDocument({
        bookId: bookResult.record.id,
        filePath: entry.filePath,
        catalogKey: entry.catalogKey,
        title: entry.title,
        description: entry.description,
        summary: "",
        type: entry.type,
        tags: entry.tags,
        sensitiveTopics: entry.sensitiveTopics,
        teacherReviewRecommended: entry.teacherReviewRecommended || entry.sensitiveTopics.length > 0,
        editorialNotes: "",
        sortOrder: entry.sortOrder,
      });
      if (documentResult.created) {
        result.createdDocuments += 1;
      } else if (documentResult.changed) {
        result.updatedDocuments += 1;
      } else {
        result.unchangedDocuments += 1;
      }
    } catch (error) {
      const record = isRecord(rawEntry) ? rawEntry : {};
      result.failedEntries.push({
        catalogKey: typeof record.id === "string" ? record.id : undefined,
        filePath: typeof record.path === "string" ? record.path : undefined,
        code: error instanceof Error ? error.message : "invalid_entry",
      });
    }
  }

  let page = 1;
  for (;;) {
    const documents = await repository.listDocuments({
      page,
      pageSize: 50,
      sortBy: "sortOrder",
      sortOrder: "asc",
    });
    for (const document of documents.records) {
      if (!await getKnowledgeFileExists(document.filePath)) {
        result.missingRegisteredFiles.push(document.filePath);
      }
    }
    if (page >= documents.totalPages) break;
    page += 1;
  }

  return result;
};
