import type { PropsWithChildren } from "react";
import { createContext, useEffect, useMemo, useState } from "react";

import { appConfig } from "../config/appMode";
import { clearCurrentUserRole, useCurrentUserMock } from "../mocks/currentUser";
import {
  clearLocalAuthSession,
  changePasswordWithSession,
  loadAuthenticatedUser,
  loginWithPassword,
  logoutAllWithSession,
  logoutWithSession,
} from "../services/authService";
import { writeStudentAccessStatus } from "../services/studentAccessService";
import { clearStoredAuthSession, readStoredAuthSession, writeStoredAuthSession } from "./storage";
import type { AppUser } from "./types";

interface AuthContextValue {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  requiresPasswordChange: boolean;
  isEndingSession: boolean;
  notice: string | null;
  login: (email: string, password: string) => Promise<AppUser>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => Promise<AppUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const syncStudentAccessFromUser = (user: AppUser | null) => {
  if (!user) {
    writeStudentAccessStatus("visitor");
    return;
  }

  if (user.role === "student" && user.status === "active") {
    writeStudentAccessStatus("approved");
    return;
  }

  if (user.role === "teacher" || user.role === "admin") {
    writeStudentAccessStatus("approved");
  }
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const demoUser = useCurrentUserMock();
  const storedSession = useMemo(() => readStoredAuthSession(), []);
  const [user, setUser] = useState<AppUser | null>(() =>
    appConfig.appMode === "demo" ? demoUser : storedSession?.user ?? null,
  );
  const [token, setToken] = useState<string | null>(() =>
    appConfig.appMode === "demo" ? null : storedSession?.token ?? null,
  );
  const [isLoading, setIsLoading] = useState(appConfig.appMode === "local" && Boolean(storedSession?.token));
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    appConfig.appMode === "demo"
      ? "Modo demonstrativo: o login real funciona apenas no ambiente local com backend."
      : null,
  );

  useEffect(() => {
    if (appConfig.appMode === "demo") {
      setUser(demoUser);
      setToken(null);
      setIsLoading(false);
      return;
    }

    if (import.meta.env.MODE === "test") {
      setIsLoading(false);
      return;
    }

    if (!storedSession?.token) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    loadAuthenticatedUser()
      .then((loadedUser) => {
        if (!isMounted) {
          return;
        }

        if (!loadedUser) {
          clearStoredAuthSession();
          setUser(null);
          setToken(null);
          return;
        }

        setUser(loadedUser);
        syncStudentAccessFromUser(loadedUser);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        clearStoredAuthSession();
        setUser(null);
        setToken(null);
        writeStudentAccessStatus("visitor");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [demoUser, storedSession?.token]);

  const value = useMemo<AuthContextValue>(() => {
    const clearSessionState = () => {
      clearLocalAuthSession();
      setToken(null);
      setUser(null);
      writeStudentAccessStatus("visitor");
    };

    return {
      user,
      token,
      isAuthenticated: Boolean(user && user.status === "active" && user.role !== "visitor"),
      isLoading,
      isDemoMode: appConfig.appMode === "demo",
      requiresPasswordChange: Boolean(user?.mustChangePassword),
      isEndingSession,
      notice,
      async login(email, password) {
        const session = await loginWithPassword(email, password);
        writeStoredAuthSession(session);
        setToken(session.token);
        setUser(session.user);
        syncStudentAccessFromUser(session.user);
        setNotice(null);
        return session.user;
      },
      async changePassword(currentPassword, newPassword, confirmPassword) {
        const session = await changePasswordWithSession({
          currentPassword,
          newPassword,
          confirmPassword,
        });
        setToken(session.token);
        setUser(session.user);
        syncStudentAccessFromUser(session.user);
        setNotice(null);
        return session.user;
      },
      async logout() {
        if (appConfig.appMode === "demo") {
          clearCurrentUserRole();
          setUser(demoUser);
          setToken(null);
          writeStudentAccessStatus("visitor");
          setNotice(
            "Modo demonstrativo: o encerramento real de sessões só funciona no ambiente local com backend.",
          );
          return;
        }

        setIsEndingSession(true);

        try {
          await logoutWithSession();
          setNotice("Sessão local encerrada com sucesso.");
        } catch (_error) {
          setNotice(
            "A sessão local foi limpa neste navegador. Para revogação real, confirme se a API local está disponível.",
          );
        } finally {
          clearSessionState();
          setIsEndingSession(false);
        }
      },
      async logoutAll() {
        if (appConfig.appMode === "demo") {
          clearCurrentUserRole();
          setUser(demoUser);
          setToken(null);
          writeStudentAccessStatus("visitor");
          setNotice(
            "Modo demonstrativo: o encerramento real de todas as sessões só funciona no ambiente local com backend.",
          );
          return;
        }

        setIsEndingSession(true);

        try {
          await logoutAllWithSession();
          setNotice("Todas as sessões locais foram encerradas com sucesso.");
        } catch (_error) {
          setNotice(
            "A sessão local foi limpa neste navegador. Para encerrar todas as sessões reais, confirme se a API local está disponível.",
          );
        } finally {
          clearSessionState();
          setIsEndingSession(false);
        }
      },
    };
  }, [demoUser, isEndingSession, isLoading, notice, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
