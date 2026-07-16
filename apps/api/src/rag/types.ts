export interface MarkdownFrontmatter {
  title: string;
  group: string;
  purpose: string;
  source: string;
  [key: string]: string;
}

export interface KnowledgeIndexEntry {
  id: string;
  title: string;
  group: string;
  book: string;
  filename: string;
  path: string;
  type: string;
  tags: string[];
  description: string;
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
}

export interface KnowledgeIndex {
  version?: number;
  updatedAt?: string;
  description?: string;
  books?: string[];
  contentTypes?: string[];
  files: KnowledgeIndexEntry[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  group: string;
  book: string;
  source: string;
  sourceLabel: string;
  filename: string;
  path: string;
  absolutePath?: string;
  type: string;
  tags: string[];
  description: string;
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  purpose: string;
  content: string;
  rawContent: string;
  frontmatter: MarkdownFrontmatter;
  charCount: number;
  wordCount: number;
  editorial?: KnowledgeDocumentEditorialMetadata;
}

export interface KnowledgeDocumentForRetrieval {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  readonly book: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly filename: string;
  readonly path: string;
  readonly type: string;
  readonly tags: readonly string[];
  readonly description: string;
  readonly sensitiveTopics: readonly string[];
  readonly teacherReviewRecommended: boolean;
  readonly purpose: string;
  readonly content: string;
  readonly rawContent: string;
  readonly frontmatter: Readonly<MarkdownFrontmatter>;
  readonly charCount: number;
  readonly wordCount: number;
  readonly editorial?: Readonly<KnowledgeDocumentEditorialMetadata>;
}

export interface KnowledgeDocumentEditorialMetadata {
  manifestFingerprint: string;
  manifestSourceId: string;
  documentId: string;
  bookId: string;
  catalogKey: string | null;
  documentTitle: string;
  bookTitle: string;
  bookSlug: string;
  documentVersion: number;
  origin: "catalog";
}

export interface DocumentLoadOptions {
  knowledgeDir?: string;
}

export interface DocumentValidationIssue {
  source: string;
  severity: "error" | "warning";
  message: string;
}

export interface DocumentValidationResult {
  documents: KnowledgeDocument[];
  issues: DocumentValidationIssue[];
  valid: boolean;
}

export interface TextSplitterOptions {
  maxChunkLength?: number;
  chunkOverlap?: number;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  title: string;
  group: string;
  book: string;
  source: string;
  sourceLabel: string;
  filename: string;
  path: string;
  type: string;
  tags: string[];
  description: string;
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  content: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  keywordHints: string[];
  vectorRef: string | null;
  editorial?: KnowledgeDocumentEditorialMetadata;
}

export interface RetrieveOptions {
  limit?: number;
  minScore?: number;
  group?: string;
  book?: string;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  title: string;
  group: string;
  book: string;
  source: string;
  sourceLabel: string;
  filename: string;
  path: string;
  type: string;
  tags: string[];
  description: string;
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
  content: string;
  score: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  vectorRef: string | null;
  editorial?: KnowledgeDocumentEditorialMetadata;
}

export interface KeywordRetrieverIndex {
  backend: "keyword";
  builtAt: string;
  documents: readonly KnowledgeDocumentForRetrieval[];
  chunks: KnowledgeChunk[];
}

export interface KeywordRetriever {
  backend: "keyword";
  getIndex(): KeywordRetrieverIndex;
  search(query: string, options?: RetrieveOptions): Promise<RetrievedChunk[]>;
}
