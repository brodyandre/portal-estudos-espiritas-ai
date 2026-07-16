import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";

export const KNOWLEDGE_ROOT_RELATIVE = "data/knowledge";
export const SUPPORTED_KNOWLEDGE_FILE_EXTENSION = ".md";

export type KnowledgeFileValidationCode =
  | "KNOWLEDGE_FILE_PATH_INVALID"
  | "KNOWLEDGE_FILE_TYPE_NOT_ALLOWED"
  | "KNOWLEDGE_FILE_NOT_FOUND"
  | "KNOWLEDGE_FILE_NOT_READABLE"
  | "KNOWLEDGE_FILE_NOT_REGULAR";

export class KnowledgeFileValidationError extends Error {
  constructor(
    public readonly code: KnowledgeFileValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "KnowledgeFileValidationError";
  }
}

export interface KnowledgeFilesystemValidationOptions {
  repositoryRoot?: string;
  knowledgeRootRelative?: string;
}

export interface KnowledgeResolvedFile {
  filePath: string;
  absolutePath: string;
  realPath: string;
  exists: true;
}

const DEFAULT_REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

const toPosixPath = (value: string) => value.replace(/\\/gu, "/");

const buildRepositoryPaths = (options: KnowledgeFilesystemValidationOptions = {}) => {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT);
  const knowledgeRootRelative = options.knowledgeRootRelative ?? KNOWLEDGE_ROOT_RELATIVE;
  const knowledgeRootAbsolute = path.join(repositoryRoot, knowledgeRootRelative);

  return { repositoryRoot, knowledgeRootRelative, knowledgeRootAbsolute };
};

const buildInvalidPathError = () =>
  new KnowledgeFileValidationError(
    "KNOWLEDGE_FILE_PATH_INVALID",
    "Caminho do arquivo de conhecimento inválido.",
  );

const buildInvalidTypeError = () =>
  new KnowledgeFileValidationError(
    "KNOWLEDGE_FILE_TYPE_NOT_ALLOWED",
    "Apenas arquivos Markdown podem ser cadastrados.",
  );

const isInsideKnowledgeRoot = (absolutePath: string, absoluteRoot: string) => {
  const relativePath = path.relative(absoluteRoot, absolutePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

export const normalizeKnowledgeFilePath = (
  filePath: string,
  options: Pick<KnowledgeFilesystemValidationOptions, "knowledgeRootRelative"> = {},
) => {
  const knowledgeRootRelative = options.knowledgeRootRelative ?? KNOWLEDGE_ROOT_RELATIVE;

  if (typeof filePath !== "string") {
    throw buildInvalidPathError();
  }

  const normalized = toPosixPath(filePath.trim());

  if (
    !normalized ||
    normalized.startsWith("/") ||
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:\//u.test(normalized)
  ) {
    throw buildInvalidPathError();
  }

  if (!normalized.startsWith(`${knowledgeRootRelative}/`)) {
    throw buildInvalidPathError();
  }

  if (!normalized.toLowerCase().endsWith(SUPPORTED_KNOWLEDGE_FILE_EXTENSION)) {
    throw buildInvalidTypeError();
  }

  const parts = normalized.split("/");
  if (parts.includes("..") || parts.includes(".") || parts.some((part) => part.length === 0)) {
    throw buildInvalidPathError();
  }

  return normalized;
};

export const resolveKnowledgeFilePath = async (
  filePath: string,
  options: KnowledgeFilesystemValidationOptions = {},
): Promise<KnowledgeResolvedFile> => {
  const { repositoryRoot, knowledgeRootRelative, knowledgeRootAbsolute } = buildRepositoryPaths(options);
  const normalized = normalizeKnowledgeFilePath(filePath, { knowledgeRootRelative });
  const absoluteCandidate = path.resolve(repositoryRoot, normalized);
  const realKnowledgeRoot = await realpath(knowledgeRootAbsolute);

  if (!isInsideKnowledgeRoot(absoluteCandidate, realKnowledgeRoot)) {
    throw buildInvalidPathError();
  }

  let realFilePath: string;
  try {
    realFilePath = await realpath(absoluteCandidate);
  } catch (_error) {
    throw new KnowledgeFileValidationError(
      "KNOWLEDGE_FILE_NOT_FOUND",
      "Arquivo Markdown de conhecimento não encontrado.",
    );
  }

  if (!isInsideKnowledgeRoot(realFilePath, realKnowledgeRoot)) {
    throw buildInvalidPathError();
  }

  const fileStats = await stat(realFilePath);
  if (!fileStats.isFile()) {
    throw new KnowledgeFileValidationError(
      "KNOWLEDGE_FILE_NOT_REGULAR",
      "O caminho informado não aponta para um arquivo regular.",
    );
  }

  try {
    await access(realFilePath, constants.R_OK);
  } catch (_error) {
    throw new KnowledgeFileValidationError(
      "KNOWLEDGE_FILE_NOT_READABLE",
      "Arquivo Markdown de conhecimento não pode ser lido.",
    );
  }

  return {
    filePath: normalized,
    absolutePath: absoluteCandidate,
    realPath: realFilePath,
    exists: true,
  };
};

export const getKnowledgeFileExists = async (
  filePath: string,
  options: KnowledgeFilesystemValidationOptions = {},
) => {
  try {
    await resolveKnowledgeFilePath(filePath, options);
    return true;
  } catch (_error) {
    return false;
  }
};

export const getKnowledgeRepositoryRoot = () => DEFAULT_REPOSITORY_ROOT;
