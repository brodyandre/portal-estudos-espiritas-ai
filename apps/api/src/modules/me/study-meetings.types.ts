export const DEFAULT_USER_STUDY_MEETINGS_LIMIT = 3;
export const MIN_USER_STUDY_MEETINGS_LIMIT = 1;
export const MAX_USER_STUDY_MEETINGS_LIMIT = 10;

export type UserStudyMeetingStatus = "ongoing" | "scheduled";

export interface UserStudyMeetingUserGroupRecord {
  groupName: string | null;
  groupSlug: string | null;
}

export interface UserStudyMeetingGroupRecord {
  id: string;
  name: string;
  status: "active" | "inactive";
  meetUrl: string;
  bookTitle: string;
}

export interface UserStudyMeetingRecord {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
}

export interface ListUpcomingUserStudyMeetingsInput {
  limit: number;
}

export interface UserStudyMeetingGroupSummary {
  id: string;
  name: string;
  status: "active" | "inactive";
  bookTitle: string;
}

export interface UserStudyMeetingListItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: UserStudyMeetingStatus;
  meetUrl: string;
  group: UserStudyMeetingGroupSummary;
}

export interface UserStudyMeetingListResult {
  group: UserStudyMeetingGroupSummary | null;
  groups: UserStudyMeetingGroupSummary[];
  items: UserStudyMeetingListItem[];
  limit: number;
}
