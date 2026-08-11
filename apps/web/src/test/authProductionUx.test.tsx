import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const productionEnv = {
  MODE: "production",
  BASE_URL: "/",
  VITE_APP_MODE: "local",
  VITE_API_URL: "https://api.portal-educacao-continuada.com.br",
  VITE_SHOW_REAL_MEET_LINK: "true",
  VITE_ENABLE_ADMIN_FEATURES: "true",
  VITE_ENABLE_TEACHER_FEATURES: "true",
};

const demoEnv = {
  MODE: "production",
  BASE_URL: "/portal-estudos-espiritas-ai/",
  VITE_APP_MODE: "demo",
  VITE_API_URL: "",
  VITE_SHOW_REAL_MEET_LINK: "false",
  VITE_ENABLE_ADMIN_FEATURES: "false",
  VITE_ENABLE_TEACHER_FEATURES: "false",
};

const renderAuthRoutes = async (initialEntry: string, env: Record<string, string>) => {
  vi.resetModules();

  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }

  const [{ AuthProvider }, { LoginPage }, { ForgotPasswordPage }, { ResetPasswordPage }] = await Promise.all([
    import("../auth/AuthProvider"),
    import("../pages/LoginPage"),
    import("../pages/ForgotPasswordPage"),
    import("../pages/ResetPasswordPage"),
  ]);

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

describe("production auth UX", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("nao renderiza credenciais demonstrativas nem linguagem local no login de producao", async () => {
    await renderAuthRoutes("/login", productionEnv);

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toBeInTheDocument();

    expect(screen.getByText("Acesso ao portal")).toBeInTheDocument();
    expect(screen.getByText("Produção")).toBeInTheDocument();
    expect(screen.queryByText("Login local")).not.toBeInTheDocument();
    expect(screen.queryByText("Acesso local")).not.toBeInTheDocument();
    expect(screen.queryByText("Credenciais demonstrativas")).not.toBeInTheDocument();
    expect(screen.queryByText("Perfis locais para teste")).not.toBeInTheDocument();
    expect(screen.queryByText("Local")).not.toBeInTheDocument();
    expect(screen.queryByText("admin.demo@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("professor.demo@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("aluno.demo@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("AdminDemo@123")).not.toBeInTheDocument();
    expect(screen.queryByText("ProfessorDemo@123")).not.toBeInTheDocument();
    expect(screen.queryByText("AlunoDemo@123")).not.toBeInTheDocument();
  });

  it("nao renderiza linguagem local em forgot-password e reset-password de producao", async () => {
    await renderAuthRoutes("/esqueci-minha-senha", productionEnv);

    expect(screen.getByRole("heading", { name: "Esqueci minha senha" })).toBeInTheDocument();
    expect(screen.getByText("E-mail transacional")).toBeInTheDocument();
    expect(screen.queryByText("Acesso local")).not.toBeInTheDocument();
    expect(screen.queryByText("Prévia local segura")).not.toBeInTheDocument();
    expect(screen.queryByText(/ambiente local/i)).not.toBeInTheDocument();

    cleanup();

    await renderAuthRoutes("/redefinir-senha?token=token-demo", productionEnv);

    expect(screen.getByText("Redefinição segura")).toBeInTheDocument();
    expect(screen.queryByText("Acesso local")).not.toBeInTheDocument();
  });

  it("preserva os perfis demonstrativos no modo GitHub Pages", async () => {
    await renderAuthRoutes("/login", demoEnv);

    expect(screen.getByText("Perfis demonstrativos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar perfil Aluno" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar perfil Professor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar perfil Admin" })).toBeInTheDocument();
    expect(screen.queryByText("AdminDemo@123")).not.toBeInTheDocument();
  });
});
