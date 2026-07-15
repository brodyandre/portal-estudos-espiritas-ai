import { AppError } from "../../../lib/app-error";
import type { ListAdminGroupsInput } from "./types";

const ADMIN_GROUPS_QUERY_KEYS = new Set(["status"]);
const ADMIN_GROUPS_STATUSES = ["active", "inactive", "all"] as const;

export const buildInvalidAdminGroupsQueryError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_GROUPS_QUERY",
    message: "Parâmetros inválidos para consultar grupos administrativos.",
  });

const getOptionalQueryString = (query: Record<string, unknown>, key: string) => {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== "string") {
    throw buildInvalidAdminGroupsQueryError();
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw buildInvalidAdminGroupsQueryError();
  }

  return trimmedValue;
};

export const parseAdminGroupsListQuery = (
  query: Record<string, unknown>,
): ListAdminGroupsInput => {
  for (const key of Object.keys(query)) {
    if (!ADMIN_GROUPS_QUERY_KEYS.has(key)) {
      throw buildInvalidAdminGroupsQueryError();
    }
  }

  const status = getOptionalQueryString(query, "status");

  if (status === undefined) {
    return { status: "active" };
  }

  if (!ADMIN_GROUPS_STATUSES.includes(status as (typeof ADMIN_GROUPS_STATUSES)[number])) {
    throw buildInvalidAdminGroupsQueryError();
  }

  return {
    status: status as ListAdminGroupsInput["status"],
  };
};
