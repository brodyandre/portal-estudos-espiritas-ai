import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
import type {
  AdminAuditLogEntry,
  AdminPasswordResetResult,
  AdminManagedRole,
  AdminManagedUser,
  AdminUserActionInput,
} from "../types/adminUsers";
import {
  listMockAdminAuditEntries,
  listMockAdminUsers,
  runMockAdminPasswordReset,
  runMockAdminUserAction,
} from "../mocks/adminUsers";
import { ServiceRequestError, loadWithFallback, requestJson } from "./api";

interface ApiAdminUser {
  id: string;
  fullName: string;
  email: string;
  role: AdminManagedRole;
  status: AdminManagedUser["status"];
  groupName: string;
  groupSlug: AdminManagedUser["groupSlug"];
  createdAt: string;
  adminNote: string;
  mustChangePassword?: boolean;
  temporaryPasswordGeneratedAt?: string | null;
}

interface ApiAdminActionResponse {
  user: ApiAdminUser;
  auditEntry: AdminAuditLogEntry;
}

const FALLBACK_NOTICE =
  "Modo demonstrativo: para gestão real de usuários, use backend autenticado no ambiente local.";

const mapAdminUser = (item: ApiAdminUser): AdminManagedUser => {
  return {
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    role: item.role,
    status: item.status,
    groupName: item.groupName,
    groupSlug: item.groupSlug,
    createdAt: item.createdAt,
    adminNote: item.adminNote,
    mustChangePassword: item.mustChangePassword,
    temporaryPasswordGeneratedAt: item.temporaryPasswordGeneratedAt ?? null,
  };
};

interface ApiAdminPasswordResetResponse {
  user: ApiAdminUser;
  temporaryPassword: string;
}

export const listAdminUsers = (filters?: {
  role?: AdminManagedRole;
  status?: AdminManagedUser["status"];
}) => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: listMockAdminUsers(filters),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiAdminUser[], AdminManagedUser[]>({
    path: "/api/admin/users",
    query: {
      role: filters?.role,
      status: filters?.status,
    },
    fallback: () => listMockAdminUsers(filters),
    mapData: (items) => items.map(mapAdminUser),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const listAdminAuditEntries = (limit = 6) => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: listMockAdminAuditEntries(limit),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<AdminAuditLogEntry[], AdminAuditLogEntry[]>({
    path: "/api/admin/audit",
    query: {
      limit: String(limit),
    },
    fallback: () => listMockAdminAuditEntries(limit),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const runAdminUserAction = (id: string, input: AdminUserActionInput) => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: runMockAdminUserAction(id, input),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiAdminActionResponse, { user: AdminManagedUser | null; auditEntry: AdminAuditLogEntry | null }>({
    path: `/api/admin/users/${id}`,
    init: {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    fallback: () => runMockAdminUserAction(id, input),
    mapData: (payload) => ({
      user: mapAdminUser(payload.user),
      auditEntry: payload.auditEntry,
    }),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const resetAdminUserPassword = async (id: string): Promise<{
  data: AdminPasswordResetResult;
  source: "api" | "mock";
  notice: string | null;
}> => {
  if (!appConfig.canUseAdminFeatures) {
    return {
      data: runMockAdminPasswordReset(id),
      source: "mock",
      notice: DEMO_MODE_NOTICE,
    };
  }

  try {
    const payload = await requestJson<ApiAdminPasswordResetResponse>({
      path: `/api/admin/users/${id}/reset-password`,
      init: {
        method: "POST",
      },
    });

    return {
      data: {
        user: mapAdminUser(payload.data.user),
        temporaryPassword: payload.data.temporaryPassword,
      },
      source: "api",
      notice: null,
    };
  } catch (error) {
    if (error instanceof ServiceRequestError && error.kind === "network") {
      return {
        data: runMockAdminPasswordReset(id),
        source: "mock",
        notice: DEMO_MODE_NOTICE,
      };
    }

    throw error;
  }
};
