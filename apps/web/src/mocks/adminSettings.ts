import { appConfig } from "../config/appMode";
import type { AdminPublicationMode, AdminSettings } from "../types/adminSettings";

const SETTINGS_STORAGE_KEY = "portal-estudos-espiritas-ai:admin-settings";

const isBrowser = () => {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
};

const getDefaultPublicUrl = () => {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/`;
  }

  return "https://seu-usuario.github.io/portal-estudos-espiritas-ai/";
};

const getPublicationMode = (): AdminPublicationMode => {
  if (appConfig.appMode === "local") {
    return "local";
  }

  return "demonstrativo";
};

const seededSettings: AdminSettings = {
  institutionName: "Centro Espírita Ana Vieira",
  portalName: "Educação Continuada",
  publicPagesUrl: getDefaultPublicUrl(),
  recommendedQrCodeUrl: `${getDefaultPublicUrl()}#/educacao-continuada`,
  enrollmentMessage:
    "Sua solicitação foi recebida. Os professores revisarão seu cadastro e enviarão a confirmação de acesso.",
  approvalMessage:
    "Cadastro aprovado. O aluno já pode acessar a área do estudante e acompanhar os materiais publicados.",
  whatsappMessage:
    "Olá! Recebemos sua inscrição para a Educação Continuada Online. Em breve enviaremos a confirmação de acesso pelo portal.",
  publicationMode: getPublicationMode(),
};

const cloneSettings = (settings: AdminSettings): AdminSettings => ({
  ...settings,
});

const readStoredSettings = (): AdminSettings | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminSettings) : null;
  } catch (_error) {
    return null;
  }
};

const writeStoredSettings = (settings: AdminSettings) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export const getMockAdminSettings = (): AdminSettings => {
  return cloneSettings(readStoredSettings() ?? seededSettings);
};

export const updateMockAdminSettings = (input: AdminSettings): AdminSettings => {
  writeStoredSettings(input);
  return cloneSettings(input);
};

export const resetMockAdminSettings = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(SETTINGS_STORAGE_KEY);
};

