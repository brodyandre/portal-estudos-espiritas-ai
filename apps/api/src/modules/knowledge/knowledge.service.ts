import type {
  KnowledgeDocumentForRetrieval,
  RetrieveOptions,
  RetrievedChunk,
} from "../../rag/types";
import {
  getGovernedRetrieverContext,
  type GovernedRetrieverContext,
} from "../../rag/governedRetriever";
import {
  GovernedRetrieverError,
  isGovernedRetrievalOperationalError,
  toKnowledgeCorpusUnavailableError,
} from "../../rag/governedRetrievalErrors";

export type KnowledgeGroupId = "emmanuel" | "a_caminho_da_luz";

interface KnowledgeGroupConfig {
  id: KnowledgeGroupId;
  name: string;
  book: string;
  aliases: string[];
}

export interface KnowledgeFileSummary {
  id: string;
  title: string;
  filename: string;
  group: string;
  book: string;
  type: string;
  tags: string[];
  summary: string;
  teacherReviewRecommended: boolean;
  sensitiveTopics: string[];
}

export interface KnowledgeGroupSummary {
  id: KnowledgeGroupId;
  name: string;
  book: string;
  summary: string;
  fileCount: number;
  teacherReviewFileCount: number;
  tags: string[];
  types: string[];
}

export interface KnowledgeOverview {
  totalFiles: number;
  totalGroups: number;
  groups: KnowledgeGroupSummary[];
  sharedFiles: KnowledgeFileSummary[];
}

export interface KnowledgeGroupDetails {
  group: KnowledgeGroupSummary;
  featuredFiles: KnowledgeFileSummary[];
  guidance: string;
}

export interface KnowledgeSearchItem extends KnowledgeFileSummary {
  score: number;
  source: string;
}

export interface KnowledgeSearchResult {
  query: string;
  group: KnowledgeGroupSummary | null;
  items: KnowledgeSearchItem[];
  guidance: string;
}

const KNOWLEDGE_GROUPS: Record<KnowledgeGroupId, KnowledgeGroupConfig> = {
  emmanuel: {
    id: "emmanuel",
    name: "Emmanuel",
    book: "Emmanuel",
    aliases: ["emmanuel"],
  },
  a_caminho_da_luz: {
    id: "a_caminho_da_luz",
    name: "A Caminho da Luz",
    book: "A Caminho da Luz",
    aliases: ["a_caminho_da_luz", "a-caminho-da-luz"],
  },
};

const PUBLIC_SUMMARY_LIMIT = 180;
const SEARCH_SUMMARY_LIMIT = 220;
const TAG_LIMIT = 8;
const SHARED_FILES_LIMIT = 4;
const FEATURED_FILES_LIMIT = 6;
const SEARCH_RESULTS_LIMIT = 6;

type GetGovernedRetrieverContext = () => Promise<GovernedRetrieverContext>;

let getRetrieverContext: GetGovernedRetrieverContext = getGovernedRetrieverContext;

const normalizeText = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
};

const truncateText = (value: string, limit: number): string => {
  const compact = value.replace(/\s+/gu, " ").trim();

  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, Math.max(0, limit - 3)).trim()}...`;
};

const uniqueStrings = (values: string[]): string[] => {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const compareByTitle = <T extends { title: string }>(left: T, right: T): number => {
  return left.title.localeCompare(right.title);
};

const isSharedDocument = (document: KnowledgeDocumentForRetrieval): boolean => {
  const normalizedGroup = normalizeText(document.group);
  const normalizedBook = normalizeText(document.book);

  return normalizedGroup === "geral" || normalizedGroup === "compartilhado" || normalizedBook === "base compartilhada";
};

const isPublicDocument = (document: KnowledgeDocumentForRetrieval): boolean => {
  return document.type !== "readme";
};

const getDocumentSummary = (
  document: Pick<KnowledgeDocumentForRetrieval, "description" | "purpose" | "content">,
  limit = PUBLIC_SUMMARY_LIMIT,
): string => {
  const baseText = document.description || document.purpose || document.content;

  return truncateText(baseText, limit);
};

const getSearchSummary = (
  result: Pick<RetrievedChunk, "description" | "content">,
): string => {
  return truncateText(result.description || result.content, SEARCH_SUMMARY_LIMIT);
};

const toFileSummary = (document: KnowledgeDocumentForRetrieval): KnowledgeFileSummary => {
  return {
    id: document.id,
    title: document.title,
    filename: document.filename,
    group: document.group,
    book: document.book,
    type: document.type,
    tags: [...document.tags].slice(0, TAG_LIMIT),
    summary: getDocumentSummary(document),
    teacherReviewRecommended: document.teacherReviewRecommended,
    sensitiveTopics: [...document.sensitiveTopics],
  };
};

const toSearchItem = (result: RetrievedChunk): KnowledgeSearchItem => {
  return {
    id: result.documentId,
    title: result.title,
    filename: result.filename,
    group: result.group,
    book: result.book,
    type: result.type,
    tags: [...result.tags].slice(0, TAG_LIMIT),
    summary: getSearchSummary(result),
    teacherReviewRecommended: result.teacherReviewRecommended,
    sensitiveTopics: [...result.sensitiveTopics],
    score: result.score,
    source: result.sourceLabel,
  };
};

const dedupeSearchItems = (items: KnowledgeSearchItem[]): KnowledgeSearchItem[] => {
  const itemsByDocumentId = new Map<string, KnowledgeSearchItem>();

  for (const item of items) {
    const currentItem = itemsByDocumentId.get(item.id);

    if (!currentItem || item.score > currentItem.score) {
      itemsByDocumentId.set(item.id, item);
    }
  }

  return [...itemsByDocumentId.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.title.localeCompare(right.title);
  });
};

const createGroupSummary = (
  config: KnowledgeGroupConfig,
  documents: readonly KnowledgeDocumentForRetrieval[],
): KnowledgeGroupSummary => {
  const tags = uniqueStrings(documents.flatMap((document) => document.tags)).slice(0, TAG_LIMIT);
  const types = uniqueStrings(documents.map((document) => document.type)).sort();
  const teacherReviewFileCount = documents.filter(
    (document) => document.teacherReviewRecommended,
  ).length;

  return {
    id: config.id,
    name: config.name,
    book: config.book,
    summary: `Base autoral curta com ${documents.length} arquivos de apoio para o grupo ${config.name}.`,
    fileCount: documents.length,
    teacherReviewFileCount,
    tags,
    types,
  };
};

const resolveKnowledgeGroupConfig = (
  rawGroup: string,
): KnowledgeGroupConfig | null => {
  const normalizedGroup = normalizeText(rawGroup).replace(/\s+/gu, "_");

  return (
    Object.values(KNOWLEDGE_GROUPS).find((group) =>
      group.aliases.some((alias) => normalizeText(alias).replace(/\s+/gu, "_") === normalizedGroup),
    ) ?? null
  );
};

const documentBelongsToGroup = (
  document: KnowledgeDocumentForRetrieval,
  group: KnowledgeGroupConfig,
): boolean => {
  return normalizeText(document.group) === normalizeText(group.name) || normalizeText(document.book) === normalizeText(group.book);
};

const translateKnowledgeCorpusError = (error: unknown): never => {
  if (isGovernedRetrievalOperationalError(error)) {
    throw toKnowledgeCorpusUnavailableError();
  }

  throw error;
};

const getPublicGroupDocuments = (
  documents: readonly KnowledgeDocumentForRetrieval[],
  group: KnowledgeGroupConfig,
): KnowledgeDocumentForRetrieval[] => {
  return documents
    .filter((document) => isPublicDocument(document) && documentBelongsToGroup(document, group))
    .sort(compareByTitle);
};

const getSharedPublicDocuments = (documents: readonly KnowledgeDocumentForRetrieval[]): KnowledgeDocumentForRetrieval[] => {
  return documents
    .filter((document) => isPublicDocument(document) && isSharedDocument(document))
    .sort(compareByTitle);
};

const getKnowledgeGroupSummary = (
  groupId: KnowledgeGroupId,
  documents: readonly KnowledgeDocumentForRetrieval[],
): KnowledgeGroupSummary => {
  const group = KNOWLEDGE_GROUPS[groupId];

  return createGroupSummary(group, getPublicGroupDocuments(documents, group));
};

export const parseKnowledgeGroup = (
  rawGroup: string,
): KnowledgeGroupConfig | null => {
  return resolveKnowledgeGroupConfig(rawGroup);
};

export const listKnowledgeOverview = async (): Promise<KnowledgeOverview> => {
  try {
    const { documents } = await getRetrieverContext();
    const publicDocuments = documents.filter(isPublicDocument);
    const groups = Object.values(KNOWLEDGE_GROUPS).map((group) => getKnowledgeGroupSummary(group.id, documents));
    const sharedFiles = getSharedPublicDocuments(documents)
      .map(toFileSummary)
      .slice(0, SHARED_FILES_LIMIT);

    return {
      totalFiles: publicDocuments.length,
      totalGroups: groups.length,
      groups,
      sharedFiles,
    };
  } catch (error) {
    return translateKnowledgeCorpusError(error);
  }
};

export const listKnowledgeGroups = async (): Promise<KnowledgeGroupSummary[]> => {
  try {
    const { documents } = await getRetrieverContext();

    return Object.values(KNOWLEDGE_GROUPS).map((group) => getKnowledgeGroupSummary(group.id, documents));
  } catch (error) {
    return translateKnowledgeCorpusError(error);
  }
};

export const getKnowledgeGroupDetails = async (
  rawGroup: string,
): Promise<KnowledgeGroupDetails | null> => {
  const group = resolveKnowledgeGroupConfig(rawGroup);

  if (!group) {
    return null;
  }

  try {
    const { documents } = await getRetrieverContext();
    const groupDocuments = getPublicGroupDocuments(documents, group);

    return {
      group: createGroupSummary(group, groupDocuments),
      featuredFiles: groupDocuments.map(toFileSummary).slice(0, FEATURED_FILES_LIMIT),
      guidance:
        "Use os materiais como apoio ao estudo. Em temas sensiveis, vale revisar a leitura com o professor.",
    };
  } catch (error) {
    return translateKnowledgeCorpusError(error);
  }
};

export const listKnowledgeFilesByGroup = async (
  rawGroup: string,
): Promise<KnowledgeFileSummary[] | null> => {
  const group = resolveKnowledgeGroupConfig(rawGroup);

  if (!group) {
    return null;
  }

  try {
    const { documents } = await getRetrieverContext();

    return getPublicGroupDocuments(documents, group).map(toFileSummary);
  } catch (error) {
    return translateKnowledgeCorpusError(error);
  }
};

export const searchKnowledge = async (
  query: string,
  rawGroup?: string,
): Promise<KnowledgeSearchResult> => {
  const trimmedQuery = query.trim();
  const group = rawGroup ? resolveKnowledgeGroupConfig(rawGroup) : null;
  try {
    const { documents, retriever } = await getRetrieverContext();
    const searchOptions: RetrieveOptions = {
      limit: SEARCH_RESULTS_LIMIT + 2,
      minScore: 0.55,
    };

    if (group) {
      searchOptions.group = group.name;
      searchOptions.book = group.book;
    }

    let retrievedChunks: RetrievedChunk[];
    try {
      retrievedChunks = await retriever.search(trimmedQuery, searchOptions);
    } catch (error) {
      if (isGovernedRetrievalOperationalError(error)) {
        throw error;
      }

      throw new GovernedRetrieverError(
        "GOVERNED_RETRIEVER_BUILD_FAILED",
        "Falha ao buscar no retriever do corpus governado.",
      );
    }

    const items = retrievedChunks
      .filter((result) => result.type !== "readme")
      .map(toSearchItem);
    const dedupedItems = dedupeSearchItems(items)
      .slice(0, SEARCH_RESULTS_LIMIT);

    return {
      query: trimmedQuery,
      group: group ? getKnowledgeGroupSummary(group.id, documents) : null,
      items: dedupedItems,
      guidance:
        dedupedItems.length === 0
          ? "Ainda nao encontrei material suficiente para esta busca. Vale levar a duvida ao professor."
          : dedupedItems.some((item) => item.teacherReviewRecommended)
            ? "Alguns resultados pedem revisao do professor antes de virarem conclusao do grupo."
            : "Resultados demonstrativos carregados com sucesso."
    };
  } catch (error) {
    return translateKnowledgeCorpusError(error);
  }
};

export const setKnowledgeRetrieverContextForTesting = (provider: GetGovernedRetrieverContext) => {
  getRetrieverContext = provider;
};

export const resetKnowledgeRetrieverContextForTesting = () => {
  getRetrieverContext = getGovernedRetrieverContext;
};
