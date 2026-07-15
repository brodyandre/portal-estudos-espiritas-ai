import type { UserStudyMeetingListResult } from "./study-meetings.types";

export const presentUpcomingUserStudyMeetings = (
  result: UserStudyMeetingListResult,
) => ({
  group: result.group,
  items: result.items.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    status: meeting.status,
    meetUrl: meeting.meetUrl,
  })),
});
