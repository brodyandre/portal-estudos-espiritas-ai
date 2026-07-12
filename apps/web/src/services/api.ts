import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
import { readStoredAuthToken } from "../auth/storage";

const REQUEST_TIMEOUT_MS = 2500;

export type ServiceSource = "api" | "mock";

export interface ServiceResult<T> {
  data: T;
  source: ServiceSource;
  notice: string | null;
}

export class ServiceRequestError extends Error {
  readonly kind: "api" | "network";
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(options: {
    message: string;
    kind: "api" | "network";
    code?: string;
    retryAfterSeconds?: number;
  }) {
    super(options.message);
    this.kind = options.kind;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface RequestOptions {
  path: string;
  query?: Record<string, string | undefined>;
  init?: RequestInit;
}

interface FallbackOptions<TRaw, TData> extends RequestOptions {
  fallback: () => TData | Promise<TData>;
  mapData?: (data: TRaw) => TData;
  friendlyMessage?: string;
}

const apiBaseUrl = appConfig.apiUrl?.replace(/\/$/u, "") ?? null;

const buildUrl = (path: string, query?: Record<string, string | undefined>) => {
  if (!apiBaseUrl) {
    throw new Error("API indisponível neste modo.");
  }

  const url = new URL(path, `${apiBaseUrl}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
};

const toFriendlyNotice = (fallbackMessage?: string) => {
  if (fallbackMessage) {
    return fallbackMessage;
  }

  if (appConfig.appMode === "demo") {
    return DEMO_MODE_NOTICE;
  }

  return "Nao foi possivel atualizar os dados pelo servidor local agora. O portal segue funcionando com fallback seguro.";
};

const parseErrorMessage = (payload: unknown) => {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    payload.success === false &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return null;
};

const parseErrorCode = (payload: unknown) => {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    payload.success === false &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "code" in payload.error &&
    typeof payload.error.code === "string"
  ) {
    return payload.error.code;
  }

  return undefined;
};

const parseRetryAfterSeconds = (payload: unknown) => {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    payload.success === false &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "details" in payload.error &&
    payload.error.details &&
    typeof payload.error.details === "object" &&
    "retryAfterSeconds" in payload.error.details &&
    typeof payload.error.details.retryAfterSeconds === "number"
  ) {
    return payload.error.details.retryAfterSeconds;
  }

  return undefined;
};

export const formatRetryAfterLabel = (retryAfterSeconds: number) => {
  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds} segundo${retryAfterSeconds === 1 ? "" : "s"}`;
  }

  const roundedMinutes = Math.ceil(retryAfterSeconds / 60);
  return `${roundedMinutes} minuto${roundedMinutes === 1 ? "" : "s"}`;
};

const buildRateLimitMessage = (message: string, retryAfterSeconds?: number) => {
  if (!retryAfterSeconds) {
    return message;
  }

  return `${message} Tente novamente em cerca de ${formatRetryAfterLabel(retryAfterSeconds)}.`;
};

export const requestJson = async <T>({ path, query, init }: RequestOptions): Promise<ApiSuccessBody<T>> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const authToken = readStoredAuthToken();

    const response = await fetch(buildUrl(path, query), {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as ApiSuccessBody<T> | ApiErrorBody | null;

    if (!response.ok || !payload || payload.success !== true) {
      const retryAfterSeconds = parseRetryAfterSeconds(payload);
      throw new ServiceRequestError({
        message: buildRateLimitMessage(
          parseErrorMessage(payload) ?? "Nao foi possivel concluir a solicitacao.",
          retryAfterSeconds,
        ),
        kind: "api",
        code: parseErrorCode(payload),
        retryAfterSeconds,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ServiceRequestError) {
      throw error;
    }

    throw new ServiceRequestError({
      message: "Nao foi possivel conectar ao backend local agora.",
      kind: "network",
    });
  } finally {
    window.clearTimeout(timeout);
  }
};

export const loadWithFallback = async <TRaw, TData>({
  path,
  query,
  init,
  fallback,
  mapData,
  friendlyMessage,
}: FallbackOptions<TRaw, TData>): Promise<ServiceResult<TData>> => {
  try {
    const payload = await requestJson<TRaw>({ path, query, init });

    return {
      data: mapData ? mapData(payload.data) : (payload.data as unknown as TData),
      source: "api",
      notice: null,
    };
  } catch (_error) {
    return {
      data: await fallback(),
      source: "mock",
      notice: toFriendlyNotice(friendlyMessage),
    };
  }
};

export const collectServiceNotice = (results: Array<ServiceResult<unknown>>) => {
  const notices = results
    .map((result) => result.notice)
    .filter((notice): notice is string => Boolean(notice));

  return notices[0] ?? null;
};
