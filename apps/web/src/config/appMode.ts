const DEFAULT_LOCAL_API_URL = "http://localhost:3333";

const normalizeBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["1", "true", "yes", "on", "sim"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off", "nao", "não"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const baseUrl = import.meta.env.BASE_URL ?? "/";
const hasGithubPagesBase = baseUrl !== "/";
const hasGithubPagesHost =
  typeof window !== "undefined" ? window.location.hostname.endsWith("github.io") : false;

const rawMode = import.meta.env.VITE_APP_MODE?.trim().toLowerCase();
const isGithubPages = hasGithubPagesBase || hasGithubPagesHost;

const appMode =
  rawMode === "demo" || rawMode === "local"
    ? rawMode
    : isGithubPages
      ? "demo"
      : "local";

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiUrl = (rawApiUrl || (appMode === "local" ? DEFAULT_LOCAL_API_URL : "")).trim() || null;

const canShowRealMeetLink =
  appMode === "local" && normalizeBoolean(import.meta.env.VITE_SHOW_REAL_MEET_LINK, true);

const canUseAdminFeatures =
  appMode === "local" && normalizeBoolean(import.meta.env.VITE_ENABLE_ADMIN_FEATURES, true);

const canUseTeacherFeatures =
  appMode === "local" && normalizeBoolean(import.meta.env.VITE_ENABLE_TEACHER_FEATURES, true);

const canUseStudentPrivateArea = appMode === "local";

export const DEMO_MODE_NOTICE =
  "Modo demonstrativo: dados reais e aprovações ficam disponíveis apenas no ambiente local autorizado.";

export const PUBLIC_MEET_NOTICE = "O link da aula não é exibido nesta versão pública.";

export const appConfig = {
  appMode,
  apiUrl,
  isGithubPages,
  canShowRealMeetLink,
  canUseAdminFeatures,
  canUseTeacherFeatures,
  canUseStudentPrivateArea,
} as const;

export const getMeetLinkForMode = (meetUrl?: string | null) => {
  return appConfig.canShowRealMeetLink && meetUrl ? meetUrl : null;
};

export const getSafeMeetButtonLabel = () => {
  return appConfig.canShowRealMeetLink ? "Entrar no Google Meet" : "Link da aula indisponível";
};
