import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "../../../auth/types";
import { AppError } from "../../../lib/app-error";
import type {
  AdminUserActivationStatus,
  AdminUserSortField,
  AdminUserSortOrder,
  AdminUserStatusMutation,
  ListAdminUsersInput,
  UpdateAdminUserGroupInput,
  UpdateAdminUserStatusInput,
} from "./types";

const ADMIN_USERS_QUERY_KEYS = new Set([
  "page",
  "pageSize",
  "search",
  "role",
  "status",
  "activationStatus",
  "group",
  "sortBy",
  "sortOrder",
]);

const ADMIN_USER_ACTIVATION_STATUSES: AdminUserActivationStatus[] = [
  "activated",
  "not_activated",
];
const ADMIN_USER_SORT_FIELDS: AdminUserSortField[] = ["name", "createdAt", "role", "status"];
const ADMIN_USER_SORT_ORDERS: AdminUserSortOrder[] = ["asc", "desc"];
const ADMIN_USER_STATUS_MUTATIONS: AdminUserStatusMutation[] = ["active", "inactive"];
const DEFAULT_ADMIN_USERS_PAGE = 1;
const DEFAULT_ADMIN_USERS_PAGE_SIZE = 10;
const MAX_ADMIN_USERS_PAGE_SIZE = 50;
const DEFAULT_ADMIN_USERS_SORT_BY: AdminUserSortField = "createdAt";
const DEFAULT_ADMIN_USERS_SORT_ORDER: AdminUserSortOrder = "desc";

export const buildInvalidAdminUsersListQueryError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_USER_LIST_QUERY",
    message: "Parâmetros inválidos para consultar usuários.",
  });

export const buildInvalidAdminUserStatusInputError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_USER_STATUS_INPUT",
    message: "Informe um usuário e um status válidos para a alteração administrativa.",
  });

export const buildInvalidAdminUserGroupInputError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_USER_GROUP_INPUT",
    message: "Informe um usuário e um grupo válidos para a alteração administrativa.",
  });

const getOptionalQueryString = (query: Record<string, unknown>, key: string) => {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== "string") {
    throw buildInvalidAdminUsersListQueryError();
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
};

const parsePositiveIntegerQuery = (
  query: Record<string, unknown>,
  key: "page" | "pageSize",
) => {
  const value = getOptionalQueryString(query, key);

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    throw buildInvalidAdminUsersListQueryError();
  }

  const parsedValue = Number(value);

  if (parsedValue < 1) {
    throw buildInvalidAdminUsersListQueryError();
  }

  return parsedValue;
};

const parseEnumQuery = <T extends string>(
  query: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
) => {
  const value = getOptionalQueryString(query, key);

  if (value === undefined) {
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    throw buildInvalidAdminUsersListQueryError();
  }

  return value as T;
};

const parseGroupQuery = (query: Record<string, unknown>) => {
  const value = getOptionalQueryString(query, "group");
  return value ? value.toLowerCase() : undefined;
};

export const parseAdminUsersListQuery = (
  query: Record<string, unknown>,
): ListAdminUsersInput => {
  for (const key of Object.keys(query)) {
    if (!ADMIN_USERS_QUERY_KEYS.has(key)) {
      throw buildInvalidAdminUsersListQueryError();
    }
  }

  const search = getOptionalQueryString(query, "search");

  if (search && search.length > 120) {
    throw buildInvalidAdminUsersListQueryError();
  }

  const pageSize = parsePositiveIntegerQuery(query, "pageSize") ?? DEFAULT_ADMIN_USERS_PAGE_SIZE;

  if (pageSize > MAX_ADMIN_USERS_PAGE_SIZE) {
    throw buildInvalidAdminUsersListQueryError();
  }

  return {
    page: parsePositiveIntegerQuery(query, "page") ?? DEFAULT_ADMIN_USERS_PAGE,
    pageSize,
    search,
    role: parseEnumQuery<UserRole>(query, "role", USER_ROLES),
    status: parseEnumQuery<UserStatus>(query, "status", USER_STATUSES),
    activationStatus: parseEnumQuery(query, "activationStatus", ADMIN_USER_ACTIVATION_STATUSES),
    group: parseGroupQuery(query),
    sortBy: parseEnumQuery(query, "sortBy", ADMIN_USER_SORT_FIELDS) ?? DEFAULT_ADMIN_USERS_SORT_BY,
    sortOrder: parseEnumQuery(query, "sortOrder", ADMIN_USER_SORT_ORDERS) ?? DEFAULT_ADMIN_USERS_SORT_ORDER,
  };
};

const ADMIN_USER_ID_MAX_LENGTH = 160;

export const parseAdminUserStatusPathParam = (value: string | string[] | undefined) => {
  const normalizedValue = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const trimmedValue = normalizedValue.trim();

  if (!trimmedValue || trimmedValue.length > ADMIN_USER_ID_MAX_LENGTH) {
    throw buildInvalidAdminUserStatusInputError();
  }

  return trimmedValue;
};

export const parseAdminUserGroupPathParam = (value: string | string[] | undefined) => {
  const normalizedValue = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const trimmedValue = normalizedValue.trim();

  if (!trimmedValue || trimmedValue.length > ADMIN_USER_ID_MAX_LENGTH) {
    throw buildInvalidAdminUserGroupInputError();
  }

  return trimmedValue;
};

export const parseAdminUserStatusBody = (body: unknown): UpdateAdminUserStatusInput => {
  const isPlainObject =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.getPrototypeOf(body) === Object.prototype;

  if (!isPlainObject) {
    throw buildInvalidAdminUserStatusInputError();
  }

  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== "status") {
    throw buildInvalidAdminUserStatusInputError();
  }

  const { status } = body as Record<string, unknown>;

  if (typeof status !== "string" || !ADMIN_USER_STATUS_MUTATIONS.includes(status as AdminUserStatusMutation)) {
    throw buildInvalidAdminUserStatusInputError();
  }

  return {
    status: status as AdminUserStatusMutation,
  };
};

export const parseAdminUserGroupBody = (body: unknown): UpdateAdminUserGroupInput => {
  const isPlainObject =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.getPrototypeOf(body) === Object.prototype;

  if (!isPlainObject) {
    throw buildInvalidAdminUserGroupInputError();
  }

  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== "groupSlug") {
    throw buildInvalidAdminUserGroupInputError();
  }

  const { groupSlug } = body as Record<string, unknown>;

  if (groupSlug === null) {
    return { groupSlug: null };
  }

  if (typeof groupSlug !== "string") {
    throw buildInvalidAdminUserGroupInputError();
  }

  const normalizedGroupSlug = groupSlug.trim();

  if (!normalizedGroupSlug) {
    throw buildInvalidAdminUserGroupInputError();
  }

  return {
    groupSlug: normalizedGroupSlug,
  };
};
