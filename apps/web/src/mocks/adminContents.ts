import { listMockKnowledgeFilesByGroup } from "./knowledge";
import type { AdminContentItem, AdminContentReviewRecord, AdminContentReviewStatus } from "../types/adminContents";

const CONTENTS_STORAGE_KEY = "portal-estudos-espiritas-ai:admin-knowledge-review";

const isBrowser = () => {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
};

const readStoredReviewRecords = (): AdminContentReviewRecord[] => {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(CONTENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminContentReviewRecord[]) : [];
  } catch (_error) {
    return [];
  }
};

const writeStoredReviewRecords = (items: AdminContentReviewRecord[]) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(CONTENTS_STORAGE_KEY, JSON.stringify(items));
};

const defaultStatusForContent = (requiresReview: boolean): AdminContentReviewStatus => {
  return requiresReview ? "needs_review" : "not_reviewed";
};

const buildReviewMap = () => {
  return new Map(readStoredReviewRecords().map((item) => [item.fileId, item.reviewStatus]));
};

const getBaseFiles = () => {
  return [
    ...listMockKnowledgeFilesByGroup("emmanuel"),
    ...listMockKnowledgeFilesByGroup("a-caminho-da-luz"),
  ];
};

export const listMockAdminContents = (): AdminContentItem[] => {
  const reviewMap = buildReviewMap();

  return getBaseFiles().map((file) => ({
    ...file,
    reviewStatus: reviewMap.get(file.id) ?? defaultStatusForContent(file.teacherReviewRecommended),
  }));
};

export const updateMockAdminContentReview = (
  fileId: string,
  reviewStatus: AdminContentReviewStatus,
): AdminContentItem | null => {
  const currentFiles = listMockAdminContents();
  const target = currentFiles.find((file) => file.id === fileId);

  if (!target) {
    return null;
  }

  const recordsMap = buildReviewMap();
  recordsMap.set(fileId, reviewStatus);
  writeStoredReviewRecords(
    Array.from(recordsMap.entries()).map(([currentFileId, currentStatus]) => ({
      fileId: currentFileId,
      reviewStatus: currentStatus,
    })),
  );

  return {
    ...target,
    reviewStatus,
  };
};

export const resetMockAdminContents = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(CONTENTS_STORAGE_KEY);
};
