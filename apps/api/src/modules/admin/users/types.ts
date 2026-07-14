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

export interface AdminUserListItem {
  id: string;
  name: string;
  emailMasked: string;
  role: UserRole;
  status: UserStatus;
  activationStatus: AdminUserActivationStatus;
  group: AdminUserGroupSummary | null;
  createdAt: Date;
}

export interface UpdateAdminUserStatusInput {
  status: AdminUserStatusMutation;
}

export interface UpdateAdminUserStatusResult {
  user: {
    id: string;
    status: AdminUserStatusMutation;
  };
  revokedSessions: number;
}

export type ListAdminUsersInput = AdminUserListInput;

export interface ListAdminUsersResult
  extends Omit<AdminUserListResult, "records"> {
  items: AdminUserListItem[];
}
