import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlunoPage } from "../pages/AlunoPage";
import { PortalPage } from "../pages/PortalPage";
import { ProfessorPage } from "../pages/ProfessorPage";

const renderRoute = (path: string, element: ReactNode) => {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      }}
      initialEntries={[path]}
    >
      <Routes>
        <Route element={element} path="*" />
      </Routes>
    </MemoryRouter>,
  );
};

describe("paginas principais com fallback local", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("backend offline");
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("/portal renderiza com os grupos em modo demonstrativo", async () => {
    renderRoute("/portal", <PortalPage />);

    expect(
      screen.getByRole("heading", { name: "Boas-vindas aos estudos espiritas online" }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "Emmanuel" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 3, name: "A Caminho da Luz" }),
    ).toBeInTheDocument();
  });

  it("/aluno renderiza materiais dos dois grupos e continua util sem backend", async () => {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
    renderRoute("/aluno?grupo=emmanuel", <AlunoPage />);

    expect(
      screen.getByRole("heading", { name: "Portal dos Estudos Espiritas Online" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Materiais de apoio" })).toBeInTheDocument();
    expect(await screen.findByText("Emmanuel - visao geral")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Livro ou grupo"), {
      target: { value: "a-caminho-da-luz" },
    });

    expect(await screen.findByText("A Caminho da Luz - visao geral")).toBeInTheDocument();
  });

  it("/aluno bloqueia visitantes e oculta a area quando o acesso nao foi aprovado", async () => {
    renderRoute("/aluno", <AlunoPage />);

    expect(screen.getByRole("heading", { name: "Acesso nao liberado" })).toBeInTheDocument();
    expect(await screen.findByText("Revisao antes do acesso")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Fazer inscricao" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
  });

  it("/professor renderiza a base de apoio e troca o contexto do livro sem backend", async () => {
    renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    expect(
      screen.getByRole("heading", { name: "Portal dos Estudos Espiritas Online" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByText("Base de apoio da aula")).toBeInTheDocument();
    expect(await screen.findByText("Emmanuel - visao geral")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Grupo ou livro", { selector: "#teacher-group-select" }), {
      target: { value: "a-caminho-da-luz" },
    });

    await waitFor(() => {
      expect(screen.getByText("A Caminho da Luz - visao geral")).toBeInTheDocument();
    });
  });
});
