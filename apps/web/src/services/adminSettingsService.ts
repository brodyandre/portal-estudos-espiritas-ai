import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
import { getMockAdminSettings, updateMockAdminSettings } from "../mocks/adminSettings";
import { loadWithFallback } from "./api";
import type { AdminSettings } from "../types/adminSettings";

const FALLBACK_NOTICE =
  "Modo demonstrativo: as configurações ficam salvas apenas neste navegador até existir backend autenticado.";

export const getAdminSettings = () => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: getMockAdminSettings(),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<AdminSettings, AdminSettings>({
    path: "/api/admin/settings",
    fallback: () => getMockAdminSettings(),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const saveAdminSettings = (input: AdminSettings) => {
  if (!appConfig.canUseAdminFeatures) {
    return Promise.resolve({
      data: updateMockAdminSettings(input),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<AdminSettings, AdminSettings>({
    path: "/api/admin/settings",
    init: {
      method: "PUT",
      body: JSON.stringify(input),
    },
    fallback: () => updateMockAdminSettings(input),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

