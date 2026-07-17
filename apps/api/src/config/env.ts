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
const DEFAULT_TRUST_PROXY_HOPS = 0;
const MAX_TRUST_PROXY_HOPS = 10;
const LOCAL_JWT_SECRET = "jwt-secret-demo-local-only";
const WEAK_PRODUCTION_JWT_SECRETS = new Set([
  LOCAL_JWT_SECRET,
  "secret",
  "jwt-secret",
  "password",
  "change-me",
  "changeme",
]);

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
  trustProxyHops: number;
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

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set(origins.map((origin) => normalizeOrigin(origin, { allowHttp: true })))];
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

const isLoopbackHostname = (hostname: string): boolean => {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/u.test(hostname)
  );
};

const parseTrustProxyHops = (value: string | undefined, nodeEnv: string): number => {
  if (!value || value.trim().length === 0) {
    if (nodeEnv === "production") {
      throw new Error(
        "TRUST_PROXY_HOPS é obrigatório em produção e deve ser um inteiro entre 0 e 10.",
      );
    }

    return DEFAULT_TRUST_PROXY_HOPS;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_TRUST_PROXY_HOPS) {
    throw new Error("TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 10.");
  }

  return parsed;
};

const normalizeOrigin = (value: string, options: { allowHttp: boolean }): string => {
  if (value === "*") {
    throw new Error("CORS_ORIGINS não aceita wildcard em produção.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch (_error) {
    throw new Error("CORS_ORIGINS deve conter URLs absolutas válidas separadas por vírgula.");
  }

  if (!options.allowHttp && parsedUrl.protocol !== "https:") {
    throw new Error("CORS_ORIGINS deve usar HTTPS em produção.");
  }

  if (options.allowHttp && !["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("CORS_ORIGINS deve usar http ou https.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("CORS_ORIGINS não deve conter usuário ou senha.");
  }

  if (parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash) {
    throw new Error("CORS_ORIGINS deve conter apenas a origem, sem path, query ou hash.");
  }

  if (!options.allowHttp && isLoopbackHostname(parsedUrl.hostname)) {
    throw new Error("CORS_ORIGINS não deve usar localhost em produção.");
  }

  return parsedUrl.origin;
};

const parseProductionCorsOrigins = (value: string | undefined): string[] => {
  if (!value || value.trim().length === 0) {
    throw new Error("CORS_ORIGINS é obrigatório em produção.");
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => normalizeOrigin(origin, { allowHttp: false }));

  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS deve conter ao menos uma origem em produção.");
  }

  const uniqueOrigins = [...new Set(origins)];

  if (uniqueOrigins.length !== origins.length) {
    throw new Error("CORS_ORIGINS não deve conter origens duplicadas.");
  }

  return uniqueOrigins;
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

const normalizeProductionPublicUrl = (value: string | undefined): string => {
  if (!value || value.trim().length === 0) {
    throw new Error("APP_PUBLIC_URL é obrigatório em produção.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch (_error) {
    throw new Error("APP_PUBLIC_URL precisa ser uma URL absoluta e segura.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("APP_PUBLIC_URL precisa usar HTTPS em produção.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("APP_PUBLIC_URL não deve conter usuário ou senha.");
  }

  if (parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash) {
    throw new Error("APP_PUBLIC_URL deve conter apenas a origem, sem path, query ou hash.");
  }

  if (isLoopbackHostname(parsedUrl.hostname)) {
    throw new Error("APP_PUBLIC_URL não deve usar localhost em produção.");
  }

  return parsedUrl.origin;
};

const parseProductionDatabaseUrl = (value: string | undefined): string => {
  if (!value || value.trim().length === 0) {
    throw new Error("DATABASE_URL é obrigatório em produção.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch (_error) {
    throw new Error("DATABASE_URL deve ser uma URL PostgreSQL válida.");
  }

  if (!["postgresql:", "postgres:"].includes(parsedUrl.protocol)) {
    throw new Error("DATABASE_URL deve usar protocolo postgresql ou postgres em produção.");
  }

  return value.trim();
};

const parseProductionJwtSecret = (value: string | undefined): string => {
  const secret = value?.trim() ?? "";

  if (!secret) {
    throw new Error("JWT_SECRET é obrigatório em produção.");
  }

  if (WEAK_PRODUCTION_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error("JWT_SECRET usa um valor fraco conhecido e deve ser substituído em produção.");
  }

  if (secret.length < 32) {
    throw new Error("JWT_SECRET deve ter pelo menos 32 caracteres em produção.");
  }

  return secret;
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
  const isProduction = nodeEnv === "production";
  const smtpEnabled = parseBoolean(source.SMTP_ENABLED, false);
  const appPublicUrl = isProduction
    ? normalizeProductionPublicUrl(source.APP_PUBLIC_URL)
    : normalizePublicUrl(source.APP_PUBLIC_URL);
  const smtpUser = parseOptionalString(source.SMTP_USER);
  const smtpPassword = parseOptionalString(source.SMTP_PASSWORD);

  const config: ApiEnv = {
    nodeEnv,
    port: parsePort(source.PORT),
    databaseUrl: isProduction ? parseProductionDatabaseUrl(source.DATABASE_URL) : source.DATABASE_URL?.trim() || null,
    jwtSecret: isProduction ? parseProductionJwtSecret(source.JWT_SECRET) : parseNonEmptyString(source.JWT_SECRET, LOCAL_JWT_SECRET),
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
    corsOrigins: isProduction ? parseProductionCorsOrigins(source.CORS_ORIGINS) : parseCorsOrigins(source.CORS_ORIGINS),
    trustProxyHops: parseTrustProxyHops(source.TRUST_PROXY_HOPS, nodeEnv),
    ollamaModel: parseNonEmptyString(source.OLLAMA_MODEL, DEFAULT_OLLAMA_MODEL),
    ollamaBaseUrl: parseNonEmptyString(source.OLLAMA_BASE_URL, DEFAULT_OLLAMA_BASE_URL),
  };

  ensureSmtpConfiguration(config);
  return config;
};

export const env = buildEnv(process.env);

export const isDevelopment = env.nodeEnv === "development";
