import type { GroupSlug } from "../mocks";
import type { AdminUserGroupSummary } from "./adminUsersList";

export type AdminGroupStatus = "active" | "inactive";
export type AdminGroupsListStatus = AdminGroupStatus | "all";

export interface AdminSelectableGroup extends AdminUserGroupSummary {
  status: AdminGroupStatus;
}

export interface AdminSelectableGroupsResult {
  items: AdminSelectableGroup[];
  source: "api" | "demo";
}

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
