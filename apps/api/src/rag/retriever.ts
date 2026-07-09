import { loadKnowledgeDocuments } from "./documentLoader";
import { splitDocumentsIntoChunks } from "./textSplitter";
import type {
  DocumentLoadOptions,
  KeywordRetriever,
  KeywordRetrieverIndex,
  KnowledgeChunk,
  KnowledgeDocument,
  RetrieveOptions,
  RetrievedChunk,
  TextSplitterOptions,
} from "./types";

const STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "para",
  "por",
  "com",
  "uma",
  "um",
  "que",
  "se",
  "ao",
  "aos",
]);

const normalizeSearchText = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
};

const tokenize = (value: string): string[] => {
  return normalizeSearchText(value)
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !STOPWORDS.has(term));
};

const countOccurrences = (haystack: string, needle: string): number => {
  if (!needle) {
    return 0;
  }

  const matches = haystack.match(new RegExp(`\\b${needle}\\b`, "gu"));

  return matches ? matches.length : 0;
};

const scoreChunk = (chunk: KnowledgeChunk, query: string): number => {
  const normalizedQuery = normalizeSearchText(query);
  const terms = tokenize(query);

  if (!normalizedQuery || terms.length === 0) {
    return 0;
  }

  const title = normalizeSearchText(chunk.title);
  const content = normalizeSearchText(chunk.content);
  const group = normalizeSearchText(chunk.group);
  let score = 0;
  let matchedTerms = 0;

  if (normalizedQuery.length >= 4 && title.includes(normalizedQuery)) {
    score += 6;
  }

  if (normalizedQuery.length >= 4 && content.includes(normalizedQuery)) {
    score += 4;
  }

  for (const term of terms) {
    const titleHits = countOccurrences(title, term);
    const contentHits = countOccurrences(content, term);
    const groupHits = countOccurrences(group, term);

    if (titleHits + contentHits + groupHits > 0) {
      matchedTerms += 1;
    }

    score += groupHits * 2.5;
    score += titleHits * 2;
    score += Math.min(contentHits, 4) * 1.2;

    if (chunk.keywordHints.includes(term)) {
      score += 0.5;
    }
  }

  score += (matchedTerms / terms.length) * 2;
  score += Math.max(0, 0.6 - chunk.content.length / 900);

  return Number(score.toFixed(3));
};

export const searchChunks = (
  chunks: KnowledgeChunk[],
  query: string,
  options: RetrieveOptions = {},
): RetrievedChunk[] => {
  const limit = options.limit ?? 5;
  const minScore = options.minScore ?? 0.75;

  return chunks
    .map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      source: chunk.source,
      title: chunk.title,
      content: chunk.content,
      score: scoreChunk(chunk, query),
      group: chunk.group,
      chunkIndex: chunk.chunkIndex,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      vectorRef: chunk.vectorRef,
    }))
    .filter((chunk) => chunk.score >= minScore)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.title !== right.title) {
        return left.title.localeCompare(right.title);
      }

      return left.chunkIndex - right.chunkIndex;
    })
    .slice(0, limit);
};

export const buildKeywordRetrieverIndex = (
  documents: KnowledgeDocument[],
  splitterOptions: TextSplitterOptions = {},
): KeywordRetrieverIndex => {
  return {
    backend: "keyword",
    builtAt: new Date().toISOString(),
    documents,
    chunks: splitDocumentsIntoChunks(documents, splitterOptions),
  };
};

export const createKeywordRetriever = async (options: {
  documents?: KnowledgeDocument[];
  loadOptions?: DocumentLoadOptions;
  splitterOptions?: TextSplitterOptions;
} = {}): Promise<KeywordRetriever> => {
  const documents =
    options.documents ?? (await loadKnowledgeDocuments(options.loadOptions));
  const index = buildKeywordRetrieverIndex(documents, options.splitterOptions);

  return {
    backend: "keyword",
    getIndex() {
      return index;
    },
    async search(query: string, searchOptions?: RetrieveOptions) {
      return searchChunks(index.chunks, query, searchOptions);
    },
  };
};
