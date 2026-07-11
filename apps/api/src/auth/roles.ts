import type { AppPermission, AppUser, RouteType, UserRole } from "./types";

const rolePermissionsMap: Record<UserRole, AppPermission[]> = {
  admin: [
    "manage_users",
    "manage_groups",
    "manage_content",
    "manage_settings",
    "view_audit",
    "review_enrollments",
  ],
  teacher: [
    "review_enrollments",
    "manage_lessons",
    "draft_content",
    "review_sensitive_answers",
    "view_students",
  ],
  student: [
    "view_student_area",
    "view_meet_link",
    "view_materials",
    "ask_assistant",
  ],
  visitor: [
    "view_public_pages",
    "submit_enrollment",
  ],
};

const routeRoleAccess: Record<RouteType, UserRole[]> = {
  public: ["visitor", "student", "teacher", "admin"],
  student: ["student", "teacher", "admin"],
  teacher: ["teacher", "admin"],
  admin: ["admin"],
};

const isActiveUser = (user: AppUser) => user.status === "active";

export const getRolePermissions = (role: UserRole) => {
  return [...rolePermissionsMap[role]];
};

export const hasRole = (user: AppUser | null | undefined, role: UserRole) => {
  return user ? user.role === role : false;
};

export const hasPermission = (user: AppUser | null | undefined, permission: AppPermission) => {
  if (!user) {
    return false;
  }

  const permissions = new Set([...getRolePermissions(user.role), ...user.permissions]);
  return permissions.has(permission);
};

export const canAccessRoute = (user: AppUser | null | undefined, routeType: RouteType) => {
  if (routeType === "public") {
    return true;
  }

  if (!user || !isActiveUser(user)) {
    return false;
  }

  return routeRoleAccess[routeType].includes(user.role);
};
