import { AppError } from "../../lib/app-error";
import {
  DEFAULT_USER_STUDY_MEETINGS_LIMIT,
  MAX_USER_STUDY_MEETINGS_LIMIT,
  MIN_USER_STUDY_MEETINGS_LIMIT,
  type ListUpcomingUserStudyMeetingsInput,
} from "./study-meetings.types";

const USER_STUDY_MEETINGS_QUERY_KEYS = new Set(["limit"]);

const buildInvalidUserStudyMeetingsQueryError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_USER_STUDY_MEETINGS_QUERY",
    message: "Revise os filtros dos encontros para continuar.",
  });

const getOptionalQueryString = (query: Record<string, unknown>, key: string) => {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== "string") {
    throw buildInvalidUserStudyMeetingsQueryError();
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw buildInvalidUserStudyMeetingsQueryError();
  }

  return trimmedValue;
};

export const parseUpcomingUserStudyMeetingsQuery = (
  query: Record<string, unknown>,
): ListUpcomingUserStudyMeetingsInput => {
  for (const key of Object.keys(query)) {
    if (!USER_STUDY_MEETINGS_QUERY_KEYS.has(key)) {
      throw buildInvalidUserStudyMeetingsQueryError();
    }
  }

  const limit = getOptionalQueryString(query, "limit");

  if (limit === undefined) {
    return {
      limit: DEFAULT_USER_STUDY_MEETINGS_LIMIT,
    };
  }

  if (!/^\d+$/u.test(limit)) {
    throw buildInvalidUserStudyMeetingsQueryError();
  }

  const parsedLimit = Number(limit);

  if (
    parsedLimit < MIN_USER_STUDY_MEETINGS_LIMIT ||
    parsedLimit > MAX_USER_STUDY_MEETINGS_LIMIT
  ) {
    throw buildInvalidUserStudyMeetingsQueryError();
  }

  return {
    limit: parsedLimit,
  };
};
