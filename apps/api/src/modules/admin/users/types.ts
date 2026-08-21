import type { UserRole, UserStatus } from "../../../auth/types";
import type {
  AdminUserListInput,
  AdminUserListResult,
} from "../../auth/auth.repository";

export type AdminUserActivationStatus = "activated" | "not_activated";
export type AdminUserSortField = "name" | "createdAt" | "role" | "status";
export type AdminUserSortOrder = "asc" | "desc";
export type AdminUserStatusMutation = "active" | "inactive";

export interface AdminUserGroupSummary {
  name: string;
  slug: string;
}

export interface AdminUserTeacherGroupSummary extends AdminUserGroupSummary {
  status: "active" | "inactive";
}

export interface AdminUserListItem {
  id: string;
  name: string;
  emailMasked: string;
  role: UserRole;
  status: UserStatus;
  activationStatus: AdminUserActivationStatus;
  group: AdminUserGroupSummary | null;
  teacherGroups: AdminUserTeacherGroupSummary[];
  createdAt: Date;
}

export interface UpdateAdminUserStatusInput {
  status: AdminUserStatusMutation;
}

export interface UpdateAdminUserGroupInput {
  groupSlug: string | null;
}

export interface UpdateAdminUserTeacherGroupsInput {
  groupIds: string[];
}

export interface UpdateAdminUserStatusResult {
  user: {
    id: string;
    status: AdminUserStatusMutation;
  };
  revokedSessions: number;
}

export interface UpdateAdminUserGroupResult {
  user: {
    id: string;
    group: AdminUserGroupSummary | null;
  };
}

export interface AdminUserTeacherGroupsResult {
  user: {
    id: string;
    groups: AdminUserTeacherGroupSummary[];
  };
}

export type ListAdminUsersInput = AdminUserListInput;

export interface ListAdminUsersResult
  extends Omit<AdminUserListResult, "records"> {
  items: AdminUserListItem[];
}
