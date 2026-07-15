import type { StudyMeetingListResult, StudyMeetingRecord } from "./study-meetings.types";

export interface StudyMeetingPresenterOutput {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  canceledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export const presentStudyMeeting = (
  meeting: StudyMeetingRecord,
): StudyMeetingPresenterOutput => ({
  id: meeting.id,
  groupId: meeting.groupId,
  title: meeting.title,
  description: meeting.description,
  startsAt: meeting.startsAt,
  endsAt: meeting.endsAt,
  canceledAt: meeting.canceledAt,
  cancellationReason: meeting.cancellationReason,
  createdAt: meeting.createdAt,
  updatedAt: meeting.updatedAt,
});

export const presentStudyMeetingList = (result: StudyMeetingListResult) => ({
  items: result.items.map(presentStudyMeeting),
  meta: {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  },
});
