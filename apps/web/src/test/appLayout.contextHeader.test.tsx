import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppUser } from "../auth/types";
import { AppLayout } from "../components/layout/AppLayout";

const authState = vi.hoisted(() => ({
  value: {
    user: null as AppUser | null,
    token: null as string | null,
    isAuthenticated: false,
    isLoading: false,
    isDemoMode: false,
    requiresPasswordChange: false,
    isEndingSession: false,
    notice: null,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    logoutOthers: vi.fn(),
    clearNotice: vi.fn(),
  },
}));

vi.mock("../auth/useAuth", () => ({
  useAuth: () => authState.value,
}));

const adminUser: AppUser = {
  id: "admin-user",
  fullName: "Admin Local",
  email: "admin.local@example.com",
  role: "admin",
  status: "active",
  mustChangePassword: false,
  passwordChangedAt: "2026-07-12T09:00:00.000Z",
  permissions: [],
};

const renderLayout = (path = "/admin/usuarios") => {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      }}
      initialEntries={[path]}
    >
      <Routes>
        <Route element={<AppLayout area="admin" />} path="*">
          <Route element={<section>Conteúdo da página</section>} path="*" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

describe("AppLayout context header", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authState.value = {
      ...authState.value,
      user: null,
      token: null,
      isAuthenticated: false,
      isDemoMode: false,
      isEndingSession: false,
      logout: vi.fn(),
    };
  });

  it("organiza o modo demonstrativo sem duplicar papel e status", () => {
    authState.value = {
      ...authState.value,
      user: adminUser,
      isAuthenticated: true,
      isDemoMode: true,
    };

    renderLayout();

    const contextBar = screen.getByLabelText("Contexto da página");
    expect(within(contextBar).getByText("Área administrativa")).toBeInTheDocument();
    expect(within(contextBar).getByText("Usuários")).toBeInTheDocument();
    expect(within(contextBar).getByText("Perfis, papéis e situação dos acessos cadastrados.")).toBeInTheDocument();
    expect(within(contextBar).getByText("Modo demonstrativo")).toBeInTheDocument();

    const demoGroup = screen.getByRole("group", { name: "Visualizar como perfil demonstrativo" });
    expect(within(demoGroup).getByText("Visualizar como")).toBeInTheDocument();
    expect(within(demoGroup).getByRole("button", { name: "Público" })).toHaveAttribute("aria-pressed", "true");
    expect(within(demoGroup).getByRole("button", { name: "Aluno" })).toBeInTheDocument();
    expect(within(demoGroup).getByRole("button", { name: "Professor" })).toBeInTheDocument();
    expect(within(demoGroup).getByRole("button", { name: "Admin" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Perfil atual: Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Ativo")).not.toBeInTheDocument();
  });

  it("preserva sessão real, ações de conta e aparência sem mostrar simulador", () => {
    authState.value = {
      ...authState.value,
      user: adminUser,
      token: "token-local",
      isAuthenticated: true,
      isDemoMode: false,
    };

    renderLayout();

    expect(screen.queryByText("Modo demonstrativo")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Visualizar como perfil demonstrativo" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Perfil atual: Admin")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Segurança" })).toHaveAttribute("href", "/minha-conta/seguranca");
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();

    const appearanceGroup = screen.getByRole("group", { name: "Escolher aparência da interface" });
    expect(within(appearanceGroup).getByText("Aparência")).toBeInTheDocument();
    expect(within(appearanceGroup).getByRole("button", { name: "Claro" })).toHaveAttribute("aria-pressed", "true");
    expect(within(appearanceGroup).getByRole("button", { name: "Neutro" })).toBeInTheDocument();
    expect(within(appearanceGroup).getByRole("button", { name: "Escuro" })).toBeInTheDocument();
  });
});
