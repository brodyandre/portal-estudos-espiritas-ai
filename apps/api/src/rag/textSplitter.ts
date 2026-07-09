import type { KnowledgeChunk, KnowledgeDocument, TextSplitterOptions } from "./types";

const DEFAULT_MAX_CHUNK_LENGTH = 420;
const DEFAULT_CHUNK_OVERLAP = 60;

const normalizeText = (value: string): string => {
  return value.replace(/\r\n/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();
};

const tokenizeForHints = (value: string): string[] => {
  const uniqueTerms = new Set(
    normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((term) => term.length >= 4),
  );

  return [...uniqueTerms].slice(0, 24);
};

const buildChunkId = (document: KnowledgeDocument, chunkIndex: number): string => {
  return `${document.id}-chunk-${chunkIndex + 1}`;
};

const splitOversizedParagraph = (paragraph: string, maxChunkLength: number): string[] => {
  if (paragraph.length <= maxChunkLength) {
    return [paragraph];
  }

  const sentences = paragraph
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const pieces: string[] = [];

    for (let index = 0; index < paragraph.length; index += maxChunkLength) {
      pieces.push(paragraph.slice(index, index + maxChunkLength).trim());
    }

    return pieces.filter(Boolean);
  }

  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= maxChunkLength) {
      current = candidate;
      continue;
    }

    if (current) {
      pieces.push(current);
    }

    current = sentence;
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
};

const buildChunksFromParagraphs = (
  paragraphs: string[],
  options: Required<TextSplitterOptions>,
): string[] => {
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const candidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (candidate.length <= options.maxChunkLength) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    if (paragraph.length <= options.maxChunkLength) {
      currentChunk = paragraph;
      continue;
    }

    const splitParagraph = splitOversizedParagraph(paragraph, options.maxChunkLength);

    for (const piece of splitParagraph) {
      if (piece.length <= options.maxChunkLength) {
        chunks.push(piece);
      }
    }

    currentChunk = "";
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.map((chunk, index) => {
    if (index === 0 || options.chunkOverlap <= 0) {
      return chunk;
    }

    const previousChunk = chunks[index - 1];
    const overlapStart = Math.max(0, previousChunk.length - options.chunkOverlap);
    const overlapPrefix = previousChunk.slice(overlapStart).trim();

    if (!overlapPrefix) {
      return chunk;
    }

    const combined = `${overlapPrefix}\n\n${chunk}`;

    return combined.length <= options.maxChunkLength + options.chunkOverlap
      ? combined
      : chunk;
  });
};

export const splitDocumentIntoChunks = (
  document: KnowledgeDocument,
  options: TextSplitterOptions = {},
): KnowledgeChunk[] => {
  const settings = {
    maxChunkLength: options.maxChunkLength ?? DEFAULT_MAX_CHUNK_LENGTH,
    chunkOverlap: options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
  };
  const paragraphs = normalizeText(document.content)
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const rawChunks = buildChunksFromParagraphs(paragraphs, settings);
  let cursor = 0;

  return rawChunks.map((content, chunkIndex) => {
    const compactContent = normalizeText(content);
    const sourceContent = normalizeText(document.content);
    const startOffset = sourceContent.indexOf(compactContent.slice(0, Math.min(48, compactContent.length)), cursor);
    const resolvedStart = startOffset >= 0 ? startOffset : cursor;
    const endOffset = resolvedStart + compactContent.length;

    cursor = Math.max(cursor, endOffset - settings.chunkOverlap);

    return {
      id: buildChunkId(document, chunkIndex),
      documentId: document.id,
      source: document.source,
      title: document.title,
      group: document.group,
      content: compactContent,
      chunkIndex,
      startOffset: resolvedStart,
      endOffset,
      keywordHints: tokenizeForHints(`${document.title} ${compactContent}`),
      vectorRef: null,
    };
  });
};

export const splitDocumentsIntoChunks = (
  documents: KnowledgeDocument[],
  options: TextSplitterOptions = {},
): KnowledgeChunk[] => {
  return documents.flatMap((document) => splitDocumentIntoChunks(document, options));
};
