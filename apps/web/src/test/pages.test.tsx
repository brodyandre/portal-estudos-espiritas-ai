import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlunoPage } from "../pages/AlunoPage";
import { AdminPage } from "../pages/AdminPage";
import { resetMockAdminAuditEvents } from "../mocks/adminAudit";
import { resetMockAdminContents } from "../mocks/adminContents";
import { resetMockAdminGroups } from "../mocks/adminGroups";
import { resetMockAdminSettings } from "../mocks/adminSettings";
import { EducationContinuedPage } from "../pages/EducationContinuedPage";
import { EnrollmentPage } from "../pages/EnrollmentPage";
import { resetMockAdminUsers } from "../mocks/adminUsers";
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
    resetMockAdminAuditEvents();
    resetMockAdminContents();
    resetMockAdminGroups();
    resetMockAdminSettings();
    resetMockAdminUsers();
    resetMockEnrollments();
  });

  it("/portal renderiza com os grupos em modo demonstrativo", async () => {
    renderRoute("/portal", <PortalPage />);

    expect(
      screen.getByRole("heading", { name: "Boas-vindas à Educação Continuada" }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "Emmanuel" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 3, name: "A Caminho da Luz" }),
    ).toBeInTheDocument();
  });

  it("/educacao-continuada renderiza a entrada publica do QR Code", async () => {
    renderRoute("/educacao-continuada", <EducationContinuedPage />);

    expect(screen.getByRole("heading", { name: "Educação Continuada Online" })).toBeInTheDocument();
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
      target: { value: "+55 00 90000-0098" },
    });
    fireEvent.click(screen.getByLabelText(/Autorizo o uso dos meus dados/i));
    fireEvent.click(screen.getByRole("button", { name: "Enviar inscricao" }));

    expect(await screen.findByRole("heading", { name: "Solicitação recebida" })).toBeInTheDocument();
    expect(
      await screen.findByText("Modo demonstrativo: para aprovação real de alunos, rode o backend local."),
    ).toBeInTheDocument();
  });

  it("/aluno renderiza materiais dos dois grupos e continua util sem backend", async () => {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
    renderRoute("/aluno?grupo=emmanuel", <AlunoPage />);

    expect(
      screen.getByRole("heading", { name: "Educação Continuada" }),
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

    expect(screen.getByRole("heading", { name: "Acesso não liberado" })).toBeInTheDocument();
    expect(await screen.findByText("Revisão antes do acesso")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Fazer inscricao" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
  });

  it("/professor renderiza a base de apoio e troca o contexto do livro sem backend", async () => {
    renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    expect(
      screen.getByRole("heading", { name: "Educação Continuada" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo ativo")).toBeInTheDocument();
    expect(await screen.findByText("Base de apoio da aula")).toBeInTheDocument();
    expect(await screen.findByText("Novos interessados")).toBeInTheDocument();
    expect(await screen.findByText("solicitações aguardando revisão")).toBeInTheDocument();
    expect(await screen.findByText("Há novas solicitações aguardando revisão.")).toBeInTheDocument();
    const summaryCard = document.querySelector(".teacher-enrollment-summary") as HTMLElement | null;
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).getByText("Emmanuel")).toBeInTheDocument();
    expect(within(summaryCard as HTMLElement).getByText("A Caminho da Luz")).toBeInTheDocument();
    expect(within(summaryCard as HTMLElement).getByText("Ainda não sei")).toBeInTheDocument();
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

  it("/admin/dashboard renderiza os indicadores com fallback demonstrativo", async () => {
    renderRoute("/admin/dashboard", <AdminPage section="dashboard" />);

    expect(screen.getByRole("heading", { name: "Educação Continuada" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Dashboard administrativo" })).toBeInTheDocument();
    expect(await screen.findByText("Inscrições pendentes")).toBeInTheDocument();
    expect(await screen.findByText("Alunos ativos")).toBeInTheDocument();
    expect(await screen.findByText("Professores")).toBeInTheDocument();
    expect(await screen.findByText("Grupos de estudo")).toBeInTheDocument();
    expect(await screen.findByText("Materiais publicados")).toBeInTheDocument();
    expect(await screen.findByText("Revisões sensíveis")).toBeInTheDocument();
    expect((await screen.findAllByText("fallback demonstrativo")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: "Abrir usuários" })).toBeInTheDocument();
  });

  it("/admin/usuarios filtra perfis e registra ação simulada no log local", async () => {
    renderRoute("/admin/usuarios", <AdminPage section="usuarios" />);

    expect(await screen.findByRole("heading", { name: "Gestão de usuários" })).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo de usuários")).toBeInTheDocument();
    expect(await screen.findByText("Rafael Torres")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Perfil"), {
      target: { value: "teacher" },
    });

    await waitFor(() => {
      expect(screen.getByText("Celia Nogueira")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Perfil"), {
      target: { value: "all" },
    });

    const userCard = screen.getByText("Rafael Torres").closest(".admin-user-card") as HTMLElement | null;
    expect(userCard).not.toBeNull();

    fireEvent.click(
      within(userCard as HTMLElement).getByRole("button", { name: "Ativar usuário Rafael Torres" }),
    );

    await waitFor(() => {
      expect(within(userCard as HTMLElement).getByText("Ativo")).toBeInTheDocument();
    });

    expect((await screen.findAllByText("Ativou o usuário Rafael Torres.")).length).toBeGreaterThan(0);
  });

  it("/admin/grupos renderiza os grupos e alterna o status em modo demonstrativo", async () => {
    renderRoute("/admin/grupos", <AdminPage section="grupos" />);

    expect(await screen.findByRole("heading", { name: "Gestão de grupos" })).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo de grupos")).toBeInTheDocument();
    expect(await screen.findByText(/mostramos apenas um link demonstrativo/i)).toBeInTheDocument();

    const emmanuelNameInput = document.querySelector("#admin-group-name-emmanuel");
    const caminhoNameInput = document.querySelector("#admin-group-name-a-caminho-da-luz");

    expect(emmanuelNameInput).toBeInTheDocument();
    expect(caminhoNameInput).toBeInTheDocument();

    const groupCard = emmanuelNameInput?.closest(".admin-group-card") as HTMLElement | null;
    expect(groupCard).not.toBeNull();

    fireEvent.click(
      within(groupCard as HTMLElement).getByRole("button", { name: "Inativar grupo Emmanuel" }),
    );

    await waitFor(() => {
      expect(within(groupCard as HTMLElement).getByText("Inativo")).toBeInTheDocument();
    });
  });

  it("/admin/conteudos renderiza a base, filtra por livro e marca revisão", async () => {
    renderRoute("/admin/conteudos", <AdminPage section="conteudos" />);

    expect(await screen.findByRole("heading", { name: "Gestão de conteúdos" })).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo de conteúdos")).toBeInTheDocument();
    expect(await screen.findByText("Emmanuel - capitulo 1 - almas enfraquecidas")).toBeInTheDocument();
    expect((await screen.findAllByText("Exige revisão humana")).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Livro ou grupo"), {
      target: { value: "a-caminho-da-luz" },
    });

    await waitFor(() => {
      expect(screen.getByText("A Caminho da Luz - civilizacoes antigas")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "faq" },
    });

    await waitFor(() => {
      expect(screen.getByText("A Caminho da Luz - duvidas frequentes")).toBeInTheDocument();
    });

    const contentCard = screen
      .getByText("A Caminho da Luz - duvidas frequentes")
      .closest(".admin-content-card") as HTMLElement | null;
    expect(contentCard).not.toBeNull();

    fireEvent.click(
      within(contentCard as HTMLElement).getByRole("button", {
        name: "Marcar A Caminho da Luz - duvidas frequentes como revisado",
      }),
    );

    await waitFor(() => {
      expect(within(contentCard as HTMLElement).getByText("Revisado")).toBeInTheDocument();
    });
  });

  it("/admin/configuracoes renderiza e salva ajustes em modo demonstrativo", async () => {
    renderRoute("/admin/configuracoes", <AdminPage section="configuracoes" />);

    expect(await screen.findByRole("heading", { name: "Configurações do sistema" })).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo de configurações")).toBeInTheDocument();
    expect(await screen.findByText("Configurações sensíveis devem ficar no backend em produção.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome do portal"), {
      target: { value: "Educação Continuada Portal" },
    });
    fireEvent.change(screen.getByLabelText("Modo de publicação"), {
      target: { value: "local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configurações do sistema" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Educação Continuada Portal")).toBeInTheDocument();
    });

    expect(await screen.findByText("Configurações demonstrativas salvas com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("Uso local autorizado")).toBeInTheDocument();
  });

  it("/admin/auditoria renderiza eventos importantes do MVP", async () => {
    renderRoute("/admin/auditoria", <AdminPage section="auditoria" />);

    expect(await screen.findByRole("heading", { name: "Auditoria demonstrativa" })).toBeInTheDocument();
    expect(await screen.findByText("Modo demonstrativo de auditoria")).toBeInTheDocument();
    expect(await screen.findByText("Aluno inscrito")).toBeInTheDocument();
    expect(await screen.findByText("Professor aprovou aluno")).toBeInTheDocument();
    expect(await screen.findByText("Admin alterou configuração")).toBeInTheDocument();
    expect(await screen.findByText(/não registra conteúdo de mensagens privadas/i)).toBeInTheDocument();
    expect((await screen.findAllByText("Admin")).length).toBeGreaterThan(0);
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
