import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { AccountSecurityPage } from "../pages/AccountSecurityPage";

const storeSession = () => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-security");
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

const renderPage = () => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/minha-conta/seguranca"]}>
        <Routes>
          <Route element={<AccountSecurityPage />} path="/minha-conta/seguranca" />
          <Route element={<div>Tela de login</div>} path="/login" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

describe("AccountSecurityPage", () => {
  beforeEach(() => {
    storeSession();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("carrega a lista de sessões e destaca a atual", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          message: "Sessões carregadas com sucesso.",
          data: [
            {
              id: "current-session",
              createdAt: "2026-07-12T10:00:00.000Z",
              expiresAt: "2026-07-12T18:00:00.000Z",
              lastSeenAt: "2026-07-12T11:00:00.000Z",
              revokedAt: null,
              isCurrent: true,
              status: "active",
              device: {
                label: "Chrome em Windows",
                userAgentSummary: "Chrome",
              },
            },
            {
              id: "other-session",
              createdAt: "2026-07-12T09:00:00.000Z",
              expiresAt: "2026-07-12T17:00:00.000Z",
              lastSeenAt: "2026-07-12T10:00:00.000Z",
              revokedAt: null,
              isCurrent: false,
              status: "active",
              device: {
                label: "Navegador móvel",
                userAgentSummary: "Mobile",
              },
            },
          ],
        }),
      })),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Sessões ativas" })).toBeInTheDocument();
    expect(screen.getAllByText("Sessão atual").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Encerrar sessão" })).toBeInTheDocument();
  });

  it("encerra outra sessão e atualiza a lista", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Sessões carregadas com sucesso.",
          data: [
            {
              id: "current-session",
              createdAt: "2026-07-12T10:00:00.000Z",
              expiresAt: "2026-07-12T18:00:00.000Z",
              lastSeenAt: "2026-07-12T11:00:00.000Z",
              revokedAt: null,
              isCurrent: true,
              status: "active",
              device: { label: "Chrome em Windows", userAgentSummary: "Chrome" },
            },
            {
              id: "other-session",
              createdAt: "2026-07-12T09:00:00.000Z",
              expiresAt: "2026-07-12T17:00:00.000Z",
              lastSeenAt: "2026-07-12T10:00:00.000Z",
              revokedAt: null,
              isCurrent: false,
              status: "active",
              device: { label: "Navegador móvel", userAgentSummary: "Mobile" },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Sessão encerrada com sucesso.",
          data: { revoked: true, alreadyRevoked: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Sessões carregadas com sucesso.",
          data: [
            {
              id: "current-session",
              createdAt: "2026-07-12T10:00:00.000Z",
              expiresAt: "2026-07-12T18:00:00.000Z",
              lastSeenAt: "2026-07-12T11:00:00.000Z",
              revokedAt: null,
              isCurrent: true,
              status: "active",
              device: { label: "Chrome em Windows", userAgentSummary: "Chrome" },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Encerrar sessão" }));

    await waitFor(() => {
      expect(screen.queryByText("Navegador móvel")).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/auth/sessions/other-session",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("encerra as outras sessões", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Sessões carregadas com sucesso.",
          data: [
            {
              id: "current-session",
              createdAt: "2026-07-12T10:00:00.000Z",
              expiresAt: "2026-07-12T18:00:00.000Z",
              lastSeenAt: "2026-07-12T11:00:00.000Z",
              revokedAt: null,
              isCurrent: true,
              status: "active",
              device: { label: "Chrome em Windows", userAgentSummary: "Chrome" },
            },
            {
              id: "other-session",
              createdAt: "2026-07-12T09:00:00.000Z",
              expiresAt: "2026-07-12T17:00:00.000Z",
              lastSeenAt: "2026-07-12T10:00:00.000Z",
              revokedAt: null,
              isCurrent: false,
              status: "active",
              device: { label: "Navegador móvel", userAgentSummary: "Mobile" },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "As outras sessões foram encerradas com sucesso.",
          data: { revokedSessions: 1 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Sessões carregadas com sucesso.",
          data: [
            {
              id: "current-session",
              createdAt: "2026-07-12T10:00:00.000Z",
              expiresAt: "2026-07-12T18:00:00.000Z",
              lastSeenAt: "2026-07-12T11:00:00.000Z",
              revokedAt: null,
              isCurrent: true,
              status: "active",
              device: { label: "Chrome em Windows", userAgentSummary: "Chrome" },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Encerrar outras sessões" }));

    await waitFor(() => {
      expect(screen.queryByText("Navegador móvel")).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/auth/logout-others",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
