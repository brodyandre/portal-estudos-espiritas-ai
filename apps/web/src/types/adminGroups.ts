import type { GroupSlug } from "../mocks";

export type AdminGroupStatus = "active" | "inactive";

export interface AdminGroup {
  id: GroupSlug;
  name: string;
  bookTitle: string;
  teacherName: string;
  meetingDay: string;
  meetingTime: string;
  status: AdminGroupStatus;
  meetUrl: string;
  demoMeetUrl: string;
  welcomeMessage: string;
}

export interface AdminGroupUpdateInput {
  name: string;
  bookTitle: string;
  teacherName: string;
  meetingDay: string;
  meetingTime: string;
  welcomeMessage: string;
}
