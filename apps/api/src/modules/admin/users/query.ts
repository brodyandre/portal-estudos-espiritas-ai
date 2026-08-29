import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "../../../auth/types";
import { AppError } from "../../../lib/app-error";
import type {
  AdminUserActivationStatus,
  AdminUserSortField,
  AdminUserSortOrder,
  AdminUserStatusMutation,
  ListAdminUsersInput,
  CreateAdminTeacherInput,
  UpdateAdminUserGroupInput,
  UpdateAdminUserTeacherGroupsInput,
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

export const buildInvalidAdminUserTeacherGroupsInputError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_USER_TEACHER_GROUPS_INPUT",
    message: "Informe um professor e uma lista de grupos válidos para a alteração administrativa.",
  });

export const buildInvalidAdminTeacherInputError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_TEACHER_INPUT",
    message: "Informe nome, e-mail e grupos válidos para criar o professor.",
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
const ADMIN_TEACHER_NAME_MAX_LENGTH = 120;
const ADMIN_TEACHER_EMAIL_MAX_LENGTH = 254;
const ADMIN_TEACHER_GROUP_MAX_COUNT = 20;
const ADMIN_TEACHER_GROUP_ID_MAX_LENGTH = ADMIN_USER_ID_MAX_LENGTH;

const isPlainObject = (body: unknown): body is Record<string, unknown> =>
  typeof body === "object" &&
  body !== null &&
  !Array.isArray(body) &&
  Object.getPrototypeOf(body) === Object.prototype;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

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

export const parseAdminUserTeacherGroupsPathParam = (value: string | string[] | undefined) => {
  const normalizedValue = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const trimmedValue = normalizedValue.trim();

  if (!trimmedValue || trimmedValue.length > ADMIN_USER_ID_MAX_LENGTH) {
    throw buildInvalidAdminUserTeacherGroupsInputError();
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

export const parseAdminUserTeacherGroupsBody = (
  body: unknown,
): UpdateAdminUserTeacherGroupsInput => {
  const isPlainObject =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.getPrototypeOf(body) === Object.prototype;

  if (!isPlainObject) {
    throw buildInvalidAdminUserTeacherGroupsInputError();
  }

  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== "groupIds") {
    throw buildInvalidAdminUserTeacherGroupsInputError();
  }

  const { groupIds } = body as Record<string, unknown>;

  if (!Array.isArray(groupIds)) {
    throw buildInvalidAdminUserTeacherGroupsInputError();
  }

  const normalizedGroupIds = groupIds.map((groupId) => {
    if (typeof groupId !== "string") {
      throw buildInvalidAdminUserTeacherGroupsInputError();
    }

    const normalizedGroupId = groupId.trim();

    if (!normalizedGroupId || normalizedGroupId.length > ADMIN_USER_ID_MAX_LENGTH) {
      throw buildInvalidAdminUserTeacherGroupsInputError();
    }

    return normalizedGroupId;
  });

  if (new Set(normalizedGroupIds).size !== normalizedGroupIds.length) {
    throw buildInvalidAdminUserTeacherGroupsInputError();
  }

  return {
    groupIds: normalizedGroupIds,
  };
};

const parseAdminPedagogicalGroupIds = (
  groupIds: unknown,
  buildError: () => AppError,
  options: { minCount?: number } = {},
) => {
  const minCount = options.minCount ?? 1;

  if (!Array.isArray(groupIds) || groupIds.length < minCount || groupIds.length > ADMIN_TEACHER_GROUP_MAX_COUNT) {
    throw buildError();
  }

  const normalizedGroupIds = groupIds.map((groupId) => {
    if (typeof groupId !== "string") {
      throw buildError();
    }

    const normalizedGroupId = groupId.trim();

    if (!normalizedGroupId || normalizedGroupId.length > ADMIN_TEACHER_GROUP_ID_MAX_LENGTH) {
      throw buildError();
    }

    return normalizedGroupId;
  });

  if (new Set(normalizedGroupIds).size !== normalizedGroupIds.length) {
    throw buildError();
  }

  return normalizedGroupIds;
};

export const parseAdminUserPedagogicalGroupsBody = (
  body: unknown,
): UpdateAdminUserTeacherGroupsInput => {
  if (!isPlainObject(body)) {
    throw buildInvalidAdminUserTeacherGroupsInputError();
  }

  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== "groupIds") {
    throw buildInvalidAdminUserTeacherGroupsInputError();
  }

  return {
    groupIds: parseAdminPedagogicalGroupIds(
      (body as Record<string, unknown>).groupIds,
      buildInvalidAdminUserTeacherGroupsInputError,
      { minCount: 0 },
    ),
  };
};

export const parseAdminTeacherBody = (body: unknown): CreateAdminTeacherInput => {
  if (!isPlainObject(body)) {
    throw buildInvalidAdminTeacherInputError();
  }

  const allowedKeys = new Set(["fullName", "email", "groupIds"]);
  const keys = Object.keys(body);

  if (keys.length !== 3 || keys.some((key) => !allowedKeys.has(key))) {
    throw buildInvalidAdminTeacherInputError();
  }

  const { fullName, email, groupIds } = body;

  if (typeof fullName !== "string") {
    throw buildInvalidAdminTeacherInputError();
  }

  const normalizedFullName = fullName.trim();

  if (!normalizedFullName || normalizedFullName.length > ADMIN_TEACHER_NAME_MAX_LENGTH) {
    throw buildInvalidAdminTeacherInputError();
  }

  if (typeof email !== "string") {
    throw buildInvalidAdminTeacherInputError();
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (
    !normalizedEmail ||
    normalizedEmail.length > ADMIN_TEACHER_EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw buildInvalidAdminTeacherInputError();
  }

  return {
    fullName: normalizedFullName,
    email: normalizedEmail,
    groupIds: parseAdminPedagogicalGroupIds(groupIds, buildInvalidAdminTeacherInputError),
  };
};
