import { appConfig } from "../config/appMode";
import { listMockAdminUsersList } from "../mocks/adminUsersList";
import type {
  AdminUserActivationStatus,
  AdminUserGroupSummary,
  AdminUserListItem,
  AdminUserListMeta,
  AdminUserListParams,
  AdminUserListRole,
  AdminUserListStatus,
  AdminUserListSortBy,
  AdminUserListSortOrder,
  AdminUsersListResult,
} from "../types/adminUsersList";
import { ServiceRequestError, requestJson } from "./api";

interface ApiAdminUsersListData {
  items: unknown;
}

const ADMIN_USERS_PATH = "/api/admin/users";

const invalidEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para usuários administrativos.",
  });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0;
};

const isRole = (value: unknown): value is AdminUserListRole => {
  return value === "visitor" || value === "student" || value === "teacher" || value === "admin";
};

const isStatus = (value: unknown): value is AdminUserListStatus => {
  return value === "pending" || value === "active" || value === "inactive" || value === "rejected";
};

const isActivationStatus = (value: unknown): value is AdminUserActivationStatus => {
  return value === "activated" || value === "not_activated";
};

const isSortBy = (value: unknown): value is AdminUserListSortBy => {
  return value === "name" || value === "createdAt" || value === "role" || value === "status";
};

const isSortOrder = (value: unknown): value is AdminUserListSortOrder => {
  return value === "asc" || value === "desc";
};

const isValidInteger = (value: unknown, minimum: number): value is number => {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= minimum;
};

const mapGroup = (value: unknown): AdminUserGroupSummary | null => {
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

const mapItem = (value: unknown): AdminUserListItem => {
  if (!isRecord(value)) {
    throw invalidEnvelopeError();
  }

  const { id, name, emailMasked, role, status, activationStatus, group, createdAt } = value;

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(name) ||
    !isNonEmptyString(emailMasked) ||
    !isRole(role) ||
    !isStatus(status) ||
    !isActivationStatus(activationStatus) ||
    !isNonEmptyString(createdAt)
  ) {
    throw invalidEnvelopeError();
  }

  return {
    id,
    name,
    emailMasked,
    role,
    status,
    activationStatus,
    group: mapGroup(group),
    createdAt,
  };
};

const mapMeta = (value: unknown): AdminUserListMeta => {
  if (!isRecord(value)) {
    throw invalidEnvelopeError();
  }

  const { page, pageSize, total, totalPages } = value;

  if (
    !isValidInteger(page, 1) ||
    !isValidInteger(pageSize, 1) ||
    !isValidInteger(total, 0) ||
    !isValidInteger(totalPages, 0)
  ) {
    throw invalidEnvelopeError();
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
  };
};

const appendParam = (
  query: URLSearchParams,
  key: string,
  value: number | string | null | undefined,
) => {
  if (value === undefined || value === null) {
    return;
  }

  const serialized = typeof value === "string" ? value.trim() : String(value);

  if (!serialized) {
    return;
  }

  query.set(key, serialized);
};

const buildAdminUsersPath = (params: AdminUserListParams = {}) => {
  const query = new URLSearchParams();

  appendParam(query, "page", params.page);
  appendParam(query, "pageSize", params.pageSize);
  appendParam(query, "search", params.search);
  appendParam(query, "role", params.role);
  appendParam(query, "status", params.status);
  appendParam(query, "activationStatus", params.activationStatus);
  appendParam(query, "group", params.group);
  appendParam(query, "sortBy", params.sortBy);
  appendParam(query, "sortOrder", params.sortOrder);

  const serialized = query.toString();
  return serialized ? `${ADMIN_USERS_PATH}?${serialized}` : ADMIN_USERS_PATH;
};

export const listAdminUsersList = async (
  params: AdminUserListParams = {},
): Promise<AdminUsersListResult> => {
  if (appConfig.appMode === "demo") {
    return listMockAdminUsersList(params);
  }

  const payload = await requestJson<ApiAdminUsersListData>({
    path: buildAdminUsersPath(params),
  });

  if (!payload.data || !Array.isArray(payload.data.items) || !payload.meta) {
    throw invalidEnvelopeError();
  }

  return {
    items: payload.data.items.map(mapItem),
    meta: mapMeta(payload.meta),
    source: "api",
  };
};
