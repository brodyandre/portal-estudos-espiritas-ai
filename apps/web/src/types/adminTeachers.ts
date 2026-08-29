import type { AdminSelectableGroup } from "./adminGroups";
import type { AdminUserListItem, AdminUserTeacherGroupSummary } from "./adminUsersList";

export type TeacherOperationalState =
  | "all"
  | "active"
  | "awaiting_activation"
  | "inactive"
  | "attention";

export interface CreateAdminTeacherInput {
  fullName: string;
  email: string;
  groupIds: string[];
}

export interface AdminTeacherCreateResult {
  user: {
    id: string;
    fullName: string;
    role: "teacher";
    status: "active";
    accountActivated: false;
  };
  groups: AdminUserTeacherGroupSummary[];
}

export interface AdminPedagogicalGroupsResult {
  user: {
    id: string;
    groups: AdminUserTeacherGroupSummary[];
  };
}

export interface AdminTeacherInvitationResult {
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  invitation: {
    expiresAt: string;
    deliveryStatus: "pending" | "sent" | "failed" | "not_configured";
    invitationType: "admin_reinvite";
  };
}

export type TeacherListItem = AdminUserListItem & {
  role: "teacher";
};

export interface TeacherGroupOptionsState {
  status: "idle" | "loading" | "success" | "error";
  items: AdminSelectableGroup[];
  message?: string;
  source?: "api" | "demo";
}
