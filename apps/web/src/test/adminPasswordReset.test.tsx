import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { AdminPage } from "../pages/AdminPage";

const adminUsersResponse = [
  {
    id: "user-admin-demo",
    fullName: "Admin Demonstrativo",
    email: "admin.demo@example.com",
    role: "admin",
    status: "active",
    groupName: "Equipe administrativa",
    groupSlug: null,
    createdAt: "2026-07-01T08:00:00.000Z",
    adminNote: "Admin local",
    mustChangePassword: false,
    temporaryPasswordGeneratedAt: null,
  },
  {
    id: "user-aluno-demo",
    fullName: "Aluno Demonstrativo",
    email: "aluno.demo@example.com",
    role: "student",
    status: "active",
    groupName: "Emmanuel",
    groupSlug: "emmanuel",
    createdAt: "2026-07-02T08:00:00.000Z",
    adminNote: "Aluno local",
    mustChangePassword: false,
    temporaryPasswordGeneratedAt: null,
  },
];

const auditResponse = [
  {
    id: "audit-001",
    userId: "user-aluno-demo",
    userName: "Aluno Demonstrativo",
    actionType: "activate",
    summary: "Ativou o usuário Aluno Demonstrativo.",
    createdAt: "2026-07-10T10:00:00.000Z",
    actorName: "Admin demonstrativo",
  },
];

const storeSession = (role: "admin" | "teacher" | "student", id: string) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-local-demo");
  window.localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      id,
      fullName: `Perfil ${role}`,
      email: `${role}.demo@example.com`,
      role,
      status: "active",
      mustChangePassword: false,
      passwordChangedAt: "2026-07-12T10:30:00.000Z",
      permissions: [],
    }),
  );
};

const renderAdminUsersPage = () => {
  return render(
    <AuthProvider>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
        initialEntries={["/admin/usuarios"]}
      >
        <Routes>
          <Route element={<AdminPage section="usuarios" />} path="/admin/usuarios" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

describe("admin password reset ui", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("mostra o botão apenas para admin e não no próprio usuário", async () => {
    storeSession("admin", "user-admin-demo");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("/api/admin/users")) {
          return createJsonResponse({ success: true, message: "ok", data: adminUsersResponse });
        }

        return createJsonResponse({ success: true, message: "ok", data: auditResponse });
      }),
    );

    renderAdminUsersPage();

    expect(await screen.findByRole("heading", { name: "Gestão de usuários" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Redefinir senha de Admin Demonstrativo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Redefinir senha de Aluno Demonstrativo/i })).toBeInTheDocument();
  });

  it("não mostra a ação para professor e aluno", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/api/admin/users")) {
        return createJsonResponse({ success: true, message: "ok", data: adminUsersResponse });
      }

      return createJsonResponse({ success: true, message: "ok", data: auditResponse });
    });

    vi.stubGlobal("fetch", fetchMock);

    storeSession("teacher", "user-professor-demo");
    const { unmount } = renderAdminUsersPage();
    expect(await screen.findByRole("heading", { name: "Gestão de usuários" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Redefinir senha/i })).not.toBeInTheDocument();

    unmount();
    window.localStorage.clear();
    storeSession("student", "user-aluno-demo");
    renderAdminUsersPage();
    expect(await screen.findByRole("heading", { name: "Gestão de usuários" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Redefinir senha/i })).not.toBeInTheDocument();
  });

  it("abre o modal, mostra loading, sucesso, cópia e limpa a senha ao fechar", async () => {
    storeSession("admin", "user-admin-demo");

    let resolveReset: ((value: ReturnType<typeof createJsonResponse>) => void) | undefined;
    const fetchMock = vi.fn((input: string) => {
      if (input.includes("/api/admin/users/user-aluno-demo/reset-password")) {
        return new Promise((resolve) => {
          resolveReset = resolve;
        });
      }

      if (input.includes("/api/admin/users")) {
        return Promise.resolve(
          createJsonResponse({ success: true, message: "ok", data: adminUsersResponse }),
        );
      }

      return Promise.resolve(createJsonResponse({ success: true, message: "ok", data: auditResponse }));
    });

    vi.stubGlobal("fetch", fetchMock);

    renderAdminUsersPage();

    fireEvent.click(await screen.findByRole("button", { name: /Redefinir senha de Aluno Demonstrativo/i }));

    expect(await screen.findByRole("dialog", { name: "Confirmar redefinição de senha" })).toBeInTheDocument();
    expect(screen.getByText(/sessões anteriores serão encerradas/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /Confirmar redefinição/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });

    expect(resolveReset).toBeDefined();

    resolveReset!(
      createJsonResponse({
        success: true,
        message: "ok",
        data: {
          user: {
            ...adminUsersResponse[1],
            mustChangePassword: true,
            temporaryPasswordGeneratedAt: "2026-07-12T15:00:00.000Z",
          },
          temporaryPassword: "AL@PortalZ9x2Qw",
        },
      }),
    );

    expect(await screen.findByText(/Senha temporária:/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copiar senha temporária" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("AL@PortalZ9x2Qw");
    });

    fireEvent.click(screen.getByRole("button", { name: "Fechar modal de redefinição de senha" }));

    await waitFor(() => {
      expect(screen.queryByText(/AL@PortalZ9x2Qw/i)).not.toBeInTheDocument();
    });
  });

  it("mostra o erro da API quando a redefinição falha", async () => {
    storeSession("admin", "user-admin-demo");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("/api/admin/users/user-aluno-demo/reset-password")) {
          return createJsonResponse(
            {
              success: false,
              error: {
                code: "ADMIN_USER_NOT_FOUND",
                message: "Usuário não encontrado para redefinição administrativa de senha.",
              },
            },
            false,
          );
        }

        if (input.includes("/api/admin/users")) {
          return createJsonResponse({ success: true, message: "ok", data: adminUsersResponse });
        }

        return createJsonResponse({ success: true, message: "ok", data: auditResponse });
      }),
    );

    renderAdminUsersPage();
    fireEvent.click(await screen.findByRole("button", { name: /Redefinir senha de Aluno Demonstrativo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar redefinição/i }));

    expect(
      await screen.findByText("Usuário não encontrado para redefinição administrativa de senha."),
    ).toBeInTheDocument();
  });

  it("mostra mensagem de rate limit no reset administrativo", async () => {
    storeSession("admin", "user-admin-demo");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("/api/admin/users/user-aluno-demo/reset-password")) {
          return createJsonResponse(
            {
              success: false,
              error: {
                code: "ADMIN_PASSWORD_RESET_RATE_LIMITED",
                message: "Muitas tentativas. Aguarde antes de tentar novamente.",
                details: {
                  retryAfterSeconds: 120,
                },
              },
            },
            false,
          );
        }

        if (input.includes("/api/admin/users")) {
          return createJsonResponse({ success: true, message: "ok", data: adminUsersResponse });
        }

        return createJsonResponse({ success: true, message: "ok", data: auditResponse });
      }),
    );

    renderAdminUsersPage();
    fireEvent.click(await screen.findByRole("button", { name: /Redefinir senha de Aluno Demonstrativo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar redefinição/i }));

    expect(
      await screen.findByText(
        "Muitas tentativas. Aguarde antes de tentar novamente. Tente novamente em cerca de 2 minutos.",
      ),
    ).toBeInTheDocument();
  });
});
