import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
} from "../auth/storage";
import { ProtectedRoute } from "../components/access/ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { PasswordChangePage } from "../pages/PasswordChangePage";

const renderAuthFlow = (initialEntry: string) => {
  return render(
    <AuthProvider>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
        initialEntries={[initialEntry]}
      >
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<PasswordChangePage />} path="/primeiro-acesso" />
          <Route element={<ProtectedRoute routeType="student" />}>
            <Route element={<div>Área do aluno liberada</div>} path="/aluno" />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

const storeLocalSession = (mustChangePassword = true) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-local-demo");
  window.localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      id: "user-student-demo",
      fullName: "Aluno Local",
      email: "aluno.local@example.com",
      role: "student",
      status: "active",
      mustChangePassword,
      passwordChangedAt: mustChangePassword ? null : "2026-07-12T10:30:00.000Z",
      permissions: ["view_student_area", "view_meet_link", "view_materials", "ask_assistant"],
    }),
  );
};

const getPasswordField = (selector: string) => {
  const field = document.querySelector<HTMLInputElement>(selector);

  if (!field) {
    throw new Error(`Campo não encontrado: ${selector}`);
  }

  return field;
};

describe("fluxo de troca obrigatoria de senha", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("redireciona para o primeiro acesso logo apos o login com troca obrigatoria pendente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          message: "Login concluído com sucesso.",
          data: {
            token: "token-login-obrigatorio",
            user: {
              id: "user-student-demo",
              fullName: "Aluno Local",
              email: "aluno.local@example.com",
              role: "student",
              status: "active",
              mustChangePassword: true,
              passwordChangedAt: null,
              permissions: ["view_student_area", "view_meet_link", "view_materials", "ask_assistant"],
            },
          },
        }),
      })),
    );

    renderAuthFlow("/login");

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "aluno.local@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "SenhaTemporaria@123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Troque sua senha temporária" })).toBeInTheDocument();
  });

  it("mostra mensagem de rate limit no login e evita clique duplicado enquanto envia", async () => {
    let resolveLogin: ((value: unknown) => void) | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        return new Promise((resolve) => {
          resolveLogin = resolve;
        });
      }),
    );

    renderAuthFlow("/login");

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "aluno.local@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "SenhaTemporaria@123" },
    });

    const submitButton = screen.getByRole("button", { name: "Entrar" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    expect(resolveLogin).toBeDefined();
    resolveLogin?.({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "AUTH_RATE_LIMITED",
          message: "Muitas tentativas. Aguarde antes de tentar novamente.",
          details: {
            retryAfterSeconds: 90,
          },
        },
      }),
    });

    expect(
      await screen.findByText(
        "Muitas tentativas. Aguarde antes de tentar novamente. Tente novamente em cerca de 2 minutos.",
      ),
    ).toBeInTheDocument();
  });

  it("renderiza a pagina e atualiza os indicadores das regras da senha", async () => {
    storeLocalSession(true);
    renderAuthFlow("/primeiro-acesso");

    expect(screen.getByRole("heading", { name: "Troque sua senha temporária" })).toBeInTheDocument();

    fireEvent.change(getPasswordField("#new-password"), {
      target: { value: "NovaSenha1" },
    });

    await waitFor(() => {
      expect(screen.getAllByText(/OK •/u)).toHaveLength(4);
    });
  });

  it("mostra o erro da API quando a troca falha", async () => {
    storeLocalSession(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: "CURRENT_PASSWORD_INVALID",
            message: "A senha atual informada não confere.",
          },
        }),
      })),
    );

    renderAuthFlow("/primeiro-acesso");

    fireEvent.change(getPasswordField("#current-password"), {
      target: { value: "SenhaTemporaria@123" },
    });
    fireEvent.change(getPasswordField("#new-password"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.change(getPasswordField("#confirm-password"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(
      await screen.findByText("A senha atual informada não confere."),
    ).toBeInTheDocument();
  });

  it("mostra mensagem de rate limit na troca obrigatoria de senha", async () => {
    storeLocalSession(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: "PASSWORD_CHANGE_RATE_LIMITED",
            message: "Muitas tentativas. Aguarde antes de tentar novamente.",
            details: {
              retryAfterSeconds: 45,
            },
          },
        }),
      })),
    );

    renderAuthFlow("/primeiro-acesso");

    fireEvent.change(getPasswordField("#current-password"), {
      target: { value: "SenhaTemporaria@123" },
    });
    fireEvent.change(getPasswordField("#new-password"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.change(getPasswordField("#confirm-password"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(
      await screen.findByText(
        "Muitas tentativas. Aguarde antes de tentar novamente. Tente novamente em cerca de 45 segundos.",
      ),
    ).toBeInTheDocument();
  });

  it("conclui a troca e redireciona para a area correta", async () => {
    storeLocalSession(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          message: "Senha atualizada com sucesso.",
          data: {
            token: "token-atualizado",
            user: {
              id: "user-student-demo",
              fullName: "Aluno Local",
              email: "aluno.local@example.com",
              role: "student",
              status: "active",
              mustChangePassword: false,
              passwordChangedAt: "2026-07-12T10:30:00.000Z",
              permissions: ["view_student_area", "view_meet_link", "view_materials", "ask_assistant"],
            },
          },
        }),
      })),
    );

    renderAuthFlow("/primeiro-acesso");

    fireEvent.change(getPasswordField("#current-password"), {
      target: { value: "SenhaTemporaria@123" },
    });
    fireEvent.change(getPasswordField("#new-password"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.change(getPasswordField("#confirm-password"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(await screen.findByText("Área do aluno liberada")).toBeInTheDocument();
  });
});
