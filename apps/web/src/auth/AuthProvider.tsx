import type { PropsWithChildren } from "react";
import { createContext, useEffect, useMemo, useState } from "react";

import { appConfig } from "../config/appMode";
import { clearCurrentUserRole, useCurrentUserMock } from "../mocks/currentUser";
import { loadAuthenticatedUser, loginWithPassword, logoutLocalAuth } from "../services/authService";
import { writeStudentAccessStatus } from "../services/studentAccessService";
import { clearStoredAuthSession, readStoredAuthSession, writeStoredAuthSession } from "./storage";
import type { AppUser } from "./types";

interface AuthContextValue {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  notice: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
    return {
      user,
      token,
      isAuthenticated: Boolean(user && user.status === "active" && user.role !== "visitor"),
      isLoading,
      isDemoMode: appConfig.appMode === "demo",
      notice,
      async login(email, password) {
        const session = await loginWithPassword(email, password);
        writeStoredAuthSession(session);
        setToken(session.token);
        setUser(session.user);
        syncStudentAccessFromUser(session.user);
        setNotice(null);
      },
      logout() {
        if (appConfig.appMode === "demo") {
          clearCurrentUserRole();
          setUser(demoUser);
          setNotice("Modo demonstrativo: o login real funciona apenas no ambiente local com backend.");
          return;
        }

        logoutLocalAuth();
        setToken(null);
        setUser(null);
        writeStudentAccessStatus("visitor");
      },
    };
  }, [demoUser, isLoading, notice, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
