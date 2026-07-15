import { AppError } from "../../lib/app-error";
import {
  DEFAULT_STUDY_MEETINGS_PAGE,
  DEFAULT_STUDY_MEETINGS_PAGE_SIZE,
  MAX_STUDY_MEETINGS_PAGE_SIZE,
  STUDY_MEETING_ID_MAX_LENGTH,
  type StudyMeetingListInput,
  type StudyMeetingSortOrder,
} from "./study-meetings.types";

const STUDY_MEETING_LIST_QUERY_KEYS = new Set([
  "page",
  "pageSize",
  "sortOrder",
  "includeCanceled",
]);
const STUDY_MEETING_SORT_ORDERS: StudyMeetingSortOrder[] = ["asc", "desc"];

export const buildInvalidStudyMeetingInputError = (field?: string) =>
  new AppError({
    statusCode: 400,
    code: "INVALID_STUDY_MEETING_INPUT",
    message: "Revise os dados do encontro para continuar.",
    details: field ? { field } : undefined,
  });

const buildInvalidStudyMeetingListQueryError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_STUDY_MEETING_LIST_INPUT",
    message: "Revise os filtros da agenda para continuar.",
  });

export const parseStudyMeetingRouteParam = (
  value: unknown,
  field: "groupId" | "meetingId",
) => {
  if (Array.isArray(value) || typeof value !== "string") {
    throw buildInvalidStudyMeetingInputError(field);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.length > STUDY_MEETING_ID_MAX_LENGTH) {
    throw buildInvalidStudyMeetingInputError(field);
  }

  return trimmedValue;
};

const getRequiredQueryString = (query: Record<string, unknown>, key: string) => {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== "string") {
    throw buildInvalidStudyMeetingListQueryError();
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw buildInvalidStudyMeetingListQueryError();
  }

  return trimmedValue;
};

const parsePositiveIntegerQuery = (
  query: Record<string, unknown>,
  key: "page" | "pageSize",
) => {
  const value = getRequiredQueryString(query, key);

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    throw buildInvalidStudyMeetingListQueryError();
  }

  const parsedValue = Number(value);

  if (parsedValue < 1) {
    throw buildInvalidStudyMeetingListQueryError();
  }

  return parsedValue;
};

const parseSortOrderQuery = (query: Record<string, unknown>) => {
  const value = getRequiredQueryString(query, "sortOrder");

  if (value === undefined) {
    return undefined;
  }

  if (!STUDY_MEETING_SORT_ORDERS.includes(value as StudyMeetingSortOrder)) {
    throw buildInvalidStudyMeetingListQueryError();
  }

  return value as StudyMeetingSortOrder;
};

const parseBooleanQuery = (query: Record<string, unknown>, key: "includeCanceled") => {
  const value = getRequiredQueryString(query, key);

  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw buildInvalidStudyMeetingListQueryError();
};

export const parseStudyMeetingsListQuery = (
  groupId: string,
  query: Record<string, unknown>,
): StudyMeetingListInput => {
  for (const key of Object.keys(query)) {
    if (!STUDY_MEETING_LIST_QUERY_KEYS.has(key)) {
      throw buildInvalidStudyMeetingListQueryError();
    }
  }

  const pageSize =
    parsePositiveIntegerQuery(query, "pageSize") ?? DEFAULT_STUDY_MEETINGS_PAGE_SIZE;

  if (pageSize > MAX_STUDY_MEETINGS_PAGE_SIZE) {
    throw buildInvalidStudyMeetingListQueryError();
  }

  return {
    groupId,
    page: parsePositiveIntegerQuery(query, "page") ?? DEFAULT_STUDY_MEETINGS_PAGE,
    pageSize,
    sortOrder: parseSortOrderQuery(query) ?? "asc",
    includeCanceled: parseBooleanQuery(query, "includeCanceled") ?? false,
  };
};
