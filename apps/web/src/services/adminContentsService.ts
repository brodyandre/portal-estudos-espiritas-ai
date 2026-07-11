import type { ServiceResult } from "./api";
import { collectServiceNotice } from "./api";
import { listKnowledgeFilesByGroup } from "./knowledgeService";
import { listMockAdminContents, updateMockAdminContentReview } from "../mocks/adminContents";
import type { AdminContentItem, AdminContentReviewStatus } from "../types/adminContents";
import type { KnowledgeSupportFile } from "../mocks/knowledge";

const FALLBACK_NOTICE =
  "Modo demonstrativo: a organização editorial completa depende do backend local, mas a base resumida segue disponível para revisão.";

const mergeReviewStatus = (file: KnowledgeSupportFile, currentStatus?: AdminContentReviewStatus): AdminContentItem => {
  return {
    ...file,
    reviewStatus:
      currentStatus ?? (file.teacherReviewRecommended ? "needs_review" : "not_reviewed"),
  };
};

const sortContents = (left: AdminContentItem, right: AdminContentItem) => {
  if (left.teacherReviewRecommended !== right.teacherReviewRecommended) {
    return left.teacherReviewRecommended ? -1 : 1;
  }

  if (left.groupName !== right.groupName) {
    return left.groupName.localeCompare(right.groupName);
  }

  return left.title.localeCompare(right.title);
};

export const listAdminContents = async (): Promise<ServiceResult<AdminContentItem[]>> => {
  const [emmanuelResult, aclResult] = await Promise.all([
    listKnowledgeFilesByGroup("emmanuel"),
    listKnowledgeFilesByGroup("a-caminho-da-luz"),
  ]);

  const mockItems = listMockAdminContents();
  const mockStatusMap = new Map(mockItems.map((item) => [item.id, item.reviewStatus]));
  const items = [...emmanuelResult.data, ...aclResult.data]
    .map((file) => mergeReviewStatus(file, mockStatusMap.get(file.id)))
    .sort(sortContents);

  const source =
    emmanuelResult.source === "api" && aclResult.source === "api"
      ? "api"
      : "mock";

  return {
    data: items.length > 0 ? items : mockItems.sort(sortContents),
    source,
    notice:
      collectServiceNotice([emmanuelResult, aclResult]) ??
      (source === "mock" ? FALLBACK_NOTICE : null),
  };
};

export const updateAdminContentReview = async (
  fileId: string,
  reviewStatus: AdminContentReviewStatus,
): Promise<ServiceResult<AdminContentItem | null>> => {
  return {
    data: updateMockAdminContentReview(fileId, reviewStatus),
    source: "mock",
    notice: FALLBACK_NOTICE,
  };
};
