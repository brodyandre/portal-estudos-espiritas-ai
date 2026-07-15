import { appConfig } from "../config/appMode";
import {
  getMockAdminStudyMeeting,
  listMockAdminStudyMeetings,
} from "../mocks/adminStudyMeetings";
import type {
  AdminStudyMeeting,
  AdminStudyMeetingListMeta,
  AdminStudyMeetingListParams,
  AdminStudyMeetingListResult,
  CancelAdminStudyMeetingInput,
  CreateAdminStudyMeetingInput,
  UpdateAdminStudyMeetingInput,
} from "../types/adminStudyMeetings";
import { ServiceRequestError, requestJson } from "./api";

interface ApiAdminStudyMeetingsListData {
  items: unknown;
}

const invalidEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para encontros administrativos.",
  });

const demoReadOnlyError = () =>
  new ServiceRequestError({
    kind: "api",
    code: "ADMIN_STUDY_MEETING_UNAVAILABLE_IN_DEMO",
    message: "Gestão de encontros indisponível no modo demonstrativo.",
  });

const demoNotFoundError = () =>
  new ServiceRequestError({
    kind: "api",
    code: "STUDY_MEETING_NOT_FOUND",
    message: "Encontro não encontrado para este grupo.",
  });

const isDemoReadOnlyMode = () => appConfig.appMode === "demo" || appConfig.isGithubPages;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0;
};

const isStringOrNull = (value: unknown): value is string | null => {
  return typeof value === "string" || value === null;
};

const isValidInteger = (value: unknown, minimum: number): value is number => {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= minimum;
};

const mapAdminStudyMeeting = (item: unknown): AdminStudyMeeting => {
  if (!isRecord(item)) {
    throw invalidEnvelopeError();
  }

  const {
    id,
    groupId,
    title,
    description,
    startsAt,
    endsAt,
    canceledAt,
    cancellationReason,
    createdAt,
    updatedAt,
  } = item;

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(groupId) ||
    !isNonEmptyString(title) ||
    !isStringOrNull(description) ||
    !isNonEmptyString(startsAt) ||
    !isNonEmptyString(endsAt) ||
    !isStringOrNull(canceledAt) ||
    !isStringOrNull(cancellationReason) ||
    !isNonEmptyString(createdAt) ||
    !isNonEmptyString(updatedAt)
  ) {
    throw invalidEnvelopeError();
  }

  return {
    id,
    groupId,
    title,
    description,
    startsAt,
    endsAt,
    canceledAt,
    cancellationReason,
    createdAt,
    updatedAt,
  };
};

const mapListMeta = (meta: unknown): AdminStudyMeetingListMeta => {
  if (!isRecord(meta)) {
    throw invalidEnvelopeError();
  }

  const { page, pageSize, total, totalPages } = meta;

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
  params: URLSearchParams,
  key: string,
  value: boolean | number | string | undefined,
) => {
  if (value === undefined) {
    return;
  }

  const serialized = typeof value === "string" ? value.trim() : String(value);

  if (!serialized) {
    return;
  }

  params.set(key, serialized);
};

const buildMeetingsPath = (
  groupId: string,
  params: AdminStudyMeetingListParams = {},
) => {
  const query = new URLSearchParams();
  const basePath = `/api/admin/groups/${encodeURIComponent(groupId)}/meetings`;

  appendParam(query, "page", params.page);
  appendParam(query, "pageSize", params.pageSize);
  appendParam(query, "sortOrder", params.sortOrder);
  appendParam(query, "includeCanceled", params.includeCanceled);

  const serializedQuery = query.toString();

  return serializedQuery ? `${basePath}?${serializedQuery}` : basePath;
};

const buildMeetingPath = (groupId: string, meetingId: string) =>
  `/api/admin/groups/${encodeURIComponent(groupId)}/meetings/${encodeURIComponent(meetingId)}`;

export const listAdminStudyMeetings = async (
  groupId: string,
  params: AdminStudyMeetingListParams = {},
): Promise<AdminStudyMeetingListResult> => {
  if (isDemoReadOnlyMode()) {
    return listMockAdminStudyMeetings(groupId, params);
  }

  const payload = await requestJson<ApiAdminStudyMeetingsListData>({
    path: buildMeetingsPath(groupId, params),
  });

  if (!payload.data || !Array.isArray(payload.data.items) || !payload.meta) {
    throw invalidEnvelopeError();
  }

  return {
    items: payload.data.items.map(mapAdminStudyMeeting),
    meta: mapListMeta(payload.meta),
  };
};

export const getAdminStudyMeeting = async (
  groupId: string,
  meetingId: string,
): Promise<AdminStudyMeeting> => {
  if (isDemoReadOnlyMode()) {
    const meeting = getMockAdminStudyMeeting(groupId, meetingId);

    if (!meeting) {
      throw demoNotFoundError();
    }

    return meeting;
  }

  const payload = await requestJson<unknown>({
    path: buildMeetingPath(groupId, meetingId),
  });

  if (!payload.data) {
    throw invalidEnvelopeError();
  }

  return mapAdminStudyMeeting(payload.data);
};

export const createAdminStudyMeeting = async (
  groupId: string,
  input: CreateAdminStudyMeetingInput,
): Promise<AdminStudyMeeting> => {
  if (isDemoReadOnlyMode()) {
    throw demoReadOnlyError();
  }

  const payload = await requestJson<unknown>({
    path: `/api/admin/groups/${encodeURIComponent(groupId)}/meetings`,
    init: {
      method: "POST",
      body: JSON.stringify(input),
    },
  });

  if (!payload.data) {
    throw invalidEnvelopeError();
  }

  return mapAdminStudyMeeting(payload.data);
};

export const updateAdminStudyMeeting = async (
  groupId: string,
  meetingId: string,
  input: UpdateAdminStudyMeetingInput,
): Promise<AdminStudyMeeting> => {
  if (isDemoReadOnlyMode()) {
    throw demoReadOnlyError();
  }

  const payload = await requestJson<unknown>({
    path: buildMeetingPath(groupId, meetingId),
    init: {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  });

  if (!payload.data) {
    throw invalidEnvelopeError();
  }

  return mapAdminStudyMeeting(payload.data);
};

export const cancelAdminStudyMeeting = async (
  groupId: string,
  meetingId: string,
  input: CancelAdminStudyMeetingInput,
): Promise<AdminStudyMeeting> => {
  if (isDemoReadOnlyMode()) {
    throw demoReadOnlyError();
  }

  const payload = await requestJson<unknown>({
    path: `${buildMeetingPath(groupId, meetingId)}/cancel`,
    init: {
      method: "POST",
      body: JSON.stringify(input),
    },
  });

  if (!payload.data) {
    throw invalidEnvelopeError();
  }

  return mapAdminStudyMeeting(payload.data);
};
