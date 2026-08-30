import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import type { AppUser, UserRole } from "../auth/types";
import { ProtectedRoute } from "../components/access/ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";

const buildUser = (
  role: Exclude<UserRole, "visitor">,
  overrides: Partial<AppUser> = {},
): AppUser => ({
  id: `user-${role}`,
  fullName: `Perfil ${role}`,
  email: `${role}.synthetic@example.com`,
  role,
  status: "active",
  mustChangePassword: false,
  passwordChangedAt: "2026-07-12T09:00:00.000Z",
  permissions: [],
  ...overrides,
});

const mockLogin = (user: AppUser) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        message: "Login concluido.",
        data: {
          token: `token-${user.role}`,
          user,
        },
      }),
    })),
  );
};

const mockFailedLogin = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "E-mail ou senha invalidos.",
        },
      }),
    })),
  );
};

type TestInitialEntry =
  | string
  | {
      pathname: string;
      search?: string;
      hash?: string;
      state?: unknown;
      key?: string;
    };

const renderLoginFlow = (initialEntry: TestInitialEntry = "/login") => {
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
          <Route element={<LoginPage />} path="/login-malicioso" />
          <Route element={<div>Primeiro acesso</div>} path="/primeiro-acesso" />
          <Route element={<ProtectedRoute routeType="student" />}>
            <Route element={<div>Area do aluno</div>} path="/aluno" />
          </Route>
          <Route element={<ProtectedRoute routeType="teacher" />}>
            <Route element={<div>Painel do professor</div>} path="/professor" />
          </Route>
          <Route element={<ProtectedRoute routeType="admin" />}>
            <Route element={<div>Dashboard administrativo</div>} path="/admin/dashboard" />
            <Route element={<div>Usuarios administrativos</div>} path="/admin/usuarios" />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

const submitLogin = async () => {
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "synthetic@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "Senha@123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("LoginPage role redirect", () => {
  it("redireciona TEACHER sem return location para /professor", async () => {
    mockLogin(buildUser("teacher"));
    renderLoginFlow();

    await submitLogin();

    expect(await screen.findByText("Painel do professor")).toBeInTheDocument();
    expect(screen.queryByText("Area do aluno")).not.toBeInTheDocument();
  });

  it("redireciona STUDENT sem return location para /aluno", async () => {
    mockLogin(buildUser("student"));
    renderLoginFlow();

    await submitLogin();

    expect(await screen.findByText("Area do aluno")).toBeInTheDocument();
  });

  it("redireciona ADMIN sem return location para /admin/dashboard", async () => {
    mockLogin(buildUser("admin"));
    renderLoginFlow();

    await submitLogin();

    expect(await screen.findByText("Dashboard administrativo")).toBeInTheDocument();
  });

  it("prioriza /primeiro-acesso quando mustChangePassword=true", async () => {
    mockLogin(buildUser("teacher", { mustChangePassword: true, passwordChangedAt: null }));
    renderLoginFlow();

    await submitLogin();

    expect(await screen.findByText("Primeiro acesso")).toBeInTheDocument();
    expect(screen.queryByText("Painel do professor")).not.toBeInTheDocument();
  });

  it("preserva retorno seguro para rota protegida compatível", async () => {
    mockLogin(buildUser("admin"));
    renderLoginFlow("/admin/usuarios?page=2");

    expect(await screen.findByRole("heading", { name: "Entrar no portal" })).toBeInTheDocument();

    await submitLogin();

    expect(await screen.findByText("Usuarios administrativos")).toBeInTheDocument();
  });

  it("bloqueia retorno externo ou incompatível e usa destino do role", async () => {
    mockLogin(buildUser("teacher"));
    renderLoginFlow({
      pathname: "/login",
      state: { from: { pathname: "https://evil.example" } },
    });

    await submitLogin();

    expect(await screen.findByText("Painel do professor")).toBeInTheDocument();
  });

  it("não envia TEACHER para rota administrativa solicitada por state", async () => {
    mockLogin(buildUser("teacher"));
    renderLoginFlow({
      pathname: "/login",
      state: { from: { pathname: "/admin/dashboard" } },
    });

    await submitLogin();

    expect(await screen.findByText("Painel do professor")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard administrativo")).not.toBeInTheDocument();
  });

  it("preserva mensagem de falha de login", async () => {
    mockFailedLogin();
    renderLoginFlow();

    await submitLogin();

    expect(await screen.findByText("E-mail ou senha invalidos.")).toBeInTheDocument();
  });
});
