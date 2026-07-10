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
  absolutePath: string;
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
}

export interface KeywordRetrieverIndex {
  backend: "keyword";
  builtAt: string;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
}

export interface KeywordRetriever {
  backend: "keyword";
  getIndex(): KeywordRetrieverIndex;
  search(query: string, options?: RetrieveOptions): Promise<RetrievedChunk[]>;
}
