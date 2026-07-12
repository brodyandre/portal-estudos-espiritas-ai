import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { LoginPage } from "../pages/LoginPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";

const renderPasswordRecoveryRoutes = (initialEntry: string) => {
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
          <Route element={<ForgotPasswordPage />} path="/esqueci-minha-senha" />
          <Route element={<ResetPasswordPage />} path="/redefinir-senha" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

describe("password recovery pages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("mostra o link para esqueci minha senha no login", () => {
    renderPasswordRecoveryRoutes("/login");

    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toBeInTheDocument();
  });

  it("envia o formulario de recuperacao e mostra mensagem generica", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          message: "Solicitação registrada.",
          data: {
            success: true,
            message:
              "Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.",
          },
        }),
      })),
    );

    renderPasswordRecoveryRoutes("/esqueci-minha-senha");

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "aluno.demo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(
      await screen.findByText(
        "Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.",
      ),
    ).toBeInTheDocument();
  });

  it("mostra mensagem de rate limit na solicitacao", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: "PASSWORD_RECOVERY_RATE_LIMITED",
            message: "Muitas tentativas. Aguarde antes de tentar novamente.",
            details: {
              retryAfterSeconds: 120,
            },
          },
        }),
      })),
    );

    renderPasswordRecoveryRoutes("/esqueci-minha-senha");

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "aluno.demo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(
      await screen.findByText(
        "Muitas tentativas. Aguarde antes de tentar novamente. Tente novamente em cerca de 2 minutos.",
      ),
    ).toBeInTheDocument();
  });

  it("mostra aviso quando o token nao esta presente", async () => {
    renderPasswordRecoveryRoutes("/redefinir-senha");

    expect(screen.getByText("O token de recuperação não foi encontrado. Solicite um novo link para continuar.")).toBeInTheDocument();
  });

  it("redefine a senha com sucesso e volta ao login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          message: "Senha redefinida com sucesso.",
          data: {
            success: true,
            message: "Senha redefinida com sucesso. Faça login novamente.",
          },
        }),
      })),
    );

    renderPasswordRecoveryRoutes("/redefinir-senha?token=token-demo");

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "NovaSenha@123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));

    expect(await screen.findByText("Senha redefinida com sucesso. Faça login novamente.")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Entrar no portal" })).toBeInTheDocument();
    });
  });
});
