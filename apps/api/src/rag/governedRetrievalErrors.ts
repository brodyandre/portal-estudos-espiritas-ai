import { GovernedCorpusError } from "../knowledge/governedCorpus";
import { AppError } from "../lib/app-error";

export const KNOWLEDGE_CORPUS_UNAVAILABLE_CODE = "KNOWLEDGE_CORPUS_UNAVAILABLE";

export class GovernedRetrieverError extends Error {
  constructor(
    public readonly code: "GOVERNED_RETRIEVER_BUILD_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "GovernedRetrieverError";
  }
}

export const isKnowledgeFileError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("KNOWLEDGE_FILE_"),
  );

export const isGovernedRetrievalOperationalError = (error: unknown) =>
  error instanceof GovernedCorpusError ||
  error instanceof GovernedRetrieverError ||
  (error instanceof AppError && error.code === KNOWLEDGE_CORPUS_UNAVAILABLE_CODE) ||
  isKnowledgeFileError(error);

export const toKnowledgeCorpusUnavailableError = () =>
  new AppError({
    statusCode: 503,
    code: KNOWLEDGE_CORPUS_UNAVAILABLE_CODE,
    message: "Base de conhecimento temporariamente indisponivel.",
  });
