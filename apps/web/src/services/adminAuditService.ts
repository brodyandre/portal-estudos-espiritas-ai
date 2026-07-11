import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
import { listMockAdminAuditEvents } from "../mocks/adminAudit";
import { loadWithFallback } from "./api";
import type { AdminAuditEvent } from "../types/adminAudit";

const FALLBACK_NOTICE =
  "Modo demonstrativo: a auditoria real deve vir do backend autenticado, mas os eventos do MVP seguem visíveis para revisão.";

export const listAdminAuditEvents = () => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: listMockAdminAuditEvents(),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<AdminAuditEvent[], AdminAuditEvent[]>({
    path: "/api/admin/audit/events",
    fallback: () => listMockAdminAuditEvents(),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

