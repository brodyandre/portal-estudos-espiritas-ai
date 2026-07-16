import {
  governedCorpusService,
  type GovernedCorpusDocument,
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
  readonly manifestFingerprint: string;
  readonly documents: readonly GovernedCorpusDocument[];
  readonly retriever: KeywordRetriever;
}

export interface GovernedRetrieverService {
  getContext(): Promise<GovernedRetrieverContext>;
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
  let latestRequestedFingerprint: string | undefined;
  const inFlightByFingerprint = new Map<string, Promise<GovernedRetrieverContext>>();

  const buildContext = async (
    snapshot: GovernedCorpusSnapshot,
  ): Promise<GovernedRetrieverContext> => {
    try {
      const retriever = await createRetriever(toRetrievalDocuments(snapshot.documents));

      return {
        manifestFingerprint: snapshot.manifestFingerprint,
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
      latestRequestedFingerprint = snapshot.manifestFingerprint;

      if (currentContext?.manifestFingerprint === snapshot.manifestFingerprint) {
        return currentContext;
      }

      const currentBuild = inFlightByFingerprint.get(snapshot.manifestFingerprint);
      if (currentBuild) {
        return currentBuild;
      }

      const promise = buildContext(snapshot)
        .then((context) => {
          if (latestRequestedFingerprint === snapshot.manifestFingerprint) {
            currentContext = context;
          }

          return context;
        })
        .finally(() => {
          if (inFlightByFingerprint.get(snapshot.manifestFingerprint) === promise) {
            inFlightByFingerprint.delete(snapshot.manifestFingerprint);
          }
        });

      inFlightByFingerprint.set(snapshot.manifestFingerprint, promise);

      return promise;
    },
  };
};

export const governedRetrieverService = createGovernedRetrieverService();

export const getGovernedRetrieverContext = () => governedRetrieverService.getContext();
