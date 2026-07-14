import { appConfig } from "../config/appMode";
import type { AdminUserListStatus } from "../types/adminUsersList";
import { ServiceRequestError, requestJson } from "./api";

export type AdminUserStatusMutation = Extract<AdminUserListStatus, "active" | "inactive">;

export interface AdminUserStatusResult {
  user: {
    id: string;
    status: AdminUserStatusMutation;
  };
  revokedSessions: number;
}

interface ApiAdminUserStatusResponse {
  user: unknown;
  revokedSessions: unknown;
}

const invalidEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para alteração de status.",
  });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isStatusMutation = (value: unknown): value is AdminUserStatusMutation => {
  return value === "active" || value === "inactive";
};

const mapAdminUserStatusResult = (
  value: ApiAdminUserStatusResponse,
): AdminUserStatusResult => {
  if (!isRecord(value.user)) {
    throw invalidEnvelopeError();
  }

  const { id, status } = value.user;

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    !isStatusMutation(status) ||
    typeof value.revokedSessions !== "number" ||
    !Number.isInteger(value.revokedSessions) ||
    value.revokedSessions < 0
  ) {
    throw invalidEnvelopeError();
  }

  return {
    user: {
      id,
      status,
    },
    revokedSessions: value.revokedSessions,
  };
};

export const updateAdminUserStatus = async (
  userId: string,
  status: AdminUserStatusMutation,
): Promise<AdminUserStatusResult> => {
  if (appConfig.appMode === "demo" || appConfig.isGithubPages) {
    throw new ServiceRequestError({
      kind: "api",
      code: "ADMIN_USER_STATUS_UNAVAILABLE_IN_DEMO",
      message: "Alteração de status indisponível no modo demonstrativo.",
    });
  }

  const payload = await requestJson<ApiAdminUserStatusResponse>({
    path: `/api/admin/users/${encodeURIComponent(userId)}/status`,
    init: {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  });

  if (!payload.data) {
    throw invalidEnvelopeError();
  }

  return mapAdminUserStatusResult(payload.data);
};
