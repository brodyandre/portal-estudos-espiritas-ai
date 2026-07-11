export const USER_ROLES = ["visitor", "student", "teacher", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["pending", "active", "inactive", "rejected"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const APP_PERMISSIONS = [
  "manage_users",
  "manage_groups",
  "manage_content",
  "manage_settings",
  "view_audit",
  "review_enrollments",
  "manage_lessons",
  "draft_content",
  "review_sensitive_answers",
  "view_students",
  "view_student_area",
  "view_meet_link",
  "view_materials",
  "ask_assistant",
  "view_public_pages",
  "submit_enrollment",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export const ROUTE_TYPES = ["public", "student", "teacher", "admin"] as const;

export type RouteType = (typeof ROUTE_TYPES)[number];

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  permissions: AppPermission[];
}
