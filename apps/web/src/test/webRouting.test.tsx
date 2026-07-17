import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { ProtectedRoute } from "../components/access/ProtectedRoute";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LoginPage } from "../pages/LoginPage";
import {
  buildPublicRouteUrl,
  normalizeBrowserBasename,
  resolveSafeRedirectTarget,
} from "../routing/publicUrls";
import {
  buildLegacyHashRedirectPath,
  redirectLegacyHashRoute,
} from "../routing/legacyHashRedirect";

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
      mustChangePassword: false,
      passwordChangedAt: "2026-07-12T09:00:00.000Z",
      permissions: [],
    }),
  );
};

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
};

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("public routing helpers", () => {
  it("normaliza basename para raiz e subpath do Pages", () => {
    expect(normalizeBrowserBasename("/")).toBe("/");
    expect(normalizeBrowserBasename("/portal-estudos-espiritas-ai/")).toBe("/portal-estudos-espiritas-ai");
  });

  it("monta URL pública limpa respeitando BASE_URL", () => {
    expect(buildPublicRouteUrl("/admin", { origin: "https://example.test" }, "/")).toBe(
      "https://example.test/admin",
    );
    expect(buildPublicRouteUrl("/admin", { origin: "https://example.test" }, "/repo/")).toBe(
      "https://example.test/repo/admin",
    );
  });

  it("rejeita destinos internos perigosos", () => {
    expect(() => buildPublicRouteUrl("//evil.example", { origin: "https://example.test" })).toThrow(
      "caminho interno",
    );
    expect(resolveSafeRedirectTarget({ from: { pathname: "//evil.example" } }, "/aluno")).toBe("/aluno");
    expect(resolveSafeRedirectTarget({ from: { pathname: "https://evil.example" } }, "/aluno")).toBe("/aluno");
  });

  it("preserva pathname e query em return URL segura", () => {
    expect(
      resolveSafeRedirectTarget(
        { from: { pathname: "/admin/usuarios", search: "?page=2" } },
        "/aluno",
      ),
    ).toBe("/admin/usuarios?page=2");
  });
});

describe("legacy hash redirect", () => {
  it("converte hash route limpa preservando query", () => {
    expect(buildLegacyHashRedirectPath("#/admin", "/")).toBe("/admin");
    expect(buildLegacyHashRedirectPath("#/redefinir-senha?token=abc", "/")).toBe(
      "/redefinir-senha?token=abc",
    );
    expect(buildLegacyHashRedirectPath("#/login", "/repo/")).toBe("/repo/login");
  });

  it("ignora âncoras comuns e rejeita open redirect", () => {
    expect(buildLegacyHashRedirectPath("#main-content", "/")).toBeNull();
    expect(buildLegacyHashRedirectPath("#//evil.example", "/")).toBeNull();
  });

  it("usa replaceState sem adicionar entrada no histórico", () => {
    const replaceState = vi.fn();
    const changed = redirectLegacyHashRoute(
      { hash: "#/admin?tab=usuarios" },
      { replaceState },
      "/portal-estudos-espiritas-ai/",
    );

    expect(changed).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/portal-estudos-espiritas-ai/admin?tab=usuarios",
    );
  });
});

describe("BrowserRouter route tree behavior", () => {
  it("renderiza 404 real sem redirecionar automaticamente", () => {
    render(
      <MemoryRouter initialEntries={["/rota-inexistente"]}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Não encontramos esta página" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });

  it("preserva query quando rota protegida redireciona ao login", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/admin/usuarios?page=2"]}>
          <Routes>
            <Route element={<ProtectedRoute routeType="admin" />}>
              <Route element={<div>Admin</div>} path="/admin/usuarios" />
            </Route>
            <Route element={<LoginPage />} path="/login" />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole("heading", { name: "Entrar no portal" })).toBeInTheDocument();
  });

  it("mantém bloqueio por role incorreta", () => {
    storeAuthenticatedUser("student");

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/admin/usuarios?page=2"]}>
          <Routes>
            <Route element={<ProtectedRoute routeType="admin" />}>
              <Route element={<div>Admin</div>} path="/admin/usuarios" />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área." })).toBeInTheDocument();
  });

  it("permite rota administrativa para admin com query preservada", () => {
    storeAuthenticatedUser("admin");

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/admin/usuarios?page=2"]}>
          <Routes>
            <Route element={<ProtectedRoute routeType="admin" />}>
              <Route element={<LocationProbe />} path="/admin/usuarios" />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/admin/usuarios?page=2");
  });
});
