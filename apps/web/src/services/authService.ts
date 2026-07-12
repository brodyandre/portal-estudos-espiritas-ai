import { appConfig } from "../config/appMode";
import type { AppUser } from "../auth/types";
import { clearStoredAuthSession, readStoredAuthToken, writeStoredAuthSession } from "../auth/storage";
import { formatRetryAfterLabel } from "./api";

const DEFAULT_LOCAL_API_URL = "http://localhost:3333";

interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

interface ApiErrorBody {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: {
      retryAfterSeconds?: number;
    };
  };
}

interface LoginResponse {
  token: string;
  user: AppUser;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ForgotPasswordResponse {
  success: true;
  message: string;
}

interface ResetPasswordResponse {
  success: true;
  message: string;
}

interface AcceptInvitationResponse {
  success: true;
  message: string;
}

interface LogoutResponse {
  revokedCurrentSession?: boolean;
}

interface LogoutAllResponse {
  revokedSessions: number;
}

export interface AuthSessionView {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  isCurrent: boolean;
  status: "active" | "revoked" | "expired";
  device: {
    label: string;
    userAgentSummary?: string | null;
  };
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

const buildApiErrorMessage = (payload: ApiErrorBody | null, fallbackMessage: string) => {
  const baseMessage = payload?.error?.message ?? fallbackMessage;
  const retryAfterSeconds = payload?.error?.details?.retryAfterSeconds;

  if (!retryAfterSeconds) {
    return baseMessage;
  }

  return `${baseMessage} Tente novamente em cerca de ${formatRetryAfterLabel(retryAfterSeconds)}.`;
};

const parseSuccess = async <T>(
  response: Response,
  fallbackMessage = "Não foi possível concluir a solicitação local agora.",
): Promise<ApiSuccessBody<T>> => {
  const payload = (await response.json().catch(() => null)) as ApiSuccessBody<T> | ApiErrorBody | null;

  if (!response.ok || !payload || payload.success !== true) {
    throw new Error(buildApiErrorMessage(payload as ApiErrorBody | null, fallbackMessage));
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

  const payload = await parseSuccess<LoginResponse>(response, "Não foi possível concluir o login local agora.");
  writeStoredAuthSession(payload.data);

  return payload.data;
};

export const requestPasswordRecovery = async (email: string) => {
  if (appConfig.appMode !== "local") {
    throw new Error("Modo demonstrativo: a recuperação real de senha depende da API local.");
  }

  const response = await fetch(buildAuthUrl("/api/auth/forgot-password"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const payload = await parseSuccess<ForgotPasswordResponse>(
    response,
    "Não foi possível iniciar a recuperação de senha agora.",
  );
  return payload.data;
};

export const resetPasswordByRecoveryToken = async (
  token: string,
  newPassword: string,
  confirmPassword: string,
) => {
  if (appConfig.appMode !== "local") {
    throw new Error("Modo demonstrativo: a redefinição real de senha depende da API local.");
  }

  const response = await fetch(buildAuthUrl("/api/auth/reset-password"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, newPassword, confirmPassword }),
  });

  const payload = await parseSuccess<ResetPasswordResponse>(
    response,
    "Não foi possível redefinir a senha agora.",
  );
  return payload.data;
};

export const acceptAccountInvitation = async (
  token: string,
  password: string,
  confirmPassword: string,
) => {
  if (appConfig.appMode !== "local") {
    throw new Error("Modo demonstrativo: a ativação real da conta depende da API local.");
  }

  const response = await fetch(buildAuthUrl("/api/auth/accept-invitation"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password, confirmPassword }),
  });

  const payload = await parseSuccess<AcceptInvitationResponse>(
    response,
    "Não foi possível ativar a conta agora.",
  );
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

const getStoredTokenOrThrow = () => {
  const token = readStoredAuthToken();

  if (!token) {
    throw new Error("Faça login no ambiente local para continuar.");
  }

  return token;
};

export const changePasswordWithSession = async (input: ChangePasswordInput) => {
  const token = getStoredTokenOrThrow();

  const response = await fetch(buildAuthUrl("/api/auth/change-password"), {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await parseSuccess<LoginResponse>(response);
  writeStoredAuthSession(payload.data);

  return payload.data;
};

export const loadAuthSessions = async (includeInactive = false) => {
  const token = getStoredTokenOrThrow();
  const url = buildAuthUrl(`/api/auth/sessions?includeInactive=${includeInactive ? "true" : "false"}`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseSuccess<AuthSessionView[]>(response);
  return payload.data;
};

export const revokeAuthSession = async (sessionId: string) => {
  const token = getStoredTokenOrThrow();
  const response = await fetch(buildAuthUrl(`/api/auth/sessions/${sessionId}`), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseSuccess<{ revoked: boolean; alreadyRevoked: boolean }>(response);
  return payload.data;
};

export const logoutWithSession = async () => {
  const token = getStoredTokenOrThrow();

  const response = await fetch(buildAuthUrl("/api/auth/logout"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseSuccess<LogoutResponse>(response);
  return payload.data;
};

export const logoutOtherSessionsWithSession = async () => {
  const token = getStoredTokenOrThrow();

  const response = await fetch(buildAuthUrl("/api/auth/logout-others"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseSuccess<LogoutAllResponse>(response);
  return payload.data;
};

export const logoutAllWithSession = async () => {
  const token = getStoredTokenOrThrow();

  const response = await fetch(buildAuthUrl("/api/auth/logout-all"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseSuccess<LogoutAllResponse>(response);
  return payload.data;
};

export const clearLocalAuthSession = () => {
  clearStoredAuthSession();
};
