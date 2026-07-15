import { AppError } from "../../lib/app-error";
import {
  STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH,
  STUDY_MEETING_DESCRIPTION_MAX_LENGTH,
  STUDY_MEETING_TITLE_MAX_LENGTH,
  type CancelAdminStudyMeetingInput,
  type CreateAdminStudyMeetingInput,
  type UpdateAdminStudyMeetingInput,
} from "./study-meetings.types";

const CREATE_KEYS = new Set(["title", "description", "startsAt", "endsAt"]);
const UPDATE_KEYS = CREATE_KEYS;
const CANCEL_KEYS = new Set(["cancellationReason"]);
const ISO_8601_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;

const buildInvalidInputError = (code: string, message: string, field?: string) =>
  new AppError({
    statusCode: 400,
    code,
    message,
    details: field ? { field } : undefined,
  });

const buildCreateInputError = (field?: string) =>
  buildInvalidInputError(
    "INVALID_STUDY_MEETING_INPUT",
    "Revise os dados do encontro para continuar.",
    field,
  );

const buildUpdateInputError = (field?: string) =>
  buildInvalidInputError(
    "INVALID_STUDY_MEETING_UPDATE_INPUT",
    "Informe ao menos um campo válido para atualizar o encontro.",
    field,
  );

const buildCancelInputError = (field?: string) =>
  buildInvalidInputError(
    "INVALID_STUDY_MEETING_CANCEL_INPUT",
    "Informe um motivo válido para cancelar o encontro.",
    field,
  );

const isPlainObject = (body: unknown): body is Record<string, unknown> =>
  typeof body === "object" &&
  body !== null &&
  !Array.isArray(body) &&
  Object.getPrototypeOf(body) === Object.prototype;

const assertPlainBody = (
  body: unknown,
  buildError: (field?: string) => AppError,
) => {
  if (!isPlainObject(body)) {
    throw buildError();
  }

  return body;
};

const assertKnownKeys = (
  body: Record<string, unknown>,
  allowedKeys: Set<string>,
  buildError: (field?: string) => AppError,
) => {
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      throw buildError(key);
    }
  }
};

const parseRequiredString = (
  value: unknown,
  field: "title" | "cancellationReason",
  maxLength: number,
  buildError: (field?: string) => AppError,
) => {
  if (typeof value !== "string") {
    throw buildError(field);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.length > maxLength) {
    throw buildError(field);
  }

  return trimmedValue;
};

const parseOptionalDescription = (
  value: unknown,
  buildError: (field?: string) => AppError,
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw buildError("description");
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length > STUDY_MEETING_DESCRIPTION_MAX_LENGTH) {
    throw buildError("description");
  }

  return trimmedValue ? trimmedValue : null;
};

const parseIsoDateWithTimezone = (
  value: unknown,
  field: "startsAt" | "endsAt",
  buildError: (field?: string) => AppError,
) => {
  if (typeof value !== "string" || !ISO_8601_WITH_TIMEZONE.test(value)) {
    throw buildError(field);
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw buildError(field);
  }

  return parsedDate.toISOString();
};

export const parseCreateStudyMeetingBody = (
  groupId: string,
  body: unknown,
): CreateAdminStudyMeetingInput => {
  const payload = assertPlainBody(body, buildCreateInputError);
  assertKnownKeys(payload, CREATE_KEYS, buildCreateInputError);

  if (!Object.prototype.hasOwnProperty.call(payload, "title")) {
    throw buildCreateInputError("title");
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "startsAt")) {
    throw buildCreateInputError("startsAt");
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "endsAt")) {
    throw buildCreateInputError("endsAt");
  }

  return {
    groupId,
    title: parseRequiredString(
      payload.title,
      "title",
      STUDY_MEETING_TITLE_MAX_LENGTH,
      buildCreateInputError,
    ),
    description: parseOptionalDescription(payload.description, buildCreateInputError),
    startsAt: parseIsoDateWithTimezone(payload.startsAt, "startsAt", buildCreateInputError),
    endsAt: parseIsoDateWithTimezone(payload.endsAt, "endsAt", buildCreateInputError),
  };
};

export const parseUpdateStudyMeetingBody = (
  groupId: string,
  meetingId: string,
  body: unknown,
): UpdateAdminStudyMeetingInput => {
  const payload = assertPlainBody(body, buildUpdateInputError);
  assertKnownKeys(payload, UPDATE_KEYS, buildUpdateInputError);

  const input: UpdateAdminStudyMeetingInput = {
    groupId,
    meetingId,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    input.title = parseRequiredString(
      payload.title,
      "title",
      STUDY_MEETING_TITLE_MAX_LENGTH,
      buildUpdateInputError,
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    input.description = parseOptionalDescription(payload.description, buildUpdateInputError);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "startsAt")) {
    input.startsAt = parseIsoDateWithTimezone(
      payload.startsAt,
      "startsAt",
      buildUpdateInputError,
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, "endsAt")) {
    input.endsAt = parseIsoDateWithTimezone(payload.endsAt, "endsAt", buildUpdateInputError);
  }

  if (
    input.title === undefined &&
    input.description === undefined &&
    input.startsAt === undefined &&
    input.endsAt === undefined
  ) {
    throw buildUpdateInputError();
  }

  return input;
};

export const parseCancelStudyMeetingBody = (
  groupId: string,
  meetingId: string,
  body: unknown,
): CancelAdminStudyMeetingInput => {
  const payload = assertPlainBody(body, buildCancelInputError);
  assertKnownKeys(payload, CANCEL_KEYS, buildCancelInputError);

  if (!Object.prototype.hasOwnProperty.call(payload, "cancellationReason")) {
    throw buildCancelInputError("cancellationReason");
  }

  return {
    groupId,
    meetingId,
    cancellationReason: parseRequiredString(
      payload.cancellationReason,
      "cancellationReason",
      STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH,
      buildCancelInputError,
    ),
  };
};
