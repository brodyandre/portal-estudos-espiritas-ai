import { AppError } from "../../../lib/app-error";
import {
  getKnowledgeFileExists as getSharedKnowledgeFileExists,
  getKnowledgeRepositoryRoot,
  KnowledgeFileValidationError,
  normalizeKnowledgeFilePath as normalizeSharedKnowledgeFilePath,
  resolveKnowledgeFilePath as resolveSharedKnowledgeFilePath,
} from "../../../knowledge/filesystem";
import type { KnowledgeFilesystemValidation } from "./types";

const mapKnowledgeFileError = (error: unknown): never => {
  if (error instanceof KnowledgeFileValidationError) {
    throw new AppError({
      statusCode: error.code === "KNOWLEDGE_FILE_NOT_FOUND" ? 404 : 400,
      code: error.code,
      message: error.message,
    });
  }

  throw error;
};

export const normalizeKnowledgeFilePath = (filePath: string) => {
  try {
    return normalizeSharedKnowledgeFilePath(filePath);
  } catch (error) {
    return mapKnowledgeFileError(error);
  }
};

export const resolveKnowledgeFilePath = async (
  filePath: string,
): Promise<KnowledgeFilesystemValidation> => {
  try {
    const result = await resolveSharedKnowledgeFilePath(filePath);
    return {
      filePath: result.filePath,
      exists: true,
    };
  } catch (error) {
    return mapKnowledgeFileError(error);
  }
};

export const getKnowledgeFileExists = async (filePath: string) => {
  return getSharedKnowledgeFileExists(filePath);
};
export { getKnowledgeRepositoryRoot };
