import type { GroupSlug } from "../mocks";
import type { UserStatus } from "../auth/types";

export type AdminManagedRole = "student" | "teacher" | "admin";

export interface AdminManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: AdminManagedRole;
  status: UserStatus;
  groupName: string;
  groupSlug: GroupSlug | null;
  createdAt: string;
  adminNote: string;
  mustChangePassword?: boolean;
  temporaryPasswordGeneratedAt?: string | null;
}

export type AdminUserActionType =
  | "activate"
  | "deactivate"
  | "change_role"
  | "link_group"
  | "add_note";

export interface AdminAuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  actionType: AdminUserActionType;
  summary: string;
  createdAt: string;
  actorName: string;
}

export interface AdminPasswordResetResult {
  user: AdminManagedUser | null;
  temporaryPassword: string | null;
}

export type AdminUserActionInput =
  | {
      type: "activate";
    }
  | {
      type: "deactivate";
    }
  | {
      type: "change_role";
      role: AdminManagedRole;
    }
  | {
      type: "link_group";
      groupName: string;
      groupSlug: GroupSlug | null;
    }
  | {
      type: "add_note";
      note: string;
    };
