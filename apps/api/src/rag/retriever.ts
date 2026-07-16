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

const SIMPLE_QUERY_ALIASES: Record<string, string[]> = {
  prece: ["acolhimento", "encontro", "serenidade"],
  constancia: ["regularidade", "perseveranca"],
  capela: ["civilizacoes", "historica"],
  evangelho: ["jesus", "moral"],
  mediunidade: ["doutrinarias", "espiritual"],
};

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

const uniqueTerms = (terms: string[]): string[] => {
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
};

const expandQueryTerms = (terms: string[]): string[] => {
  return uniqueTerms(
    terms.flatMap((term) => [term, ...(SIMPLE_QUERY_ALIASES[term] ?? [])]),
  );
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
};

const countOccurrences = (haystack: string, needle: string): number => {
  if (!needle) {
    return 0;
  }

  const matches = haystack.match(new RegExp(`\\b${escapeRegExp(needle)}\\b`, "gu"));

  return matches ? matches.length : 0;
};

const buildChunkTokenSet = (chunk: KnowledgeChunk): Set<string> => {
  return new Set(
    tokenize(
      [
        chunk.title,
        chunk.group,
        chunk.book,
        chunk.description,
        chunk.tags.join(" "),
        chunk.sensitiveTopics.join(" "),
        chunk.content,
      ].join(" "),
    ),
  );
};

const computeTokenOverlap = (queryTerms: string[], candidateTerms: Set<string>): number => {
  if (queryTerms.length === 0 || candidateTerms.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const term of queryTerms) {
    if (candidateTerms.has(term)) {
      matches += 1;
      continue;
    }

    if ([...candidateTerms].some((candidate) => candidate.startsWith(term) || term.startsWith(candidate))) {
      matches += 0.5;
    }
  }

  return matches / queryTerms.length;
};

const isSharedChunk = (chunk: KnowledgeChunk): boolean => {
  const normalizedGroup = normalizeSearchText(chunk.group);
  const normalizedBook = normalizeSearchText(chunk.book);

  return normalizedGroup === "geral" || normalizedGroup === "compartilhado" || normalizedBook === "base compartilhada";
};

const matchesFilterValue = (value: string, expected?: string): boolean => {
  if (!expected) {
    return true;
  }

  return normalizeSearchText(value) === normalizeSearchText(expected);
};

const matchesChunkFilters = (chunk: KnowledgeChunk, options: RetrieveOptions): boolean => {
  const matchesGroup = !options.group || matchesFilterValue(chunk.group, options.group) || isSharedChunk(chunk);
  const matchesBook = !options.book || matchesFilterValue(chunk.book, options.book) || isSharedChunk(chunk);

  return matchesGroup && matchesBook;
};

const scoreChunk = (chunk: KnowledgeChunk, query: string): number => {
  const normalizedQuery = normalizeSearchText(query);
  const baseTerms = tokenize(query);
  const terms = expandQueryTerms(baseTerms);

  if (!normalizedQuery || terms.length === 0) {
    return 0;
  }

  const title = normalizeSearchText(chunk.title);
  const content = normalizeSearchText(chunk.content);
  const group = normalizeSearchText(chunk.group);
  const book = normalizeSearchText(chunk.book);
  const description = normalizeSearchText(chunk.description);
  const tags = normalizeSearchText(chunk.tags.join(" "));
  const sensitiveTopics = normalizeSearchText(chunk.sensitiveTopics.join(" "));
  const sourceLabel = normalizeSearchText(chunk.sourceLabel);
  const tokenSet = buildChunkTokenSet(chunk);
  let score = 0;
  let matchedTerms = 0;

  if (normalizedQuery.length >= 4 && title.includes(normalizedQuery)) {
    score += 6;
  }

  if (normalizedQuery.length >= 4 && content.includes(normalizedQuery)) {
    score += 4;
  }

  if (normalizedQuery.length >= 4 && tags.includes(normalizedQuery)) {
    score += 3.2;
  }

  if (normalizedQuery.length >= 4 && description.includes(normalizedQuery)) {
    score += 2.4;
  }

  for (const term of terms) {
    const titleHits = countOccurrences(title, term);
    const contentHits = countOccurrences(content, term);
    const groupHits = countOccurrences(group, term);
    const bookHits = countOccurrences(book, term);
    const tagHits = countOccurrences(tags, term);
    const descriptionHits = countOccurrences(description, term);
    const sourceLabelHits = countOccurrences(sourceLabel, term);
    const sensitiveTopicHits = countOccurrences(sensitiveTopics, term);

    if (
      titleHits +
        contentHits +
        groupHits +
        bookHits +
        tagHits +
        descriptionHits +
        sourceLabelHits +
        sensitiveTopicHits >
      0
    ) {
      matchedTerms += 1;
    }

    score += groupHits * 2.5;
    score += bookHits * 2.2;
    score += titleHits * 2;
    score += Math.min(contentHits, 4) * 1.2;
    score += tagHits * 1.9;
    score += descriptionHits * 1.2;
    score += sourceLabelHits * 0.8;
    score += sensitiveTopicHits * 1.4;

    if (chunk.keywordHints.includes(term)) {
      score += 0.5;
    }
  }

  const coverage = matchedTerms / terms.length;
  const similarity = computeTokenOverlap(baseTerms.length > 0 ? baseTerms : terms, tokenSet);

  score += coverage * 2;
  score += similarity * 2.8;
  score += Math.max(0, 0.6 - chunk.content.length / 900);
  score += chunk.type === "faq" || chunk.type === "tema" || chunk.type === "capitulo" ? 0.3 : 0;
  score -= chunk.type === "readme" ? 0.3 : 0;

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
    .filter((chunk) => matchesChunkFilters(chunk, options))
    .map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      title: chunk.title,
      group: chunk.group,
      book: chunk.book,
      source: chunk.source,
      sourceLabel: chunk.sourceLabel,
      filename: chunk.filename,
      path: chunk.path,
      type: chunk.type,
      tags: chunk.tags,
      description: chunk.description,
      sensitiveTopics: chunk.sensitiveTopics,
      teacherReviewRecommended: chunk.teacherReviewRecommended,
      content: chunk.content,
      score: scoreChunk(chunk, query),
      chunkIndex: chunk.chunkIndex,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      vectorRef: chunk.vectorRef,
      ...(chunk.editorial ? { editorial: { ...chunk.editorial } } : {}),
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
