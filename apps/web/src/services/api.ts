import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";

const REQUEST_TIMEOUT_MS = 2500;

export type ServiceSource = "api" | "mock";

export interface ServiceResult<T> {
  data: T;
  source: ServiceSource;
  notice: string | null;
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

const requestJson = async <T>({ path, query, init }: RequestOptions): Promise<ApiSuccessBody<T>> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path, query), {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as ApiSuccessBody<T> | ApiErrorBody | null;

    if (!response.ok || !payload || payload.success !== true) {
      throw new Error(parseErrorMessage(payload) ?? "Nao foi possivel concluir a solicitacao.");
    }

    return payload;
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
