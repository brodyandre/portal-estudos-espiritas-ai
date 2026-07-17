import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getKnowledgeRepositoryRoot, resolveKnowledgeFilePath } from "../knowledge/filesystem";
import type { KnowledgeEditorialManifest, KnowledgeManifestSource } from "../knowledge/manifest";
import type {
  DocumentLoadOptions,
  KnowledgeIndex,
  KnowledgeIndexEntry,
  DocumentValidationIssue,
  DocumentValidationResult,
  KnowledgeDocument,
  MarkdownFrontmatter,
} from "./types";

const KNOWLEDGE_DIR_SEGMENTS = ["data", "knowledge"] as const;
const REQUIRED_FRONTMATTER_FIELDS = ["title", "group", "purpose", "source"] as const;
const KNOWLEDGE_INDEX_FILE = "index.json";

export interface KnowledgeDocumentWithContentHash {
  readonly document: KnowledgeDocument;
  readonly contentHash: string;
}

export class KnowledgeDocumentInvalidError extends Error {
  readonly code = "KNOWLEDGE_DOCUMENT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "KnowledgeDocumentInvalidError";
  }
}

const hashContentBytes = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

const decodeKnowledgeContent = (content: Buffer): string =>
  content.toString("utf8");

const normalizeText = (value: string): string => {
  return value.replace(/\r\n/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();
};

const slugify = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
};

const removeWrappingQuotes = (value: string): string => {
  return value.replace(/^['"]|['"]$/gu, "").trim();
};

const normalizePathSlashes = (value: string): string => {
  return value.replace(/\\/gu, "/");
};

const normalizeCatalogPath = (value: string): string => {
  return normalizePathSlashes(value).replace(/^\.?\//u, "").replace(/^\/+/u, "");
};

const candidateKnowledgeDirectories = (): string[] => {
  const cwd = process.cwd();
  const fromCurrentFile = path.resolve(__dirname, "..", "..", "..", "..");

  return [cwd, fromCurrentFile]
    .map((baseDir) => path.resolve(baseDir, ...KNOWLEDGE_DIR_SEGMENTS))
    .filter((dir, index, all) => all.indexOf(dir) === index);
};

export const resolveKnowledgeDirectory = async (
  customDir?: string,
): Promise<string> => {
  if (customDir) {
    return path.resolve(customDir);
  }

  for (const dir of candidateKnowledgeDirectories()) {
    try {
      const stats = await fs.stat(dir);

      if (stats.isDirectory()) {
        return dir;
      }
    } catch (_error) {
      continue;
    }
  }

  throw new Error("Nao foi possivel localizar a pasta data/knowledge.");
};

const buildRelativeKnowledgePath = (
  knowledgeDir: string,
  filePath: string,
): string => {
  const relativePath = normalizeCatalogPath(path.relative(knowledgeDir, filePath));

  return normalizeCatalogPath(path.posix.join("data", "knowledge", relativePath));
};

const collectMarkdownFiles = async (directory: string): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectMarkdownFiles(fullPath);
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        return [fullPath];
      }

      return [];
    }),
  );

  return nestedFiles
    .flat()
    .sort((left, right) => left.localeCompare(right));
};

const parseFrontmatter = (
  rawContent: string,
  source: string,
): { frontmatter: MarkdownFrontmatter; body: string } => {
  if (!rawContent.startsWith("---\n")) {
    throw new KnowledgeDocumentInvalidError(`Arquivo ${source} sem frontmatter inicial.`);
  }

  const endMarkerIndex = rawContent.indexOf("\n---\n", 4);

  if (endMarkerIndex === -1) {
    throw new KnowledgeDocumentInvalidError(`Arquivo ${source} com frontmatter incompleto.`);
  }

  const frontmatterBlock = rawContent.slice(4, endMarkerIndex);
  const body = rawContent.slice(endMarkerIndex + 5);
  const parsedFrontmatter: Record<string, string> = {};

  for (const line of frontmatterBlock.split("\n")) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    parsedFrontmatter[key] = removeWrappingQuotes(rawValue);
  }

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!parsedFrontmatter[field] || parsedFrontmatter[field].trim().length === 0) {
      throw new KnowledgeDocumentInvalidError(`Arquivo ${source} sem o campo obrigatório ${field} no frontmatter.`);
    }
  }

  return {
    frontmatter: parsedFrontmatter as MarkdownFrontmatter,
    body,
  };
};

const extractTitleFromBody = (body: string): string | null => {
  const headingLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  return headingLine ? headingLine.slice(2).trim() : null;
};

const uniqueStringList = (values: string[]): string[] => {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const inferBook = (documentPath: string, group: string): string => {
  const normalizedPath = normalizeCatalogPath(documentPath);
  const normalizedGroup = slugify(group);

  if (normalizedPath.includes("a_caminho_da_luz/") || normalizedGroup === "a-caminho-da-luz") {
    return "A Caminho da Luz";
  }

  if (normalizedPath.includes("emmanuel/") || normalizedGroup === "emmanuel") {
    return "Emmanuel";
  }

  return "Base compartilhada";
};

const inferType = (documentPath: string): string => {
  const normalizedPath = normalizeCatalogPath(documentPath).toLowerCase();

  if (normalizedPath.endsWith("/readme.md") || normalizedPath === "data/knowledge/readme.md") {
    return "readme";
  }

  if (normalizedPath.includes("orientacoes")) {
    return "orientacoes";
  }

  if (normalizedPath.includes("demo")) {
    return "demo";
  }

  if (normalizedPath.includes("visao_geral")) {
    return "visao_geral";
  }

  if (normalizedPath.includes("capitulo")) {
    return "capitulo";
  }

  if (normalizedPath.includes("duvidas_frequentes")) {
    return "faq";
  }

  if (normalizedPath.includes("palavras_chave")) {
    return "palavras_chave";
  }

  return "tema";
};

const buildSourceLabel = (
  title: string,
  group: string,
  book: string,
): string => {
  const normalizedGroup = slugify(group);

  if (normalizedGroup === "compartilhado" || normalizedGroup === "geral") {
    return `${book} · ${title}`;
  }

  return `${group} · ${title}`;
};

const readKnowledgeIndex = async (knowledgeDir: string): Promise<KnowledgeIndex | null> => {
  const indexPath = path.join(knowledgeDir, KNOWLEDGE_INDEX_FILE);

  try {
    const rawIndex = await fs.readFile(indexPath, "utf8");
    const parsedIndex = JSON.parse(rawIndex) as Partial<KnowledgeIndex>;

    if (!parsedIndex || !Array.isArray(parsedIndex.files)) {
      throw new Error("Arquivo data/knowledge/index.json sem a lista files.");
    }

    return {
      ...parsedIndex,
      files: parsedIndex.files,
    } as KnowledgeIndex;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      throw new Error("Arquivo data/knowledge/index.json contem JSON invalido.");
    }

    throw error;
  }
};

const buildIndexEntryMap = (knowledgeIndex: KnowledgeIndex | null): Map<string, KnowledgeIndexEntry> => {
  const entries = knowledgeIndex?.files ?? [];

  return new Map(
    entries.map((entry) => [normalizeCatalogPath(entry.path), entry]),
  );
};

const buildDocument = (
  absolutePath: string,
  rawContent: string,
  knowledgeDir: string,
  options: {
    indexEntry?: KnowledgeIndexEntry;
    manifest?: {
      fingerprint: string;
      source: KnowledgeManifestSource;
    };
    exposeAbsolutePath?: boolean;
    sourcePathForErrors?: string;
  } = {},
): KnowledgeDocument => {
  const { indexEntry, manifest, exposeAbsolutePath = true, sourcePathForErrors = absolutePath } = options;
  const { frontmatter, body } = parseFrontmatter(rawContent, sourcePathForErrors);
  const normalizedBody = normalizeText(body);
  const titleFromBody = extractTitleFromBody(body);
  const relativePath = indexEntry?.path ?? buildRelativeKnowledgePath(knowledgeDir, absolutePath);
  const title = indexEntry?.title ?? (titleFromBody && titleFromBody.length > 0 ? titleFromBody : frontmatter.title);
  const filename = indexEntry?.filename ?? path.basename(absolutePath);
  const group = indexEntry?.group ?? frontmatter.group;
  const book = indexEntry?.book ?? inferBook(relativePath, group);
  const documentId = indexEntry?.id ?? slugify(`${filename}-${title}`);
  const wordCount = normalizedBody.split(/\s+/u).filter(Boolean).length;
  const tags = uniqueStringList(indexEntry?.tags ?? []);
  const sensitiveTopics = uniqueStringList(indexEntry?.sensitiveTopics ?? []);

  const document: KnowledgeDocument = {
    id: documentId,
    title,
    group,
    book,
    source: frontmatter.source,
    sourceLabel: buildSourceLabel(title, group, book),
    filename,
    path: relativePath,
    type: indexEntry?.type ?? inferType(relativePath),
    tags,
    description: indexEntry?.description ?? frontmatter.purpose,
    sensitiveTopics,
    teacherReviewRecommended:
      indexEntry?.teacherReviewRecommended ?? sensitiveTopics.length > 0,
    purpose: frontmatter.purpose,
    content: normalizedBody,
    rawContent,
    frontmatter,
    charCount: normalizedBody.length,
    wordCount,
    ...(manifest
      ? {
          editorial: {
            manifestFingerprint: manifest.fingerprint,
            manifestSourceId: manifest.source.manifestSourceId,
            documentId: manifest.source.documentId,
            bookId: manifest.source.bookId,
            catalogKey: manifest.source.catalogKey,
            documentTitle: manifest.source.documentTitle,
            bookTitle: manifest.source.bookTitle,
            bookSlug: manifest.source.bookSlug,
            documentVersion: manifest.source.documentVersion,
            origin: manifest.source.origin,
          },
        }
      : {}),
  };

  return exposeAbsolutePath ? { ...document, absolutePath } : document;
};

const buildIndexEntryFromManifestSource = (source: KnowledgeManifestSource): KnowledgeIndexEntry => ({
  id: source.documentId,
  title: source.documentTitle,
  group: source.bookTitle,
  book: source.bookTitle,
  filename: path.posix.basename(source.filePath),
  path: source.filePath,
  type: source.type,
  tags: source.tags,
  description: source.description || source.summary,
  sensitiveTopics: source.sensitiveTopics,
  teacherReviewRecommended: source.teacherReviewRecommended,
});

const buildDocumentWithContentHash = (
  absolutePath: string,
  rawBytes: Buffer,
  knowledgeDir: string,
  options: Parameters<typeof buildDocument>[3] = {},
): KnowledgeDocumentWithContentHash => ({
  document: buildDocument(
    absolutePath,
    decodeKnowledgeContent(rawBytes),
    knowledgeDir,
    options,
  ),
  contentHash: hashContentBytes(rawBytes),
});

export const loadKnowledgeDocuments = async (
  options: DocumentLoadOptions = {},
): Promise<KnowledgeDocument[]> => {
  const knowledgeDir = await resolveKnowledgeDirectory(options.knowledgeDir);
  const [knowledgeIndex, markdownFiles] = await Promise.all([
    readKnowledgeIndex(knowledgeDir),
    collectMarkdownFiles(knowledgeDir),
  ]);
  const indexEntriesByPath = buildIndexEntryMap(knowledgeIndex);

  const documents = await Promise.all(
    markdownFiles.map(async (filePath) => {
      const rawContent = decodeKnowledgeContent(await fs.readFile(filePath));
      const relativePath = buildRelativeKnowledgePath(knowledgeDir, filePath);

      return buildDocument(
        filePath,
        rawContent,
        knowledgeDir,
        { indexEntry: indexEntriesByPath.get(normalizeCatalogPath(relativePath)) },
      );
    }),
  );

  return documents.sort((left, right) => left.path.localeCompare(right.path));
};

export const loadKnowledgeDocumentsWithContentHashesFromManifest = async (
  manifest: KnowledgeEditorialManifest,
  options: { repositoryRoot?: string } = {},
): Promise<KnowledgeDocumentWithContentHash[]> => {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? getKnowledgeRepositoryRoot());
  const knowledgeDir = path.join(repositoryRoot, ...KNOWLEDGE_DIR_SEGMENTS);

  return Promise.all(
    manifest.sources.map(async (source) => {
      const resolvedFile = await resolveKnowledgeFilePath(source.filePath, { repositoryRoot });
      const rawBytes = await fs.readFile(resolvedFile.absolutePath);

      return buildDocumentWithContentHash(
        resolvedFile.absolutePath,
        rawBytes,
        knowledgeDir,
        {
          indexEntry: buildIndexEntryFromManifestSource(source),
          manifest: {
            fingerprint: manifest.fingerprint,
            source,
          },
          exposeAbsolutePath: false,
          sourcePathForErrors: source.filePath,
        },
      );
    }),
  );
};

export const loadKnowledgeDocumentsFromManifest = async (
  manifest: KnowledgeEditorialManifest,
  options: { repositoryRoot?: string } = {},
): Promise<KnowledgeDocument[]> => {
  const entries = await loadKnowledgeDocumentsWithContentHashesFromManifest(manifest, options);

  return entries.map((entry) => entry.document);
};

const validateProtectedContentHints = (
  document: KnowledgeDocument,
): DocumentValidationIssue[] => {
  const issues: DocumentValidationIssue[] = [];
  const normalizedSource = document.source.toLowerCase();

  if (
    !normalizedSource.includes("demonstrativo") &&
    !normalizedSource.includes("autoral") &&
    !normalizedSource.includes("autorizado")
  ) {
    issues.push({
      source: document.path,
      severity: "warning",
      message:
        "O campo source deveria indicar claramente que o material e demonstrativo, autoral ou autorizado.",
    });
  }

  if (document.charCount > 5000) {
    issues.push({
      source: document.path,
      severity: "warning",
      message:
        "O documento esta longo para uma base demonstrativa inicial. Revise para evitar material excessivo.",
    });
  }

  if (document.sensitiveTopics.length > 0 && !document.teacherReviewRecommended) {
    issues.push({
      source: document.path,
      severity: "warning",
      message:
        "O documento lista temas sensiveis, mas nao marcou revisao humana recomendada.",
    });
  }

  return issues;
};

export const validateKnowledgeDocuments = async (
  options: DocumentLoadOptions = {},
): Promise<DocumentValidationResult> => {
  const issues: DocumentValidationIssue[] = [];
  let knowledgeDir = "";

  let documents: KnowledgeDocument[] = [];
  let knowledgeIndex: KnowledgeIndex | null = null;
  let markdownFiles: string[] = [];

  try {
    knowledgeDir = await resolveKnowledgeDirectory(options.knowledgeDir);
    [knowledgeIndex, markdownFiles, documents] = await Promise.all([
      readKnowledgeIndex(knowledgeDir),
      collectMarkdownFiles(knowledgeDir),
      loadKnowledgeDocuments({ knowledgeDir }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar documentos.";

    return {
      documents: [],
      issues: [
        {
          source: "data/knowledge",
          severity: "error",
          message,
        },
      ],
      valid: false,
    };
  }

  if (!knowledgeIndex) {
    issues.push({
      source: "data/knowledge/index.json",
      severity: "warning",
      message: "O catalogo index.json nao foi encontrado. A busca usara apenas o frontmatter dos arquivos.",
    });
  } else {
    const indexedPaths = new Set(
      knowledgeIndex.files.map((entry) => normalizeCatalogPath(entry.path)),
    );
    const markdownPaths = new Set(
      markdownFiles.map((filePath) => normalizeCatalogPath(buildRelativeKnowledgePath(knowledgeDir, filePath))),
    );

    for (const indexedPath of indexedPaths) {
      if (!markdownPaths.has(indexedPath)) {
        issues.push({
          source: indexedPath,
          severity: "warning",
          message: "O catalogo index.json aponta para um arquivo Markdown que nao foi encontrado.",
        });
      }
    }

    for (const markdownPath of markdownPaths) {
      if (!indexedPaths.has(markdownPath)) {
        issues.push({
          source: markdownPath,
          severity: "warning",
          message: "O arquivo Markdown nao possui entrada correspondente em data/knowledge/index.json.",
        });
      }
    }
  }

  if (documents.length === 0) {
    issues.push({
      source: "data/knowledge",
      severity: "error",
      message: "Nenhum arquivo Markdown foi encontrado em data/knowledge.",
    });
  }

  const seenTitles = new Set<string>();

  for (const document of documents) {
    if (!document.title || document.title.trim().length < 3) {
      issues.push({
        source: document.path,
        severity: "error",
        message: "O documento precisa de um titulo claro.",
      });
    }

    if (!document.content || document.content.trim().length < 30) {
      issues.push({
        source: document.path,
        severity: "error",
        message: "O documento precisa ter conteudo suficiente para busca e resumo.",
      });
    }

    if (seenTitles.has(document.title.toLowerCase())) {
      issues.push({
        source: document.path,
        severity: "warning",
        message: "Existe outro documento com titulo igual. Isso pode atrapalhar a busca futura.",
      });
    }

    seenTitles.add(document.title.toLowerCase());
    issues.push(...validateProtectedContentHints(document));
  }

  return {
    documents,
    issues,
    valid: issues.every((issue) => issue.severity !== "error"),
  };
};
