export type UserStudyMeetingStatus = "ongoing" | "scheduled";
export type UserStudyMeetingGroupStatus = "active" | "inactive";

export interface UserStudyMeetingGroup {
  id: string;
  name: string;
  status: UserStudyMeetingGroupStatus;
}

export interface UserStudyMeeting {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: UserStudyMeetingStatus;
  meetUrl: string | null;
}

export interface UserStudyMeetingsResponse {
  group: UserStudyMeetingGroup | null;
  items: UserStudyMeeting[];
}

export interface UserStudyMeetingsResult extends UserStudyMeetingsResponse {
  limit: number;
  source: "api" | "mock";
  notice: string | null;
}
