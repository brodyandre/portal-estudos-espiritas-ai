import "dotenv/config";

const DEFAULT_PORT = 3333;
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_PASSWORD_RECOVERY_TTL_MINUTES = 30;
const DEFAULT_APP_PUBLIC_URL = "http://localhost:5173";
const DEFAULT_SMTP_HOST = "localhost";
const DEFAULT_SMTP_PORT = 1025;
const DEFAULT_SMTP_FROM_NAME = "Portal de Estudos Espiritas";
const DEFAULT_SMTP_FROM_EMAIL = "no-reply@example.local";

export interface ApiEnv {
  nodeEnv: string;
  port: number;
  databaseUrl: string | null;
  jwtSecret: string;
  passwordRecoveryPreviewEnabled: boolean;
  passwordRecoveryTtlMinutes: number;
  appPublicUrl: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFromName: string;
  smtpFromEmail: string;
  corsOrigins: string[];
  ollamaModel: string;
  ollamaBaseUrl: string;
}

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_PORT;
};

const parseCorsOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return DEFAULT_CORS_ORIGINS;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parseNonEmptyString = (value: string | undefined, fallback: string): string => {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value.trim();
};

const parseOptionalString = (value: string | undefined): string | null => {
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value.trim();
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on", "sim"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "nao", "não"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
};

const normalizePublicUrl = (value: string | undefined): string => {
  const rawValue = parseNonEmptyString(value, DEFAULT_APP_PUBLIC_URL);

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawValue);
  } catch (_error) {
    throw new Error("APP_PUBLIC_URL precisa ser uma URL absoluta e segura.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("APP_PUBLIC_URL precisa usar http ou https.");
  }

  parsedUrl.hash = "";
  parsedUrl.search = "";

  return parsedUrl.toString().replace(/\/+$/u, "");
};

const ensureSmtpConfiguration = (config: {
  nodeEnv: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFromName: string;
  smtpFromEmail: string;
  appPublicUrl: string;
}) => {
  if (!config.smtpEnabled) {
    return;
  }

  if (!config.smtpHost.trim()) {
    throw new Error("SMTP_ENABLED=true exige SMTP_HOST configurado.");
  }

  if (!Number.isInteger(config.smtpPort) || config.smtpPort <= 0) {
    throw new Error("SMTP_ENABLED=true exige SMTP_PORT válido.");
  }

  if ((config.smtpUser && !config.smtpPassword) || (!config.smtpUser && config.smtpPassword)) {
    throw new Error("SMTP_USER e SMTP_PASSWORD devem ser informados juntos quando usados.");
  }

  if (!config.smtpFromName.trim() || !config.smtpFromEmail.trim()) {
    throw new Error("SMTP_ENABLED=true exige remetente configurado.");
  }

  try {
    const fromUrl = new URL(`mailto:${config.smtpFromEmail}`);

    if (!fromUrl.pathname.includes("@")) {
      throw new Error("invalid");
    }
  } catch (_error) {
    throw new Error("SMTP_FROM_EMAIL precisa ser um e-mail válido.");
  }

  if (config.nodeEnv === "production" && config.smtpFromEmail.endsWith(".local")) {
    throw new Error("Em produção, SMTP_FROM_EMAIL precisa usar um remetente válido.");
  }

  if (!config.appPublicUrl) {
    throw new Error("SMTP_ENABLED=true exige APP_PUBLIC_URL válido.");
  }

  void config.smtpSecure;
};

export const buildEnv = (source: NodeJS.ProcessEnv = process.env): ApiEnv => {
  const nodeEnv = source.NODE_ENV ?? "development";
  const smtpEnabled = parseBoolean(source.SMTP_ENABLED, false);
  const appPublicUrl = normalizePublicUrl(source.APP_PUBLIC_URL);
  const smtpUser = parseOptionalString(source.SMTP_USER);
  const smtpPassword = parseOptionalString(source.SMTP_PASSWORD);

  const config: ApiEnv = {
    nodeEnv,
    port: parsePort(source.PORT),
    databaseUrl: source.DATABASE_URL?.trim() || null,
    jwtSecret: parseNonEmptyString(source.JWT_SECRET, "jwt-secret-demo-local-only"),
    passwordRecoveryPreviewEnabled:
      nodeEnv === "production" ? false : parseBoolean(source.PASSWORD_RECOVERY_PREVIEW_ENABLED, false),
    passwordRecoveryTtlMinutes: parsePositiveInteger(
      source.PASSWORD_RECOVERY_TTL_MINUTES,
      DEFAULT_PASSWORD_RECOVERY_TTL_MINUTES,
    ),
    appPublicUrl,
    smtpEnabled,
    smtpHost: parseNonEmptyString(source.SMTP_HOST, DEFAULT_SMTP_HOST),
    smtpPort: parsePositiveInteger(source.SMTP_PORT, DEFAULT_SMTP_PORT),
    smtpSecure: parseBoolean(source.SMTP_SECURE, false),
    smtpUser,
    smtpPassword,
    smtpFromName: parseNonEmptyString(source.SMTP_FROM_NAME, DEFAULT_SMTP_FROM_NAME),
    smtpFromEmail: parseNonEmptyString(source.SMTP_FROM_EMAIL, DEFAULT_SMTP_FROM_EMAIL),
    corsOrigins: parseCorsOrigins(source.CORS_ORIGINS),
    ollamaModel: parseNonEmptyString(source.OLLAMA_MODEL, DEFAULT_OLLAMA_MODEL),
    ollamaBaseUrl: parseNonEmptyString(source.OLLAMA_BASE_URL, DEFAULT_OLLAMA_BASE_URL),
  };

  ensureSmtpConfiguration(config);
  return config;
};

export const env = buildEnv(process.env);

export const isDevelopment = env.nodeEnv === "development";
