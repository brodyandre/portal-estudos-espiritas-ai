import type { AppUser } from "./types";

export const AUTH_TOKEN_STORAGE_KEY = "portal-estudos-espiritas-ai:auth-token";
export const AUTH_USER_STORAGE_KEY = "portal-estudos-espiritas-ai:auth-user";

export interface StoredAuthSession {
  token: string;
  user: AppUser;
}

export const readStoredAuthSession = (): StoredAuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const rawUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!token || !rawUser) {
      return null;
    }

    const user = JSON.parse(rawUser) as AppUser;
    return {
      token,
      user,
    };
  } catch (_error) {
    return null;
  }
};

export const writeStoredAuthSession = (session: StoredAuthSession) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token);
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));
};

export const clearStoredAuthSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
};

export const readStoredAuthToken = () => {
  return readStoredAuthSession()?.token ?? null;
};
