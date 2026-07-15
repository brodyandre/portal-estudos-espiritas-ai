import type {
  AdminStudyMeeting,
  AdminStudyMeetingDerivedStatus,
} from "../types/adminStudyMeetings";

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toValidDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Data inválida.");
  }

  return date;
};

export const getAdminStudyMeetingDerivedStatus = (
  meeting: AdminStudyMeeting,
  now: Date = new Date(),
): AdminStudyMeetingDerivedStatus => {
  if (meeting.canceledAt !== null) {
    return "canceled";
  }

  const nowTime = now.getTime();
  const startsAtTime = toValidDate(meeting.startsAt).getTime();
  const endsAtTime = toValidDate(meeting.endsAt).getTime();

  if (Number.isNaN(nowTime)) {
    throw new RangeError("Data inválida.");
  }

  if (endsAtTime <= nowTime) {
    return "ended";
  }

  if (startsAtTime <= nowTime && nowTime < endsAtTime) {
    return "in_progress";
  }

  return "scheduled";
};

export const canEditAdminStudyMeeting = (
  meeting: AdminStudyMeeting,
  now: Date = new Date(),
) => getAdminStudyMeetingDerivedStatus(meeting, now) === "scheduled";

export const canCancelAdminStudyMeeting = (
  meeting: AdminStudyMeeting,
  now: Date = new Date(),
) => getAdminStudyMeetingDerivedStatus(meeting, now) === "scheduled";

export const datetimeLocalToIso = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new RangeError("Data obrigatória.");
  }

  return toValidDate(trimmedValue).toISOString();
};

export const isoToDatetimeLocalValue = (value: string) => {
  const date = toValidDate(value);

  return [
    date.getFullYear(),
    "-",
    padDatePart(date.getMonth() + 1),
    "-",
    padDatePart(date.getDate()),
    "T",
    padDatePart(date.getHours()),
    ":",
    padDatePart(date.getMinutes()),
  ].join("");
};
