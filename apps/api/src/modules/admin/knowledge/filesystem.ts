import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import path from "node:path";

import { AppError } from "../../../lib/app-error";
import type { KnowledgeFilesystemValidation } from "./types";

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../../../..");
const KNOWLEDGE_ROOT_RELATIVE = "data/knowledge";
const KNOWLEDGE_ROOT_ABSOLUTE = path.join(REPOSITORY_ROOT, KNOWLEDGE_ROOT_RELATIVE);

const toPosixPath = (value: string) => value.replace(/\\/gu, "/");

const buildInvalidPathError = () =>
  new AppError({
    statusCode: 400,
    code: "KNOWLEDGE_FILE_PATH_INVALID",
    message: "Caminho do arquivo de conhecimento inválido.",
  });

const buildInvalidTypeError = () =>
  new AppError({
    statusCode: 400,
    code: "KNOWLEDGE_FILE_TYPE_NOT_ALLOWED",
    message: "Apenas arquivos Markdown podem ser cadastrados.",
  });

export const normalizeKnowledgeFilePath = (filePath: string) => {
  if (typeof filePath !== "string") {
    throw buildInvalidPathError();
  }

  const normalized = toPosixPath(filePath.trim());

  if (!normalized || normalized.startsWith("/") || path.isAbsolute(normalized)) {
    throw buildInvalidPathError();
  }

  if (!normalized.startsWith(`${KNOWLEDGE_ROOT_RELATIVE}/`)) {
    throw buildInvalidPathError();
  }

  if (!normalized.endsWith(".md")) {
    throw buildInvalidTypeError();
  }

  const parts = normalized.split("/");
  if (parts.includes("..") || parts.includes(".") || parts.some((part) => part.length === 0)) {
    throw buildInvalidPathError();
  }

  return normalized;
};

const isInsideKnowledgeRoot = (absolutePath: string, absoluteRoot: string) => {
  const relativePath = path.relative(absoluteRoot, absolutePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

export const resolveKnowledgeFilePath = async (
  filePath: string,
): Promise<KnowledgeFilesystemValidation> => {
  const normalized = normalizeKnowledgeFilePath(filePath);
  const absoluteCandidate = path.resolve(REPOSITORY_ROOT, normalized);
  const realKnowledgeRoot = await realpath(KNOWLEDGE_ROOT_ABSOLUTE);

  if (!isInsideKnowledgeRoot(absoluteCandidate, realKnowledgeRoot)) {
    throw buildInvalidPathError();
  }

  try {
    await access(absoluteCandidate, constants.R_OK);
  } catch (_error) {
    throw new AppError({
      statusCode: 404,
      code: "KNOWLEDGE_FILE_NOT_FOUND",
      message: "Arquivo Markdown de conhecimento não encontrado.",
    });
  }

  const realFilePath = await realpath(absoluteCandidate);

  if (!isInsideKnowledgeRoot(realFilePath, realKnowledgeRoot)) {
    throw buildInvalidPathError();
  }

  return {
    filePath: normalized,
    exists: true,
  };
};

export const getKnowledgeFileExists = async (filePath: string) => {
  const normalized = normalizeKnowledgeFilePath(filePath);
  const absoluteCandidate = path.resolve(REPOSITORY_ROOT, normalized);

  try {
    const realKnowledgeRoot = await realpath(KNOWLEDGE_ROOT_ABSOLUTE);
    const realFilePath = await realpath(absoluteCandidate);
    return isInsideKnowledgeRoot(realFilePath, realKnowledgeRoot);
  } catch (_error) {
    return false;
  }
};

export const getKnowledgeRepositoryRoot = () => REPOSITORY_ROOT;
