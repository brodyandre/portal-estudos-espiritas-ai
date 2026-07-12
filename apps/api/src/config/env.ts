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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  jwtSecret: parseNonEmptyString(process.env.JWT_SECRET, "jwt-secret-demo-local-only"),
  passwordRecoveryPreviewEnabled: parseBoolean(process.env.PASSWORD_RECOVERY_PREVIEW_ENABLED, false),
  passwordRecoveryTtlMinutes: parsePositiveInteger(
    process.env.PASSWORD_RECOVERY_TTL_MINUTES,
    DEFAULT_PASSWORD_RECOVERY_TTL_MINUTES,
  ),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  ollamaModel: parseNonEmptyString(process.env.OLLAMA_MODEL, DEFAULT_OLLAMA_MODEL),
  ollamaBaseUrl: parseNonEmptyString(
    process.env.OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_BASE_URL,
  ),
};

export const isDevelopment = env.nodeEnv === "development";
