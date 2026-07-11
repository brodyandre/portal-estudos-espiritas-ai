import { useSyncExternalStore } from "react";

import { appConfig } from "../config/appMode";
import type { AppUser, UserRole } from "../auth/types";
import { getRolePermissions } from "../auth/roles";

const CURRENT_USER_STORAGE_KEY = "portal-estudos-espiritas-ai:current-user-role";

const subscribers = new Set<() => void>();

const createUser = (role: UserRole, fullName: string): AppUser => ({
  id: `${role}-demo`,
  fullName,
  role,
  status: "active",
  permissions: getRolePermissions(role),
});

const mockUsersByRole: Record<UserRole, AppUser> = {
  visitor: createUser("visitor", "Visitante demonstrativo"),
  student: createUser("student", "Aluno demonstrativo"),
  teacher: createUser("teacher", "Professor demonstrativo"),
  admin: createUser("admin", "Admin demonstrativo"),
};

const canSwitchMockUser =
  import.meta.env.DEV || import.meta.env.MODE === "test" || appConfig.appMode === "demo";

const getDefaultRole = (): UserRole => {
  return appConfig.appMode === "local" ? "teacher" : "visitor";
};

const readStoredRole = (): UserRole | null => {
  if (!canSwitchMockUser || typeof window === "undefined") {
    return null;
  }

  try {
    const rawRole = window.sessionStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return rawRole && rawRole in mockUsersByRole ? (rawRole as UserRole) : null;
  } catch (_error) {
    return null;
  }
};

const emitChange = () => {
  for (const subscriber of subscribers) {
    subscriber();
  }
};

export const getCurrentUserMock = (): AppUser => {
  const role = readStoredRole() ?? getDefaultRole();
  return mockUsersByRole[role];
};

export const setCurrentUserRole = (role: UserRole) => {
  if (!canSwitchMockUser || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, role);
  emitChange();
};

export const clearCurrentUserRole = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  emitChange();
};

export const getAvailableMockUsers = () => {
  return Object.values(mockUsersByRole);
};

export const useCurrentUserMock = () => {
  return useSyncExternalStore(
    (callback) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    getCurrentUserMock,
    getCurrentUserMock,
  );
};

export { canSwitchMockUser, mockUsersByRole };
