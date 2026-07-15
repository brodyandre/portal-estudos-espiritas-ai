import type { UserStudyMeeting } from "../types/userStudyMeetings";

const UNAVAILABLE_DATE_LABEL = "Data indisponível";

const meetingDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const meetingTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const toDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const formatUserMeetingStart = (value: string) => {
  const date = toDate(value);

  if (!date) {
    return UNAVAILABLE_DATE_LABEL;
  }

  return capitalize(meetingDateFormatter.format(date).replace(",", ""));
};

export const formatUserMeetingTimeRange = (meeting: Pick<UserStudyMeeting, "startsAt" | "endsAt">) => {
  const startsAt = toDate(meeting.startsAt);
  const endsAt = toDate(meeting.endsAt);

  if (!startsAt || !endsAt) {
    return UNAVAILABLE_DATE_LABEL;
  }

  return `${meetingTimeFormatter.format(startsAt)} - ${meetingTimeFormatter.format(endsAt)}`;
};

export const getUserMeetingDurationMinutes = (
  meeting: Pick<UserStudyMeeting, "startsAt" | "endsAt">,
) => {
  const startsAt = toDate(meeting.startsAt)?.getTime();
  const endsAt = toDate(meeting.endsAt)?.getTime();

  if (startsAt === undefined || endsAt === undefined) {
    return null;
  }

  const durationMinutes = Math.round((endsAt - startsAt) / 60000);

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null;
  }

  return durationMinutes;
};
