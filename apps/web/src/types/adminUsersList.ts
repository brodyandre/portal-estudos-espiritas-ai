import type { UserRole, UserStatus } from "../auth/types";

export type AdminUserListRole = UserRole;
export type AdminUserListStatus = UserStatus;
export type AdminUserActivationStatus = "activated" | "not_activated";
export type AdminUserListSortBy = "name" | "createdAt" | "role" | "status";
export type AdminUserListSortOrder = "asc" | "desc";
export type AdminUsersListSource = "api" | "demo";

export interface AdminUserGroupSummary {
  name: string;
  slug: string;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  emailMasked: string;
  role: AdminUserListRole;
  status: AdminUserListStatus;
  activationStatus: AdminUserActivationStatus;
  group: AdminUserGroupSummary | null;
  createdAt: string;
}

export interface AdminUserListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUserListParams {
  page?: number | null;
  pageSize?: number | null;
  search?: string | null;
  role?: AdminUserListRole | null;
  status?: AdminUserListStatus | null;
  activationStatus?: AdminUserActivationStatus | null;
  group?: string | null;
  sortBy?: AdminUserListSortBy | null;
  sortOrder?: AdminUserListSortOrder | null;
}

export interface AdminUsersListResult {
  items: AdminUserListItem[];
  meta: AdminUserListMeta;
  source: AdminUsersListSource;
}
