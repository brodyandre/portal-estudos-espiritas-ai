import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { AlunoPage } from "../pages/AlunoPage";
import { AdminPage } from "../pages/AdminPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
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
import { listAdminUsersList } from "../services/adminUsersListService";
import * as questionsService from "../services/questionsService";

vi.mock("../services/adminUsersListService", () => ({
  listAdminUsersList: vi.fn(),
}));

const listAdminUsersListMock = vi.mocked(listAdminUsersList);

const renderRoute = (path: string, element: ReactNode) => {
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
          <Route element={element} path="*" />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

const getFetchUrl = (input: unknown) => {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (typeof input === "object" && input && "url" in input) {
    return String((input as { url: string }).url);
  }

  return "";
};

const createUserStudyMeetingsEnvelope = (overrides?: {
  group?: { id: string; name: string; status: "active" | "inactive" } | null;
  items?: Array<Record<string, unknown>>;
}) => ({
  success: true,
  message: "Encontros do grupo listados com sucesso.",
  data: {
    group: overrides?.group ?? { id: "group-001", name: "Grupo autenticado", status: "active" },
    items: overrides?.items ?? [
      {
        id: "meeting-001",
        title: "Encontro autenticado",
        description: "Agenda real do grupo autenticado.",
        startsAt: "2026-07-15T20:00:00.000-03:00",
        endsAt: "2026-07-15T21:00:00.000-03:00",
        status: "scheduled",
        meetUrl: "https://meet.google.com/abc-defg-hij",
      },
    ],
  },
  meta: { limit: 3 },
});

const createUserStudyMeetingsErrorEnvelope = (code: string, message: string) => ({
  success: false,
  error: {
    code,
    message,
  },
});

const mockFetchWithUserStudyMeetings = (
  responses: Array<{ ok: boolean; payload: unknown }> = [
    { ok: true, payload: createUserStudyMeetingsEnvelope() },
  ],
) =>
  vi.fn(async (input: unknown) => {
    const url = getFetchUrl(input);

    if (url.includes("/api/me/study-meetings/upcoming")) {
      const response = responses.shift() ?? responses[responses.length - 1] ?? {
        ok: true,
        payload: createUserStudyMeetingsEnvelope(),
      };

      return {
        ok: response.ok,
        json: async () => response.payload,
      };
    }

    throw new Error("backend offline");
  });

describe("paginas principais com fallback local", () => {
  beforeEach(() => {
    listAdminUsersListMock.mockReset();
    listAdminUsersListMock.mockResolvedValue({
      items: [
        {
          id: "admin-user-demo-001",
          name: "Rafael Torres",
          emailMasked: "ra***@demo.local",
          role: "student",
          status: "inactive",
          activationStatus: "activated",
          group: {
            name: "A Caminho da Luz",
            slug: "a-caminho-da-luz",
          },
          createdAt: "2026-07-01T15:05:00.000Z",
        },
        {
          id: "admin-user-demo-002",
          name: "Celia Nogueira",
          emailMasked: "ce***@demo.local",
          role: "teacher",
          status: "active",
          activationStatus: "activated",
          group: {
            name: "Emmanuel",
            slug: "emmanuel",
          },
          createdAt: "2026-06-28T09:45:00.000Z",
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      },
      source: "demo",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("backend offline");
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
    expect(await screen.findByText("Não foi possível carregar a agenda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Materiais de apoio" })).toBeInTheDocument();
    expect(await screen.findByText("Emmanuel - visao geral")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Livro ou grupo"), {
      target: { value: "a-caminho-da-luz" },
    });

    expect(await screen.findByText("A Caminho da Luz - visao geral")).toBeInTheDocument();
  });

  it("/aluno exibe agenda autenticada sem depender do grupo legado selecionado", async () => {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
    vi.stubGlobal("fetch", mockFetchWithUserStudyMeetings());

    renderRoute("/aluno?grupo=emmanuel", <AlunoPage />);

    expect(await screen.findByText("Encontro autenticado")).toBeInTheDocument();
    expect(screen.getByText("Grupo autenticado")).toBeInTheDocument();
    const meetLink = screen.getByRole("link", { name: "Entrar no Google Meet" });
    expect(meetLink).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");

    fireEvent.change(screen.getByLabelText("Livro ou grupo"), {
      target: { value: "a-caminho-da-luz" },
    });

    expect(await screen.findByText("A Caminho da Luz - visao geral")).toBeInTheDocument();
    expect(screen.getByText("Grupo autenticado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar no Google Meet" })).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-defg-hij",
    );
  });

  it("/aluno trata 401 e 403 sem mock nem link", async () => {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
    vi.stubGlobal(
      "fetch",
      mockFetchWithUserStudyMeetings([
        {
          ok: false,
          payload: createUserStudyMeetingsErrorEnvelope("AUTH_REQUIRED", "Autenticação necessária."),
        },
        {
          ok: false,
          payload: createUserStudyMeetingsErrorEnvelope("FORBIDDEN", "Acesso negado."),
        },
      ]),
    );

    const { unmount } = renderRoute("/aluno?grupo=emmanuel", <AlunoPage />);

    expect(await screen.findByText("Sessão necessária")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();

    unmount();
    renderRoute("/aluno?grupo=emmanuel", <AlunoPage />);

    expect(await screen.findByText("Acesso não autorizado")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
  });

  it("/aluno recupera agenda no retry e não cria link quando meetUrl está ausente", async () => {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
    vi.stubGlobal(
      "fetch",
      mockFetchWithUserStudyMeetings([
        {
          ok: false,
          payload: createUserStudyMeetingsErrorEnvelope("AUTH_REQUIRED", "Autenticação necessária."),
        },
        {
          ok: true,
          payload: createUserStudyMeetingsEnvelope({
            items: [
              {
                id: "meeting-sem-link",
                title: "Encontro sem link",
                description: null,
                startsAt: "2026-07-15T20:00:00.000-03:00",
                endsAt: "2026-07-15T21:00:00.000-03:00",
                status: "scheduled",
                meetUrl: null,
              },
            ],
          }),
        },
      ]),
    );

    renderRoute("/aluno?grupo=emmanuel", <AlunoPage />);

    expect(await screen.findByText("Sessão necessária")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Encontro sem link")).toBeInTheDocument();
    expect(screen.getByText("Link do encontro indisponível para esta visualização.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
  });

  it("/aluno envia dúvida com groupId e lessonId legados, sem StudyMeeting.id", async () => {
    window.localStorage.setItem("portal-estudos-espiritas-ai:student-access", "approved");
    vi.stubGlobal("fetch", mockFetchWithUserStudyMeetings());
    const createQuestionSpy = vi.spyOn(questionsService, "createQuestion").mockResolvedValue({
      data: {
        id: "question-test",
        authorName: "Marina Costa",
        groupSlug: "a-caminho-da-luz",
        lessonId: "lesson-a-caminho-da-luz-2026-07-15",
        lessonTitle: "Civilização e responsabilidade espiritual",
        question: "Como revisar este tema com calma?",
        status: "new",
        createdAt: "2026-07-15T12:00:00.000Z",
        visibility: "teacher",
      },
      source: "api",
      notice: null,
    });

    renderRoute("/aluno?grupo=a-caminho-da-luz", <AlunoPage />);

    expect(await screen.findByText("Encontro autenticado")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Sua duvida"), {
      target: { value: "Como revisar este tema com calma?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("button", { name: "Enviar dúvida ao professor" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar dúvida ao professor" }));

    await waitFor(() => {
      expect(createQuestionSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({ lessonId: "meeting-001" }),
      );
    });
    expect(createQuestionSpy).toHaveBeenCalledWith({
      groupId: "a-caminho-da-luz",
      lessonId: "lesson-a-caminho-da-luz-2026-07-15",
      authorName: "Joao Pedro",
      question: "Como revisar este tema com calma?",
      visibility: "teacher",
    });
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

  it("/professor exibe agenda autenticada e mantém workspace sem link legado", async () => {
    vi.stubGlobal("fetch", mockFetchWithUserStudyMeetings());

    renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    expect(await screen.findByText("Encontro autenticado")).toBeInTheDocument();
    expect(screen.getByText("Grupo autenticado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar no Google Meet" })).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-defg-hij",
    );
    expect(await screen.findByText("Base de apoio da aula")).toBeInTheDocument();
    expect(screen.getByLabelText("Link do Google Meet")).toHaveValue("");
  });

  it("/professor trata 401 e 403 sem mock nem link", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchWithUserStudyMeetings([
        {
          ok: false,
          payload: createUserStudyMeetingsErrorEnvelope("AUTH_REQUIRED", "Autenticação necessária."),
        },
        {
          ok: false,
          payload: createUserStudyMeetingsErrorEnvelope("FORBIDDEN", "Acesso negado."),
        },
      ]),
    );

    const { unmount } = renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    expect(await screen.findByText("Sessão necessária")).toBeInTheDocument();
    expect(await screen.findByText("Base de apoio da aula")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();

    unmount();
    renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    expect(await screen.findByText("Acesso não autorizado")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
  });

  it("/professor recupera agenda no retry sem bloquear workspace e sem link ausente", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchWithUserStudyMeetings([
        {
          ok: false,
          payload: createUserStudyMeetingsErrorEnvelope("FORBIDDEN", "Acesso negado."),
        },
        {
          ok: true,
          payload: createUserStudyMeetingsEnvelope({
            items: [
              {
                id: "meeting-sem-link",
                title: "Agenda recuperada",
                description: null,
                startsAt: "2026-07-15T20:00:00.000-03:00",
                endsAt: "2026-07-15T21:00:00.000-03:00",
                status: "scheduled",
                meetUrl: null,
              },
            ],
          }),
        },
      ]),
    );

    renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    expect(await screen.findByText("Acesso não autorizado")).toBeInTheDocument();
    expect(await screen.findByText("Base de apoio da aula")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Agenda recuperada")).toBeInTheDocument();
    expect(screen.getByText("Link do encontro indisponível para esta visualização.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
  });

  it("/professor preserva localStorage antigo e não persiste agenda autenticada", async () => {
    vi.stubGlobal("fetch", mockFetchWithUserStudyMeetings());
    window.localStorage.setItem(
      "portal-estudos:teacher-workspace:emmanuel",
      JSON.stringify({
        selectedBook: "Emmanuel",
        themeChapter: "Tema antigo salvo",
        meetLink: "https://example.com/link-antigo",
        selectedSupportFileIds: [],
        preview: {
          outline: "Roteiro antigo",
          questions: "",
          summary: "",
          message: "",
          review: "",
        },
        reviewState: "draft",
        actionMessage: "Workspace antigo salvo.",
      }),
    );
    window.localStorage.setItem(
      "portal-estudos:teacher-workspace:a-caminho-da-luz",
      JSON.stringify({
        selectedBook: "A Caminho da Luz",
        themeChapter: "Tema antigo do outro grupo",
        meetLink: "https://example.com/link-antigo-outro-grupo",
        selectedSupportFileIds: [],
        preview: {
          outline: "",
          questions: "",
          summary: "",
          message: "",
          review: "",
        },
        reviewState: "draft",
        actionMessage: "Workspace antigo do outro grupo.",
      }),
    );

    renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    expect(await screen.findByText("Encontro autenticado")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Tema ou capitulo")).toHaveValue("Tema antigo salvo");
      expect(screen.getByLabelText("Link do Google Meet")).toHaveValue("https://example.com/link-antigo");
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    const storedWorkspace = JSON.parse(
      window.localStorage.getItem("portal-estudos:teacher-workspace:emmanuel") ?? "{}",
    ) as Record<string, unknown>;

    expect(storedWorkspace.meetLink).toBe("https://example.com/link-antigo");
    expect(storedWorkspace.themeChapter).toBe("Tema antigo salvo");
    expect(JSON.stringify(storedWorkspace)).not.toContain("https://meet.google.com/abc-defg-hij");
    expect(JSON.stringify(storedWorkspace)).not.toContain("Encontro autenticado");

    fireEvent.change(screen.getByLabelText("Grupo ou livro", { selector: "#teacher-book" }), {
      target: { value: "a-caminho-da-luz" },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Link do Google Meet")).toHaveValue(
        "https://example.com/link-antigo-outro-grupo",
      );
    });
    expect(screen.getByText("Encontro autenticado")).toBeInTheDocument();
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

  it("/admin/usuarios renderiza a página dedicada em modo demonstrativo sem ações mutáveis", async () => {
    renderRoute("/admin/usuarios", <AdminUsersPage />);

    expect(await screen.findByRole("heading", { name: "Gestão de usuários" })).toBeInTheDocument();
    expect(
      await screen.findByText("Esta visualização usa apenas dados fictícios e não realiza chamadas para a API local."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Rafael Torres")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar usuário/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Redefinir senha/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(listAdminUsersListMock).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      );
    });
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
  }, 10000);

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
    renderRoute("/aluno", <AlunoPage />);

    expect(await screen.findByText("Painel do Aluno")).toBeInTheDocument();
    expect(await screen.findByText("Não foi possível carregar a agenda")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar no Google Meet" })).not.toBeInTheDocument();
  });
});
