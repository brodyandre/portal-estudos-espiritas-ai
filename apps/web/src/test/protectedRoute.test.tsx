import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "../components/access/ProtectedRoute";

const CURRENT_USER_STORAGE_KEY = "portal-estudos-espiritas-ai:current-user-role";

const renderProtectedRoute = (path: string, routeType: "teacher" | "admin") => {
  return render(
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
        <Route element={<div>Entrada pública</div>} path="/educacao-continuada" />
      </Routes>
    </MemoryRouter>,
  );
};

describe("ProtectedRoute", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("mostra mensagem amigável quando o perfil não tem acesso", async () => {
    window.sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, "visitor");
    renderProtectedRoute("/professor", "teacher");

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área." })).toBeInTheDocument();
    expect(screen.getByText("Área do Professor")).toBeInTheDocument();
  });

  it("libera a rota administrativa quando o perfil demo é admin", async () => {
    window.sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, "admin");
    renderProtectedRoute("/admin/dashboard", "admin");

    expect(screen.getByText("Área protegida")).toBeInTheDocument();
  });
});
