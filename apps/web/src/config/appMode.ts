export type AppMode = "demo" | "local";

export interface WebConfigSource {
  [key: string]: string | undefined;
  BASE_URL?: string;
  MODE?: string;
  VITE_APP_MODE?: string;
  VITE_API_URL?: string;
  VITE_SHOW_REAL_MEET_LINK?: string;
  VITE_ENABLE_ADMIN_FEATURES?: string;
  VITE_ENABLE_TEACHER_FEATURES?: string;
}

export interface WebConfigContext {
  hostname?: string;
}

const DEFAULT_LOCAL_API_URL = "http://localhost:3333";
const KNOWN_MODES = new Set<AppMode>(["demo", "local"]);
const SENSITIVE_ENV_PATTERN = /(JWT_SECRET|DATABASE_URL|SMTP.*PASSWORD|TOKEN|API_SECRET|SECRET)/iu;

const normalizeBoolean = (name: string, value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error(`${name} deve ser "true" ou "false".`);
};

const resolveMode = (source: WebConfigSource, context: WebConfigContext): AppMode => {
  const rawMode = source.VITE_APP_MODE?.trim().toLowerCase();

  if (rawMode) {
    if (KNOWN_MODES.has(rawMode as AppMode)) {
      return rawMode as AppMode;
    }

    throw new Error('VITE_APP_MODE deve ser "local" ou "demo".');
  }

  const baseUrl = source.BASE_URL ?? "/";
  const isGithubPages =
    baseUrl !== "/" || Boolean(context.hostname?.endsWith("github.io"));

  return isGithubPages ? "demo" : "local";
};

const isLoopbackHostname = (hostname: string) => {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "[::1]" ||
    normalizedHostname === "::1" ||
    /^127\./u.test(normalizedHostname)
  );
};

const sanitizeUrlForError = (value: string) => {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch (_error) {
    return "<url-invalida>";
  }
};

const normalizeApiUrl = (value: string | undefined, mode: AppMode, isProductionBuild: boolean) => {
  const rawValue = value?.trim() ?? "";

  if (!rawValue) {
    if (mode === "demo") {
      return null;
    }

    if (!isProductionBuild) {
      return DEFAULT_LOCAL_API_URL;
    }

    throw new Error("VITE_API_URL é obrigatória para build de produção em modo local.");
  }

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch (_error) {
    throw new Error("VITE_API_URL deve ser uma URL absoluta válida.");
  }

  if (url.username || url.password) {
    throw new Error("VITE_API_URL não deve conter credenciais.");
  }

  if (url.search) {
    throw new Error("VITE_API_URL não deve conter query string.");
  }

  if (url.hash) {
    throw new Error("VITE_API_URL não deve conter hash.");
  }

  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("VITE_API_URL deve conter apenas a origem, sem path.");
  }

  if (isProductionBuild && url.protocol !== "https:") {
    throw new Error("VITE_API_URL deve usar HTTPS em build de produção.");
  }

  if (isProductionBuild && isLoopbackHostname(url.hostname)) {
    throw new Error("VITE_API_URL não deve usar localhost ou loopback em build de produção.");
  }

  if (SENSITIVE_ENV_PATTERN.test(rawValue)) {
    throw new Error(`VITE_API_URL contém valor com aparência sensível: ${sanitizeUrlForError(rawValue)}.`);
  }

  return url.origin;
};

export const buildWebConfig = (
  source: WebConfigSource,
  context: WebConfigContext = {},
) => {
  for (const key of Object.keys(source)) {
    if (key.startsWith("VITE_") && SENSITIVE_ENV_PATTERN.test(key)) {
      throw new Error(`${key} não deve ser exposta em variáveis públicas Vite.`);
    }
  }

  const appMode = resolveMode(source, context);
  const isProductionBuild = source.MODE === "production";
  const apiUrl = normalizeApiUrl(source.VITE_API_URL, appMode, isProductionBuild);
  const baseUrl = source.BASE_URL ?? "/";
  const isGithubPages =
    baseUrl !== "/" || Boolean(context.hostname?.endsWith("github.io"));

  const canShowRealMeetLink =
    appMode === "local" &&
    normalizeBoolean("VITE_SHOW_REAL_MEET_LINK", source.VITE_SHOW_REAL_MEET_LINK, true);
  const canUseAdminFeatures =
    appMode === "local" &&
    normalizeBoolean("VITE_ENABLE_ADMIN_FEATURES", source.VITE_ENABLE_ADMIN_FEATURES, true);
  const canUseTeacherFeatures =
    appMode === "local" &&
    normalizeBoolean("VITE_ENABLE_TEACHER_FEATURES", source.VITE_ENABLE_TEACHER_FEATURES, true);

  return {
    appMode,
    apiUrl,
    isGithubPages,
    canShowRealMeetLink,
    canUseAdminFeatures,
    canUseTeacherFeatures,
    canUseStudentPrivateArea: appMode === "local",
  } as const;
};

const browserContext =
  typeof window === "undefined"
    ? {}
    : {
        hostname: window.location.hostname,
      };

export const DEMO_MODE_NOTICE =
  "Modo demonstrativo: dados reais e aprovações ficam disponíveis apenas no ambiente local autorizado.";

export const PUBLIC_MEET_NOTICE = "O link da aula não é exibido nesta versão pública.";

export const appConfig = buildWebConfig(import.meta.env, browserContext);

export const getMeetLinkForMode = (meetUrl?: string | null) => {
  return appConfig.canShowRealMeetLink && meetUrl ? meetUrl : null;
};

export const getSafeMeetButtonLabel = () => {
  return appConfig.canShowRealMeetLink ? "Entrar no Google Meet" : "Link da aula indisponível";
};
