export interface MarkdownFrontmatter {
  title: string;
  group: string;
  purpose: string;
  source: string;
  [key: string]: string;
}

export interface KnowledgeDocument {
  id: string;
  source: string;
  fileName: string;
  title: string;
  group: string;
  purpose: string;
  attribution: string;
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
  source: string;
  title: string;
  group: string;
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
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  source: string;
  title: string;
  content: string;
  score: number;
  group: string;
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
