import {
  formatGovernedCorpusCacheKey,
  governedCorpusService,
  type GovernedCorpusDocument,
  type GovernedCorpusCacheKey,
  type GovernedCorpusService,
  type GovernedCorpusSnapshot,
} from "../knowledge/governedCorpus";
import { createKeywordRetriever } from "./retriever";
import type { KeywordRetriever, KnowledgeDocumentForRetrieval } from "./types";
import {
  GovernedRetrieverError,
  isGovernedRetrievalOperationalError,
} from "./governedRetrievalErrors";

export interface GovernedRetrieverContext {
  readonly cacheKey: GovernedCorpusCacheKey;
  readonly manifestFingerprint: string;
  readonly corpusFingerprint: string;
  readonly documents: readonly GovernedCorpusDocument[];
  readonly retriever: KeywordRetriever;
}

export interface GovernedRetrieverService {
  getContext(): Promise<GovernedRetrieverContext>;
  resetForTesting(): void;
}

export interface GovernedRetrieverServiceOptions {
  corpusService?: GovernedCorpusService;
  createRetriever?: (documents: readonly KnowledgeDocumentForRetrieval[]) => Promise<KeywordRetriever>;
}

const defaultCreateRetriever = (documents: readonly KnowledgeDocumentForRetrieval[]) =>
  createKeywordRetriever({ documents });

const toRetrievalDocuments = (
  documents: readonly GovernedCorpusDocument[],
): readonly KnowledgeDocumentForRetrieval[] =>
  documents.map((document) => ({
    id: document.id,
    title: document.title,
    group: document.group,
    book: document.book,
    source: document.source,
    sourceLabel: document.sourceLabel,
    filename: document.filename,
    path: document.path,
    type: document.type,
    tags: document.tags,
    description: document.description,
    sensitiveTopics: document.sensitiveTopics,
    teacherReviewRecommended: document.teacherReviewRecommended,
    purpose: document.purpose,
    content: document.content,
    rawContent: document.rawContent,
    frontmatter: document.frontmatter,
    charCount: document.charCount,
    wordCount: document.wordCount,
    ...(document.editorial ? { editorial: document.editorial } : {}),
  }));

export const createGovernedRetrieverService = (
  options: GovernedRetrieverServiceOptions = {},
): GovernedRetrieverService => {
  const corpusService = options.corpusService ?? governedCorpusService;
  const createRetriever = options.createRetriever ?? defaultCreateRetriever;
  let currentContext: GovernedRetrieverContext | undefined;
  let latestRequestedCacheKey: string | undefined;
  const inFlightByCacheKey = new Map<string, Promise<GovernedRetrieverContext>>();

  const buildContext = async (
    snapshot: GovernedCorpusSnapshot,
  ): Promise<GovernedRetrieverContext> => {
    try {
      const retriever = await createRetriever(toRetrievalDocuments(snapshot.documents));

      return {
        cacheKey: snapshot.cacheKey,
        manifestFingerprint: snapshot.manifestFingerprint,
        corpusFingerprint: snapshot.corpusFingerprint,
        documents: snapshot.documents,
        retriever,
      };
    } catch (error) {
      if (isGovernedRetrievalOperationalError(error)) {
        throw error;
      }

      throw new GovernedRetrieverError(
        "GOVERNED_RETRIEVER_BUILD_FAILED",
        "Falha ao construir o retriever do corpus governado.",
      );
    }
  };

  return {
    async getContext() {
      const snapshot = await corpusService.getSnapshot();
      const snapshotCacheKey = formatGovernedCorpusCacheKey(snapshot.cacheKey);
      latestRequestedCacheKey = snapshotCacheKey;

      if (currentContext && formatGovernedCorpusCacheKey(currentContext.cacheKey) === snapshotCacheKey) {
        return currentContext;
      }

      const currentBuild = inFlightByCacheKey.get(snapshotCacheKey);
      if (currentBuild) {
        return currentBuild;
      }

      const promise = buildContext(snapshot)
        .then((context) => {
          if (latestRequestedCacheKey === snapshotCacheKey) {
            currentContext = context;
          }

          return context;
        })
        .finally(() => {
          if (inFlightByCacheKey.get(snapshotCacheKey) === promise) {
            inFlightByCacheKey.delete(snapshotCacheKey);
          }
        });

      inFlightByCacheKey.set(snapshotCacheKey, promise);

      return promise;
    },
    resetForTesting() {
      currentContext = undefined;
      latestRequestedCacheKey = undefined;
      inFlightByCacheKey.clear();
    },
  };
};

export const governedRetrieverService = createGovernedRetrieverService();

export const getGovernedRetrieverContext = () => governedRetrieverService.getContext();

export const resetGovernedRetrieverServiceForTesting = () => {
  governedRetrieverService.resetForTesting();
};
