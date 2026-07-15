import { appConfig } from "../config/appMode";
import type { AdminUserGroupMutationResult } from "../types/adminUsersList";
import { ServiceRequestError, requestJson } from "./api";

interface ApiAdminUserGroupResponse {
  user: unknown;
}

interface UpdateAdminUserGroupInput {
  groupSlug: string | null;
}

const invalidEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para alteração de grupo.",
  });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0;
};

const mapGroup = (value: unknown) => {
  if (value === null) {
    return null;
  }

  if (!isRecord(value) || !isNonEmptyString(value.name) || !isNonEmptyString(value.slug)) {
    throw invalidEnvelopeError();
  }

  return {
    name: value.name,
    slug: value.slug,
  };
};

const mapAdminUserGroupResult = (value: ApiAdminUserGroupResponse): AdminUserGroupMutationResult => {
  if (!isRecord(value.user) || !isNonEmptyString(value.user.id)) {
    throw invalidEnvelopeError();
  }

  return {
    user: {
      id: value.user.id,
      group: mapGroup("group" in value.user ? value.user.group : undefined),
    },
  };
};

export const updateAdminUserGroup = async (
  userId: string,
  input: UpdateAdminUserGroupInput,
): Promise<AdminUserGroupMutationResult> => {
  if (appConfig.appMode === "demo" || appConfig.isGithubPages) {
    throw new ServiceRequestError({
      kind: "api",
      code: "ADMIN_USER_GROUP_UNAVAILABLE_IN_DEMO",
      message: "Alteração de grupo indisponível no modo demonstrativo.",
    });
  }

  const payload = await requestJson<ApiAdminUserGroupResponse>({
    path: `/api/admin/users/${encodeURIComponent(userId)}/group`,
    init: {
      method: "PATCH",
      body: JSON.stringify({ groupSlug: input.groupSlug }),
    },
  });

  if (!payload.data) {
    throw invalidEnvelopeError();
  }

  return mapAdminUserGroupResult(payload.data);
};
