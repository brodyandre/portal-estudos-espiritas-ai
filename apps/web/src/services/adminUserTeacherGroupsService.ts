import { appConfig } from "../config/appMode";
import type {
  AdminUserTeacherGroupSummary,
  AdminUserTeacherGroupsMutationResult,
} from "../types/adminUsersList";
import { ServiceRequestError, requestJson } from "./api";

interface ApiAdminUserTeacherGroupsResponse {
  user: unknown;
}

interface UpdateAdminUserTeacherGroupsInput {
  groupIds: string[];
}

const invalidEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para vínculos do professor.",
  });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0;
};

const mapTeacherGroup = (value: unknown): AdminUserTeacherGroupSummary => {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.slug) ||
    (value.status !== "active" && value.status !== "inactive")
  ) {
    throw invalidEnvelopeError();
  }

  return {
    name: value.name,
    slug: value.slug,
    status: value.status,
  };
};

const mapAdminUserTeacherGroupsResult = (
  value: ApiAdminUserTeacherGroupsResponse,
): AdminUserTeacherGroupsMutationResult => {
  if (
    !isRecord(value.user) ||
    !isNonEmptyString(value.user.id) ||
    !Array.isArray(value.user.groups)
  ) {
    throw invalidEnvelopeError();
  }

  return {
    user: {
      id: value.user.id,
      groups: value.user.groups.map(mapTeacherGroup),
    },
  };
};

export const updateAdminUserTeacherGroups = async (
  userId: string,
  input: UpdateAdminUserTeacherGroupsInput,
): Promise<AdminUserTeacherGroupsMutationResult> => {
  if (appConfig.appMode === "demo" || appConfig.isGithubPages) {
    throw new ServiceRequestError({
      kind: "api",
      code: "ADMIN_USER_TEACHER_GROUPS_UNAVAILABLE_IN_DEMO",
      message: "Alteração de grupos do professor indisponível no modo demonstrativo.",
    });
  }

  const payload = await requestJson<ApiAdminUserTeacherGroupsResponse>({
    path: `/api/admin/users/${encodeURIComponent(userId)}/groups`,
    init: {
      method: "PUT",
      body: JSON.stringify({ groupIds: input.groupIds }),
    },
  });

  if (!payload.data) {
    throw invalidEnvelopeError();
  }

  return mapAdminUserTeacherGroupsResult(payload.data);
};
