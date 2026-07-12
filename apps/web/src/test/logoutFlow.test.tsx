import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { useAuth } from "../auth/useAuth";

const AuthActions = () => {
  const { isEndingSession, logout, logoutAll, notice, user } = useAuth();

  return (
    <div>
      <span>{user?.email ?? "sem-usuario"}</span>
      <button disabled={isEndingSession} onClick={() => void logout()} type="button">
        Sair
      </button>
      <button disabled={isEndingSession} onClick={() => void logoutAll()} type="button">
        Encerrar tudo
      </button>
      {notice ? <p>{notice}</p> : null}
    </div>
  );
};

const storeSession = () => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-local-demo");
  window.localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      id: "teacher-user",
      fullName: "Professor Local",
      email: "professor.local@example.com",
      role: "teacher",
      status: "active",
      mustChangePassword: false,
      passwordChangedAt: "2026-07-12T10:30:00.000Z",
      permissions: ["review_enrollments", "manage_lessons"],
    }),
  );
};

describe("logout flow", () => {
  beforeEach(() => {
    storeSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("chama a API de logout e limpa a sessao local", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        message: "Sessão encerrada com sucesso.",
        data: { revokedCurrentSession: true },
      }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthActions />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByText("sem-usuario")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/auth/logout",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("limpa a sessao local mesmo quando a API falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            message: "API indisponível.",
          },
        }),
      })),
    );

    render(
      <AuthProvider>
        <AuthActions />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByText("sem-usuario")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "A sessão local foi limpa neste navegador. Para revogação real, confirme se a API local está disponível.",
      ),
    ).toBeInTheDocument();
  });

  it("logout-all limpa a sessao local", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        message: "Todas as sessões locais foram encerradas.",
        data: { revokedSessions: 2 },
      }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthActions />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Encerrar tudo" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/auth/logout-all",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
