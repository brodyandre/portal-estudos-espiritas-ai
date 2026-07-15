import { appConfig } from "../config/appMode";
import { getMockUserStudyMeetings } from "../mocks/userStudyMeetings";
import type {
  UserStudyMeeting,
  UserStudyMeetingGroup,
  UserStudyMeetingsResponse,
  UserStudyMeetingsResult,
} from "../types/userStudyMeetings";
import { requestJson, ServiceRequestError } from "./api";

const USER_STUDY_MEETINGS_PATH = "/api/me/study-meetings/upcoming";
const DEFAULT_LIMIT = 3;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasValidMeetingTimestamps = (startsAt: unknown, endsAt: unknown) => {
  if (typeof startsAt !== "string" || typeof endsAt !== "string") {
    return false;
  }

  const parsedStartsAt = parseTimestamp(startsAt);
  const parsedEndsAt = parseTimestamp(endsAt);

  return Boolean(parsedStartsAt && parsedEndsAt && parsedEndsAt.getTime() > parsedStartsAt.getTime());
};

const isValidGroup = (value: unknown): value is UserStudyMeetingGroup => {
  if (value === null) {
    return true;
  }

  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.status === "active" || value.status === "inactive")
  );
};

const isValidMeeting = (value: unknown): value is UserStudyMeeting =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  (typeof value.description === "string" || value.description === null) &&
  hasValidMeetingTimestamps(value.startsAt, value.endsAt) &&
  (value.status === "ongoing" || value.status === "scheduled") &&
  (typeof value.meetUrl === "string" || value.meetUrl === null);

const assertValidResponse = (value: unknown): UserStudyMeetingsResponse => {
  if (
    !isObject(value) ||
    !("group" in value) ||
    !isValidGroup(value.group) ||
    !Array.isArray(value.items) ||
    !value.items.every(isValidMeeting)
  ) {
    throw new ServiceRequestError({
      kind: "api",
      message: "Resposta inválida do servidor para encontros do grupo.",
    });
  }

  return {
    group: value.group,
    items: value.items,
  };
};

export const listUserStudyMeetings = async (
  options: { limit?: number } = {},
): Promise<UserStudyMeetingsResult> => {
  const limit = options.limit ?? DEFAULT_LIMIT;

  if (appConfig.appMode === "demo" || !appConfig.apiUrl) {
    return getMockUserStudyMeetings(limit);
  }

  const payload = await requestJson<unknown>({
    path: USER_STUDY_MEETINGS_PATH,
    query: {
      limit: String(limit),
    },
  });
  const data = assertValidResponse(payload.data);

  return {
    ...data,
    limit:
      typeof payload.meta?.limit === "number"
        ? payload.meta.limit
        : limit,
    source: "api",
    notice: null,
  };
};

export { ServiceRequestError };
