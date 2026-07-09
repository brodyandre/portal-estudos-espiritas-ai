import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  DocumentLoadOptions,
  DocumentValidationIssue,
  DocumentValidationResult,
  KnowledgeDocument,
  MarkdownFrontmatter,
} from "./types";

const KNOWLEDGE_DIR_SEGMENTS = ["data", "knowledge"] as const;
const REQUIRED_FRONTMATTER_FIELDS = ["title", "group", "purpose", "source"] as const;

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

const parseFrontmatter = (
  rawContent: string,
  source: string,
): { frontmatter: MarkdownFrontmatter; body: string } => {
  if (!rawContent.startsWith("---\n")) {
    throw new Error(`Arquivo ${source} sem frontmatter inicial.`);
  }

  const endMarkerIndex = rawContent.indexOf("\n---\n", 4);

  if (endMarkerIndex === -1) {
    throw new Error(`Arquivo ${source} com frontmatter incompleto.`);
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
      throw new Error(`Arquivo ${source} sem o campo obrigatório ${field} no frontmatter.`);
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

const buildDocument = (source: string, rawContent: string): KnowledgeDocument => {
  const { frontmatter, body } = parseFrontmatter(rawContent, source);
  const normalizedBody = normalizeText(body);
  const titleFromBody = extractTitleFromBody(body);
  const title = titleFromBody && titleFromBody.length > 0 ? titleFromBody : frontmatter.title;
  const fileName = path.basename(source);
  const documentId = slugify(`${fileName}-${title}`);
  const wordCount = normalizedBody.split(/\s+/u).filter(Boolean).length;

  return {
    id: documentId,
    source,
    fileName,
    title,
    group: frontmatter.group,
    purpose: frontmatter.purpose,
    attribution: frontmatter.source,
    content: normalizedBody,
    rawContent,
    frontmatter,
    charCount: normalizedBody.length,
    wordCount,
  };
};

export const loadKnowledgeDocuments = async (
  options: DocumentLoadOptions = {},
): Promise<KnowledgeDocument[]> => {
  const knowledgeDir = await resolveKnowledgeDirectory(options.knowledgeDir);
  const entries = await fs.readdir(knowledgeDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => path.join(knowledgeDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const documents = await Promise.all(
    markdownFiles.map(async (filePath) => {
      const rawContent = await fs.readFile(filePath, "utf8");

      return buildDocument(filePath, rawContent);
    }),
  );

  return documents;
};

const validateProtectedContentHints = (
  document: KnowledgeDocument,
): DocumentValidationIssue[] => {
  const issues: DocumentValidationIssue[] = [];
  const normalizedSource = document.attribution.toLowerCase();

  if (
    !normalizedSource.includes("demonstrativo") &&
    !normalizedSource.includes("autoral") &&
    !normalizedSource.includes("autorizado")
  ) {
    issues.push({
      source: document.source,
      severity: "warning",
      message:
        "O campo source deveria indicar claramente que o material e demonstrativo, autoral ou autorizado.",
    });
  }

  if (document.charCount > 5000) {
    issues.push({
      source: document.source,
      severity: "warning",
      message:
        "O documento esta longo para uma base demonstrativa inicial. Revise para evitar material excessivo.",
    });
  }

  return issues;
};

export const validateKnowledgeDocuments = async (
  options: DocumentLoadOptions = {},
): Promise<DocumentValidationResult> => {
  const issues: DocumentValidationIssue[] = [];

  let documents: KnowledgeDocument[] = [];

  try {
    documents = await loadKnowledgeDocuments(options);
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
        source: document.source,
        severity: "error",
        message: "O documento precisa de um titulo claro.",
      });
    }

    if (!document.content || document.content.trim().length < 30) {
      issues.push({
        source: document.source,
        severity: "error",
        message: "O documento precisa ter conteudo suficiente para busca e resumo.",
      });
    }

    if (seenTitles.has(document.title.toLowerCase())) {
      issues.push({
        source: document.source,
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
