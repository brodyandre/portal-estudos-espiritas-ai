import type { KnowledgeFileType, KnowledgeSupportFile } from "../mocks/knowledge";

export type AdminContentReviewStatus = "not_reviewed" | "reviewed" | "needs_review";

export interface AdminContentItem extends KnowledgeSupportFile {
  reviewStatus: AdminContentReviewStatus;
}

export interface AdminContentReviewRecord {
  fileId: string;
  reviewStatus: AdminContentReviewStatus;
}

export type AdminContentGroupFilter = "all" | "emmanuel" | "a-caminho-da-luz";
export type AdminContentTypeFilter = "all" | KnowledgeFileType;
