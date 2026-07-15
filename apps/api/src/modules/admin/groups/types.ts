export type AdminGroupsQueryStatus = "active" | "inactive" | "all";

export interface AdminSelectableGroup {
  name: string;
  slug: string;
  status: "active" | "inactive";
}

export interface ListAdminGroupsInput {
  status: AdminGroupsQueryStatus;
}

export interface ListAdminGroupsResult {
  items: AdminSelectableGroup[];
}
