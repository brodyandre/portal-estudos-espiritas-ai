import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlunoPage } from "../pages/AlunoPage";
import { EducationContinuedPage } from "../pages/EducationContinuedPage";
import { EnrollmentPage } from "../pages/EnrollmentPage";
import { resetMockEnrollments } from "../mocks/enrollments";
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
    window.sessionStorage.clear();
    resetMockEnrollments();
  });

  it("/portal renderiza com os grupos em modo demonstrativo", async () => {
    renderRoute("/portal", <PortalPage />);

    expect(
      screen.getByRole("heading", { name: "Boas-vindas a Educacao Continuada" }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "Emmanuel" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 3, name: "A Caminho da Luz" }),
    ).toBeInTheDocument();
  });

  it("/educacao-continuada renderiza a entrada publica do QR Code", async () => {
    renderRoute("/educacao-continuada", <EducationContinuedPage />);

    expect(screen.getByRole("heading", { name: "Educacao Continuada Online" })).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "Emmanuel" })).toBeInTheDocument();
  });

  it("/inscricao envia cadastro em modo demonstrativo", async () => {
    renderRoute("/inscricao", <EnrollmentPage />);

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Aluno Demo" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "aluno.demo@example.com" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "(11) 99999-9999" },
    });
    fireEvent.click(screen.getByLabelText(/Autorizo o uso dos meus dados/i));
    fireEvent.click(screen.getByRole("button", { name: "Enviar inscricao" }));

    expect(await screen.findByRole("heading", { name: "Solicitacao recebida" })).toBeInTheDocument();
    expect(
      await screen.findByText("Modo demonstrativo: para aprovação real de alunos, rode o backend local."),
    ).toBeInTheDocument();
  });

  it("/aluno renderiza materiais dos dois grupos e continua util sem backend", async () => {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
    renderRoute("/aluno?grupo=emmanuel", <AlunoPage />);

    expect(
      screen.getByRole("heading", { name: "Educacao Continuada" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Entrar no Google Meet" }).length).toBeGreaterThan(0);
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
      screen.getByRole("heading", { name: "Educacao Continuada" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByText("Base de apoio da aula")).toBeInTheDocument();
    expect(await screen.findByText("Novos interessados")).toBeInTheDocument();
    expect(await screen.findByText("solicitacoes aguardando revisao")).toBeInTheDocument();
    expect(await screen.findByText("Ha novas solicitacoes aguardando revisao.")).toBeInTheDocument();
    const summaryCard = document.querySelector(".teacher-enrollment-summary") as HTMLElement | null;
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).getByText("Emmanuel")).toBeInTheDocument();
    expect(within(summaryCard as HTMLElement).getByText("A Caminho da Luz")).toBeInTheDocument();
    expect(within(summaryCard as HTMLElement).getByText("Ainda nao sei")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Copiar mensagem pronta para/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Abrir WhatsApp para/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Copiar e-mail de/i }).length).toBeGreaterThan(0);
    expect(
      await screen.findByText("Modo demonstrativo: para aprovação real de alunos, rode o backend local."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Emmanuel - visao geral")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Grupo ou livro", { selector: "#teacher-group-select" }), {
      target: { value: "a-caminho-da-luz" },
    });

    await waitFor(() => {
      expect(screen.getByText("A Caminho da Luz - visao geral")).toBeInTheDocument();
    });
  });

  it("professor aprova interessado e o acesso demonstrativo do aluno e liberado", async () => {
    const professorView = renderRoute("/professor", <ProfessorPage />);

    expect(await screen.findByText("Novos interessados")).toBeInTheDocument();

    const enrollmentCard = screen
      .getByText("Mariana Souza")
      .closest(".teacher-enrollment-item") as HTMLElement | null;

    expect(enrollmentCard).not.toBeNull();
    fireEvent.click(within(enrollmentCard as HTMLElement).getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("portal-estudos-espiritas-ai:student-access")).toBe("approved");
    });

    professorView.unmount();
    cleanup();
    renderRoute("/aluno", <AlunoPage />);

    expect(await screen.findByText("Painel do Aluno")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Entrar no Google Meet" }).length).toBeGreaterThan(0);
  });
});
