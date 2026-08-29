import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import type { UserRole } from "../auth/types";
import { AlunoPage } from "../pages/AlunoPage";
import { ProfessorPage } from "../pages/ProfessorPage";
import type { UserBookAccessGroup } from "../types/bookAccess";

const storeAuthenticatedUser = (role: Extract<UserRole, "student" | "teacher" | "admin">) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-local");
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

const getRequestBody = (init: unknown) => {
  if (!init || typeof init !== "object" || !("body" in init) || typeof init.body !== "string") {
    return null;
  }

  return JSON.parse(init.body) as Record<string, unknown>;
};

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

const emmanuelAccess = {
  id: "emmanuel",
  name: "Emmanuel",
  knowledgeBook: { id: "book-emmanuel", slug: "emmanuel", title: "Emmanuel" },
};

const caminhoAccess = {
  id: "a-caminho-da-luz",
  name: "A Caminho da Luz",
  knowledgeBook: {
    id: "book-a-caminho-da-luz",
    slug: "a-caminho-da-luz",
    title: "A Caminho da Luz",
  },
};

const obrasAccess: UserBookAccessGroup = {
  id: "obras-postumas",
  name: "Grupo Obras Póstumas",
  knowledgeBook: {
    id: "book-obras-postumas",
    slug: "obras-postumas",
    title: "Obras Póstumas",
  },
};

interface TestApiStudy {
  id: string;
  name: string;
  meetingDay: string | null;
  meetingTime: string | null;
  participantCount: number | null;
  bookTitle: string;
  meetUrl: string | null;
  description: string | null;
  nextLesson: {
    id: string;
    title: string;
    theme: string;
    scheduledAt: string;
    meetUrl: string | null;
    status: string;
    teacherNote: string;
  } | null;
}

const baseStudiesData: TestApiStudy[] = [
  {
    id: "emmanuel",
    name: "Grupo Emmanuel legado",
    meetingDay: null,
    meetingTime: null,
    participantCount: null,
    bookTitle: "valor legado",
    meetUrl: null,
    description: "Descrição operacional Emmanuel.",
    nextLesson: {
      id: "lesson-emmanuel",
      title: "Aula Emmanuel",
      theme: "Tema Emmanuel",
      scheduledAt: "2026-07-15T20:00:00.000-03:00",
      meetUrl: null,
      status: "scheduled",
      teacherNote: "Nota Emmanuel.",
    },
  },
  {
    id: "a-caminho-da-luz",
    name: "Grupo A Caminho legado",
    meetingDay: null,
    meetingTime: null,
    participantCount: null,
    bookTitle: "outro valor legado",
    meetUrl: null,
    description: "Descrição operacional A Caminho.",
    nextLesson: {
      id: "lesson-caminho",
      title: "Aula A Caminho",
      theme: "Tema A Caminho",
      scheduledAt: "2026-07-16T20:00:00.000-03:00",
      meetUrl: null,
      status: "scheduled",
      teacherNote: "Nota A Caminho.",
    },
  },
];

const obrasStudy: TestApiStudy = {
  id: "obras-postumas",
  name: "Grupo Obras Póstumas legado",
  meetingDay: "quarta-feira",
  meetingTime: "20:00",
  participantCount: 12,
  bookTitle: "valor operacional que não é authority",
  meetUrl: null,
  description: "Descrição operacional Obras.",
  nextLesson: {
    id: "lesson-obras",
    title: "Aula Obras Póstumas",
    theme: "Tema operacional Obras",
    scheduledAt: "2026-07-17T20:00:00.000-03:00",
    meetUrl: null,
    status: "scheduled",
    teacherNote: "Nota Obras.",
  },
};

const buildStudiesEnvelope = (data = baseStudiesData) => ({
  success: true,
  message: "Grupos listados com sucesso.",
  data,
});

const emptyMeetingsEnvelope = {
  success: true,
  message: "Encontros listados com sucesso.",
  data: {
    group: null,
    groups: [],
    items: [],
  },
  meta: { limit: 3 },
};

const knowledgeEnvelope = (group: "emmanuel" | "a_caminho_da_luz") => ({
  success: true,
  message: "Arquivos listados com sucesso.",
  data: [
    {
      id: `knowledge-${group}`,
      title: group === "emmanuel" ? "Emmanuel - visao geral" : "A Caminho da Luz - visao geral",
      filename: `${group}.md`,
      group: group === "emmanuel" ? "Emmanuel" : "A Caminho da Luz",
      book: group === "emmanuel" ? "Emmanuel" : "A Caminho da Luz",
      type: "visao_geral",
      tags: ["estudo"],
      summary: "Resumo autorizado.",
      teacherReviewRecommended: false,
      sensitiveTopics: [],
    },
  ],
});

const createFetchMock = (options: {
  accessGroups?: UserBookAccessGroup[];
  bookAccessError?: { code: string; message: string };
  agentError?: { code: string; message: string };
  studiesData?: TestApiStudy[];
} = {}) => {
  const calls = {
    bookAccess: 0,
    knowledgeUrls: [] as string[],
    agentBodies: [] as Array<Record<string, unknown>>,
  };

  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = getFetchUrl(input);

    if (url.includes("/api/me/book-access")) {
      calls.bookAccess += 1;

      if (options.bookAccessError) {
        return {
          ok: false,
          json: async () => ({
            success: false,
            error: options.bookAccessError,
          }),
        };
      }

      const groups = options.accessGroups ?? [emmanuelAccess];
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: "Vínculos de livros listados com sucesso.",
          data: { groups },
          meta: { count: groups.length },
        }),
      };
    }

    if (url.endsWith("/api/studies")) {
      return { ok: true, json: async () => buildStudiesEnvelope(options.studiesData) };
    }

    if (url.includes("/api/me/study-meetings/upcoming")) {
      return { ok: true, json: async () => emptyMeetingsEnvelope };
    }

    if (url.includes("/api/knowledge/emmanuel/files")) {
      calls.knowledgeUrls.push(url);
      return { ok: true, json: async () => knowledgeEnvelope("emmanuel") };
    }

    if (url.includes("/api/knowledge/a_caminho_da_luz/files")) {
      calls.knowledgeUrls.push(url);
      return { ok: true, json: async () => knowledgeEnvelope("a_caminho_da_luz") };
    }

    if (url.includes("/api/agent/")) {
      const body = getRequestBody(init);
      if (body) {
        calls.agentBodies.push(body);
      }

      if (options.agentError) {
        return {
          ok: false,
          json: async () => ({
            success: false,
            error: options.agentError,
          }),
        };
      }

      if (url.includes("/api/agent/answer")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              answer: "Resposta canônica.",
              group: { id: "emmanuel", name: "Emmanuel", bookTitle: "Emmanuel", matchMode: "selected_group" },
              sources: [],
              needsTeacherReview: true,
              safetyNotes: [],
              provider: "local",
              usedFallback: false,
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            title: "Roteiro",
            content: "Conteúdo canônico.",
            provider: "local",
            usedFallback: false,
            reviewNote: "Revise antes de publicar.",
            sourceNote: "Fonte canônica.",
          },
        }),
      };
    }

    throw new Error("backend offline");
  });

  return { fetchMock, calls };
};

describe("BookAccess frontend authority", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("Professor usa BookAccess como authority, mantém grupo sem agenda e carrega knowledge apenas autorizado", async () => {
    storeAuthenticatedUser("teacher");
    const { fetchMock, calls } = createFetchMock({ accessGroups: [emmanuelAccess] });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/professor?grupo=a-caminho-da-luz", <ProfessorPage />);

    const groupSelect = (await screen.findByLabelText("Grupo ou livro", {
      selector: "#teacher-group-select",
    })) as HTMLSelectElement;

    await waitFor(() => {
      expect(groupSelect.value).toBe("emmanuel");
    });

    expect([...groupSelect.options].map((option) => option.value)).toEqual(["emmanuel"]);
    expect(screen.getByRole("heading", { level: 2, name: "Emmanuel" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "A Caminho da Luz" })).not.toBeInTheDocument();
    expect(screen.queryByText("valor legado")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(calls.knowledgeUrls.some((url) => url.includes("/api/knowledge/emmanuel/files"))).toBe(true);
    });
    expect(calls.knowledgeUrls.some((url) => url.includes("a_caminho_da_luz"))).toBe(false);
  });

  it("Professor descarta selectedBook forjado no localStorage e envia Agent com livro canônico", async () => {
    storeAuthenticatedUser("teacher");
    window.localStorage.setItem(
      "portal-estudos:teacher-workspace:emmanuel",
      JSON.stringify({
        selectedBook: "A Caminho da Luz",
        themeChapter: "Tema salvo",
        meetLink: "",
        selectedSupportFileIds: [],
        preview: { outline: "", questions: "", summary: "", message: "", review: "" },
        reviewState: "draft",
        actionMessage: "Workspace salvo.",
      }),
    );
    const { fetchMock, calls } = createFetchMock({ accessGroups: [emmanuelAccess] });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/professor?grupo=grupo-inexistente", <ProfessorPage />);

    await screen.findByRole("heading", { level: 2, name: "Emmanuel" });
    fireEvent.click(screen.getByRole("button", { name: "Gerar roteiro da aula" }));

    await waitFor(() => {
      expect(calls.agentBodies).toHaveLength(1);
    });
    expect(calls.agentBodies[0]).toMatchObject({
      groupId: "emmanuel",
      bookTitle: "Emmanuel",
    });
    expect(JSON.stringify(calls.agentBodies[0])).not.toContain("A Caminho da Luz");
  });

  it("Professor seleciona terceiro grupo autorizado, lê workspace próprio e envia Agent canônico", async () => {
    storeAuthenticatedUser("teacher");
    window.localStorage.setItem(
      "portal-estudos:teacher-workspace:obras-postumas",
      JSON.stringify({
        selectedBook: "Livro salvo forjado",
        themeChapter: "Tema salvo Obras",
        meetLink: "",
        selectedSupportFileIds: [],
        preview: { outline: "", questions: "", summary: "", message: "", review: "" },
        reviewState: "draft",
        actionMessage: "Workspace salvo.",
      }),
    );
    const { fetchMock, calls } = createFetchMock({
      accessGroups: [obrasAccess],
      studiesData: [obrasStudy],
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/professor?grupo=obras-postumas", <ProfessorPage />);

    const groupSelect = (await screen.findByLabelText("Grupo ou livro", {
      selector: "#teacher-group-select",
    })) as HTMLSelectElement;

    await waitFor(() => {
      expect(groupSelect.value).toBe("obras-postumas");
    });
    expect(screen.getByRole("heading", { level: 2, name: "Grupo Obras Póstumas" })).toBeInTheDocument();
    expect(document.getElementById("professor-grupo-obras-postumas")).toBeInTheDocument();
    expect(screen.getByLabelText("Tema ou capitulo")).toHaveValue("Tema salvo Obras");
    expect(calls.knowledgeUrls).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Gerar roteiro da aula" }));

    await waitFor(() => {
      expect(calls.agentBodies).toHaveLength(1);
    });
    expect(calls.agentBodies[0]).toMatchObject({
      groupId: "obras-postumas",
      bookTitle: "Obras Póstumas",
    });
    expect(JSON.stringify(calls.agentBodies[0])).not.toContain("emmanuel");
    expect(JSON.stringify(calls.agentBodies[0])).not.toContain("a-caminho-da-luz");
  });

  it("Professor ignora query e workspace de terceiro grupo sem BookAccess", async () => {
    storeAuthenticatedUser("teacher");
    window.localStorage.setItem(
      "portal-estudos:teacher-workspace:obras-postumas",
      JSON.stringify({
        selectedBook: "Obras Póstumas",
        themeChapter: "Tema não autorizado",
        meetLink: "",
        selectedSupportFileIds: [],
        preview: { outline: "", questions: "", summary: "", message: "", review: "" },
        reviewState: "draft",
        actionMessage: "Workspace salvo.",
      }),
    );
    const { fetchMock, calls } = createFetchMock({
      accessGroups: [emmanuelAccess],
      studiesData: [baseStudiesData[0], obrasStudy],
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/professor?grupo=obras-postumas", <ProfessorPage />);

    const groupSelect = (await screen.findByLabelText("Grupo ou livro", {
      selector: "#teacher-group-select",
    })) as HTMLSelectElement;

    await waitFor(() => {
      expect(groupSelect.value).toBe("emmanuel");
    });
    expect(screen.queryByRole("heading", { level: 2, name: "Grupo Obras Póstumas" })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Tema não autorizado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gerar roteiro da aula" }));

    await waitFor(() => {
      expect(calls.agentBodies).toHaveLength(1);
    });
    expect(calls.agentBodies[0]).toMatchObject({
      groupId: "emmanuel",
      bookTitle: "Emmanuel",
    });
    expect(JSON.stringify(calls.agentBodies[0])).not.toContain("Obras Póstumas");
  });

  it("Professor mostra 503 BookAccess terminal sem grupos de studies", async () => {
    storeAuthenticatedUser("teacher");
    const { fetchMock } = createFetchMock({
      bookAccessError: {
        code: "BOOK_ACCESS_CATALOG_UNAVAILABLE",
        message: "Catálogo indisponível.",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/professor", <ProfessorPage />);

    expect(await screen.findByText("Acesso aos livros indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "A Caminho da Luz" })).not.toBeInTheDocument();
  });

  it("ADMIN sem supervisão explícita não acessa grupos na área do professor", async () => {
    storeAuthenticatedUser("admin");
    const { fetchMock } = createFetchMock({ accessGroups: [] });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/professor", <ProfessorPage />);

    expect(await screen.findByText("Supervisão pedagógica não configurada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar supervisão" })).toHaveAttribute(
      "href",
      "/admin/professores",
    );
    expect(screen.queryByRole("heading", { level: 2, name: "Emmanuel" })).not.toBeInTheDocument();
  });

  it("ADMIN com BookAccess explícito acessa supervisão sem impersonar professor", async () => {
    storeAuthenticatedUser("admin");
    const { fetchMock } = createFetchMock({
      accessGroups: [obrasAccess],
      studiesData: [baseStudiesData[0], obrasStudy],
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/professor?grupo=emmanuel", <ProfessorPage />);

    const groupSelect = (await screen.findByLabelText("Grupo ou livro", {
      selector: "#teacher-group-select",
    })) as HTMLSelectElement;

    await waitFor(() => {
      expect(groupSelect.value).toBe("obras-postumas");
    });
    expect(screen.getByText("Admin supervisor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Grupo Obras Póstumas" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Emmanuel" })).not.toBeInTheDocument();
  });

  it("Aluno ignora query não autorizada e envia assistente com grupo/livro canônico", async () => {
    storeAuthenticatedUser("student");
    const { fetchMock, calls } = createFetchMock({ accessGroups: [emmanuelAccess] });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/aluno?grupo=a-caminho-da-luz", <AlunoPage />);

    const groupSelect = (await screen.findByLabelText("Livro ou grupo")) as HTMLSelectElement;
    await waitFor(() => {
      expect(groupSelect.value).toBe("emmanuel");
    });
    expect([...groupSelect.options].map((option) => option.value)).toEqual(["emmanuel"]);
    expect(screen.queryByRole("heading", { level: 2, name: "A Caminho da Luz" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sua duvida"), {
      target: { value: "O que Capela ensina?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(calls.agentBodies).toHaveLength(1);
    });
    expect(calls.agentBodies[0]).toMatchObject({
      groupId: "emmanuel",
      bookTitle: "Emmanuel",
    });
  });

  it("Aluno seleciona terceiro grupo autorizado, usa sugestões genéricas e envia Agent canônico", async () => {
    storeAuthenticatedUser("student");
    const { fetchMock, calls } = createFetchMock({
      accessGroups: [obrasAccess],
      studiesData: [obrasStudy],
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/aluno?grupo=obras-postumas", <AlunoPage />);

    const groupSelect = (await screen.findByLabelText("Livro ou grupo")) as HTMLSelectElement;
    await waitFor(() => {
      expect(groupSelect.value).toBe("obras-postumas");
    });
    expect(screen.getByRole("heading", { level: 2, name: "Grupo Obras Póstumas" })).toBeInTheDocument();
    expect(document.getElementById("grupo-obras-postumas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qual é o tema principal deste estudo?" })).toBeInTheDocument();
    expect(calls.knowledgeUrls).toEqual([]);

    fireEvent.change(screen.getByLabelText("Sua duvida"), {
      target: { value: "Como estudar Obras Póstumas com serenidade?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(calls.agentBodies).toHaveLength(1);
    });
    expect(calls.agentBodies[0]).toMatchObject({
      groupId: "obras-postumas",
      bookTitle: "Obras Póstumas",
    });
    expect(JSON.stringify(calls.agentBodies[0])).not.toContain("emmanuel");
    expect(JSON.stringify(calls.agentBodies[0])).not.toContain("a-caminho-da-luz");
  });

  it("Aluno não transforma Agent BOOK_ACCESS_FORBIDDEN em fallback e refaz BookAccess uma vez", async () => {
    storeAuthenticatedUser("student");
    const { fetchMock, calls } = createFetchMock({
      accessGroups: [emmanuelAccess],
      agentError: {
        code: "BOOK_ACCESS_FORBIDDEN",
        message: "Grupo indisponível.",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/aluno", <AlunoPage />);

    await screen.findByLabelText("Sua duvida");
    fireEvent.change(screen.getByLabelText("Sua duvida"), {
      target: { value: "Como estudar melhor?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("O grupo solicitado não está disponível para este perfil.")).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.bookAccess).toBe(2);
    });
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
    expect(screen.queryByText(/Esta é uma resposta demonstrativa/i)).not.toBeInTheDocument();
  });

  it("Aluno com BookAccess zero grupos chega a estado terminal seguro", async () => {
    storeAuthenticatedUser("student");
    const { fetchMock } = createFetchMock({ accessGroups: [] });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/aluno", <AlunoPage />);

    expect(await screen.findByText("Sem grupos vinculados")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sua duvida")).not.toBeInTheDocument();
  });
});
