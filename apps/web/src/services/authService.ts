import { appConfig } from "../config/appMode";
import type { AppUser } from "../auth/types";
import { clearStoredAuthSession, readStoredAuthToken, writeStoredAuthSession } from "../auth/storage";

const DEFAULT_LOCAL_API_URL = "http://localhost:3333";

interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

interface LoginResponse {
  token: string;
  user: AppUser;
}

const getAuthApiBaseUrl = () => {
  return (appConfig.apiUrl ?? (appConfig.appMode === "local" ? DEFAULT_LOCAL_API_URL : "")).trim();
};

const buildAuthUrl = (path: string) => {
  const baseUrl = getAuthApiBaseUrl();

  if (!baseUrl) {
    throw new Error("A autenticação local só funciona com a API disponível.");
  }

  return new URL(path, `${baseUrl.replace(/\/$/u, "")}/`).toString();
};

const parseSuccess = async <T>(response: Response): Promise<ApiSuccessBody<T>> => {
  const payload = (await response.json().catch(() => null)) as ApiSuccessBody<T> | null;

  if (!response.ok || !payload?.success) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? ((payload as { error?: { message?: string } }).error?.message ?? null)
        : null;

    throw new Error(message ?? "Não foi possível concluir o login local agora.");
  }

  return payload;
};

export const loginWithPassword = async (email: string, password: string) => {
  if (appConfig.appMode !== "local") {
    throw new Error("O login real funciona apenas no ambiente local com backend.");
  }

  const response = await fetch(buildAuthUrl("/api/auth/login"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseSuccess<LoginResponse>(response);
  writeStoredAuthSession(payload.data);

  return payload.data;
};

export const loadAuthenticatedUser = async () => {
  const token = readStoredAuthToken();

  if (!token) {
    return null;
  }

  const response = await fetch(buildAuthUrl("/api/auth/me"), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseSuccess<AppUser>(response);
  writeStoredAuthSession({
    token,
    user: payload.data,
  });

  return payload.data;
};

export const logoutLocalAuth = () => {
  clearStoredAuthSession();
};
