import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import { ProtectedRoute } from "../components/access/ProtectedRoute";

const CURRENT_USER_STORAGE_KEY = "portal-estudos-espiritas-ai:current-user-role";
const AUTH_TOKEN_STORAGE_KEY = "portal-estudos-espiritas-ai:auth-token";
const AUTH_USER_STORAGE_KEY = "portal-estudos-espiritas-ai:auth-user";

const storeAuthenticatedUser = (role: "student" | "teacher" | "admin") => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-demo-local");
  window.localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      id: `${role}-user`,
      fullName: `Perfil ${role}`,
      email: `${role}.demo@example.com`,
      role,
      status: "active",
      permissions: [],
    }),
  );
};

const renderProtectedRoute = (path: string, routeType: "student" | "teacher" | "admin") => {
  return render(
    <AuthProvider>
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
        initialEntries={[path]}
      >
        <Routes>
          <Route element={<ProtectedRoute routeType={routeType} />}>
            <Route element={<div>Área protegida</div>} path={path} />
          </Route>
          <Route element={<div>Portal público</div>} path="/portal" />
          <Route element={<div>Tela de login</div>} path="/login" />
          <Route element={<div>Entrada pública</div>} path="/educacao-continuada" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

describe("ProtectedRoute", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("redireciona para login quando não autenticado no modo local", async () => {
    renderProtectedRoute("/professor", "teacher");

    expect(screen.getByText("Tela de login")).toBeInTheDocument();
  });

  it("mostra mensagem amigável quando o perfil logado não tem acesso", async () => {
    storeAuthenticatedUser("student");
    renderProtectedRoute("/professor", "teacher");

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área." })).toBeInTheDocument();
    expect(screen.getByText("Área do Professor")).toBeInTheDocument();
  });

  it("libera a rota administrativa quando o perfil autenticado é admin", async () => {
    storeAuthenticatedUser("admin");
    renderProtectedRoute("/admin/dashboard", "admin");

    expect(screen.getByText("Área protegida")).toBeInTheDocument();
  });

  it("libera a área do professor para perfil teacher", async () => {
    storeAuthenticatedUser("teacher");
    renderProtectedRoute("/professor", "teacher");

    expect(screen.getByText("Área protegida")).toBeInTheDocument();
  });

  it("libera a área do aluno para perfil student", async () => {
    storeAuthenticatedUser("student");
    renderProtectedRoute("/aluno", "student");

    expect(screen.getByText("Área protegida")).toBeInTheDocument();
  });
});
