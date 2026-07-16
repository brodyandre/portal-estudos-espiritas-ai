import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceRequestError } from "../services/api";
import {
  createAdminKnowledgeBook,
  createAdminKnowledgeDocument,
  getAdminKnowledgeDocument,
  listAdminKnowledgeBooks,
  listAdminKnowledgeDocuments,
  transitionAdminKnowledgeDocument,
  updateAdminKnowledgeBook,
  updateAdminKnowledgeDocument,
} from "../services/adminKnowledgeService";
import type { AdminKnowledgeBook, AdminKnowledgeDocument } from "../types/adminKnowledge";
import { AdminKnowledgePage } from "../pages/AdminKnowledgePage";

vi.mock("../services/adminKnowledgeService", () => ({
  createAdminKnowledgeBook: vi.fn(),
  createAdminKnowledgeDocument: vi.fn(),
  getAdminKnowledgeBook: vi.fn(),
  getAdminKnowledgeDocument: vi.fn(),
  listAdminKnowledgeBooks: vi.fn(),
  listAdminKnowledgeDocuments: vi.fn(),
  transitionAdminKnowledgeDocument: vi.fn(),
  updateAdminKnowledgeBook: vi.fn(),
  updateAdminKnowledgeDocument: vi.fn(),
}));

const listBooksMock = vi.mocked(listAdminKnowledgeBooks);
const listDocumentsMock = vi.mocked(listAdminKnowledgeDocuments);
const createBookMock = vi.mocked(createAdminKnowledgeBook);
const createDocumentMock = vi.mocked(createAdminKnowledgeDocument);
const getDocumentMock = vi.mocked(getAdminKnowledgeDocument);
const updateBookMock = vi.mocked(updateAdminKnowledgeBook);
const updateDocumentMock = vi.mocked(updateAdminKnowledgeDocument);
const transitionDocumentMock = vi.mocked(transitionAdminKnowledgeDocument);

const book: AdminKnowledgeBook = {
  id: "book-1",
  slug: "emmanuel",
  title: "Emmanuel",
  description: "Livro base",
  status: "active",
  sortOrder: 1,
  version: 1,
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

const document: AdminKnowledgeDocument = {
  id: "doc-1",
  bookId: "book-1",
  book: { id: "book-1", slug: "emmanuel", title: "Emmanuel", status: "active" },
  catalogKey: "emmanuel-visao",
  filePath: "data/knowledge/emmanuel/visao.md",
  title: "Visão geral",
  description: "Descrição",
  summary: "Resumo",
  type: "tema",
  tags: ["emmanuel"],
  sensitiveTopics: [],
  teacherReviewRecommended: false,
  editorialStatus: "reviewed",
  editorialNotes: "",
  sortOrder: 1,
  reviewedAt: "2026-07-16T10:00:00.000Z",
  reviewedBy: { id: "admin-1", name: "Admin" },
  approvedAt: null,
  approvedBy: null,
  version: 2,
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

const meta = { page: 1, pageSize: 10, total: 1, totalPages: 1 };

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
};

const renderPage = (initialEntry = "/admin/conteudos") =>
  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[initialEntry]}
    >
      <AdminKnowledgePage />
      <LocationProbe />
    </MemoryRouter>,
  );

describe("AdminKnowledgePage", () => {
  beforeEach(() => {
    listBooksMock.mockResolvedValue({ items: [book], meta });
    listDocumentsMock.mockResolvedValue({ items: [document], meta });
    getDocumentMock.mockResolvedValue({ ...document, fileExists: true });
    updateBookMock.mockResolvedValue({ ...book, title: "Livro atualizado", version: 2 });
    updateDocumentMock.mockResolvedValue({ ...document, title: "Visão geral atualizada" });
    transitionDocumentMock.mockResolvedValue({ ...document, editorialStatus: "approved", version: 3 });
    createBookMock.mockResolvedValue({ ...book, id: "book-2", title: "Novo livro" });
    createDocumentMock.mockResolvedValue({ ...document, id: "doc-2", title: "Novo documento" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renderiza livros e documentos reais sem fallback mock", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Gestão de conteúdos" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Emmanuel" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));

    expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByText("data/knowledge/emmanuel/visao.md")).toBeInTheDocument();
  });

  it("serializa filtros na URL e recarrega documentos", async () => {
    renderPage("/admin/conteudos?tab=documents");
    await screen.findByRole("heading", { name: "Visão geral" });

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "reviewed" } });

    await waitFor(() => {
      expect(listDocumentsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ editorialStatus: "reviewed", page: 1 }),
      );
    });
  });

  it("relaciona tabs e painéis por ids acessíveis e reflete a aba na URL", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Emmanuel" });

    const booksTab = screen.getByRole("tab", { name: "Livros" });
    const documentsTab = screen.getByRole("tab", { name: "Documentos" });
    let panel = screen.getByRole("tabpanel");

    expect(booksTab).toHaveAttribute("id", "admin-knowledge-tab-books");
    expect(booksTab).toHaveAttribute("aria-controls", "admin-knowledge-panel-books");
    expect(booksTab).toHaveAttribute("aria-selected", "true");
    expect(booksTab).toHaveAttribute("tabindex", "0");
    expect(documentsTab).toHaveAttribute("id", "admin-knowledge-tab-documents");
    expect(documentsTab).toHaveAttribute("aria-controls", "admin-knowledge-panel-documents");
    expect(documentsTab).toHaveAttribute("aria-selected", "false");
    expect(documentsTab).toHaveAttribute("tabindex", "-1");
    expect(panel).toHaveAttribute("id", "admin-knowledge-panel-books");
    expect(panel).toHaveAttribute("aria-labelledby", "admin-knowledge-tab-books");

    fireEvent.click(documentsTab);

    panel = await screen.findByRole("tabpanel");
    expect(documentsTab).toHaveAttribute("aria-selected", "true");
    expect(documentsTab).toHaveAttribute("tabindex", "0");
    expect(booksTab).toHaveAttribute("aria-selected", "false");
    expect(booksTab).toHaveAttribute("tabindex", "-1");
    expect(panel).toHaveAttribute("id", "admin-knowledge-panel-documents");
    expect(panel).toHaveAttribute("aria-labelledby", "admin-knowledge-tab-documents");
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/conteudos?tab=documents");
  });

  it("reexecuta somente a listagem de livros em erro sem perder filtros", async () => {
    let resolveRetry!: (value: { items: AdminKnowledgeBook[]; meta: typeof meta }) => void;
    listBooksMock
      .mockRejectedValueOnce(new ServiceRequestError({ kind: "network", message: "offline" }))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
      );

    renderPage("/admin/conteudos?booksSearch=emi&booksPage=2");

    expect(await screen.findByText("Catálogo editorial indisponível. Verifique a preparação local do banco e da API.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum item foi encontrado no catálogo editorial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(screen.getByText("Carregando catálogo editorial")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(listDocumentsMock).toHaveBeenCalledTimes(1);
    expect(listBooksMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: "emi", page: 2 }));

    resolveRetry({ items: [book], meta });

    expect(await screen.findByRole("heading", { name: "Emmanuel" })).toBeInTheDocument();
    expect(screen.queryByText("Catálogo editorial indisponível. Verifique a preparação local do banco e da API.")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/conteudos?booksSearch=emi&booksPage=2");
  });

  it("reexecuta somente a listagem de documentos em erro preservando filtro e página", async () => {
    listDocumentsMock
      .mockRejectedValueOnce(new ServiceRequestError({ kind: "network", message: "offline" }))
      .mockResolvedValueOnce({ items: [document], meta });

    renderPage("/admin/conteudos?tab=documents&editorialStatus=reviewed&documentsPage=2");

    expect(await screen.findByText("Catálogo editorial indisponível. Verifique a preparação local do banco e da API.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(listDocumentsMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
    expect(listBooksMock).toHaveBeenCalledTimes(1);
    expect(listDocumentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ editorialStatus: "reviewed", page: 2 }));
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/conteudos?tab=documents&editorialStatus=reviewed&documentsPage=2");
  });

  it("diferencia catálogo vazio de falha de API", async () => {
    listBooksMock.mockResolvedValueOnce({ items: [], meta: { ...meta, total: 0, totalPages: 0 } });
    listDocumentsMock.mockRejectedValue(new ServiceRequestError({ kind: "network", message: "offline" }));

    renderPage();

    expect(await screen.findByText("Nenhum item foi encontrado no catálogo editorial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));
    expect(
      await screen.findByText("Catálogo editorial indisponível. Verifique a preparação local do banco e da API."),
    ).toBeInTheDocument();
  });

  it("mostra mensagem de autorização negada na página", async () => {
    listBooksMock.mockRejectedValueOnce(new ServiceRequestError({ kind: "api", code: "FORBIDDEN", message: "forbidden" }));

    renderPage();

    expect(await screen.findByText("Seu perfil não tem permissão para administrar o catálogo editorial.")).toBeInTheDocument();
  });

  it("cria livro, preserva formulário em erro e recarrega listagens após sucesso", async () => {
    createBookMock
      .mockRejectedValueOnce(new ServiceRequestError({ kind: "api", code: "ADMIN_KNOWLEDGE_RATE_LIMITED", message: "rate" }))
      .mockResolvedValueOnce({ ...book, id: "book-2", slug: "novo", title: "Novo livro", version: 1 });

    renderPage();
    await screen.findByRole("heading", { name: "Emmanuel" });
    fireEvent.click(screen.getByRole("button", { name: "Novo livro" }));

    const dialog = await screen.findByRole("dialog", { name: "Novo livro" });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: " Novo " } });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Novo livro" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Descrição do livro" } });
    fireEvent.change(screen.getByLabelText("Ordem"), { target: { value: "7" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await within(dialog).findByText("Muitas alterações foram solicitadas. Aguarde antes de tentar novamente.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Novo livro")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(createBookMock).toHaveBeenLastCalledWith({
        slug: "novo",
        title: "Novo livro",
        description: "Descrição do livro",
        status: "active",
        sortOrder: 7,
      });
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Novo livro" })).not.toBeInTheDocument());
    expect(listBooksMock).toHaveBeenCalledTimes(2);
    expect(listDocumentsMock).toHaveBeenCalledTimes(2);
  });

  it("cadastra documento por caminho relativo e preserva formulário em arquivo ausente", async () => {
    createDocumentMock
      .mockRejectedValueOnce(new ServiceRequestError({ kind: "api", code: "KNOWLEDGE_FILE_NOT_FOUND", message: "missing" }))
      .mockResolvedValueOnce({ ...document, id: "doc-2", title: "Novo documento", version: 1 });

    renderPage("/admin/conteudos?tab=documents");
    await screen.findByRole("heading", { name: "Visão geral" });
    fireEvent.click(screen.getByRole("button", { name: "Novo documento" }));

    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Livro" }), { target: { value: "book-1" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Caminho relativo/ }), { target: { value: "data/knowledge/emmanuel/novo.md" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Chave de catálogo" }), { target: { value: "emmanuel-novo" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Título editorial" }), { target: { value: "Novo documento" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Tipo" }), { target: { value: "readme" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Tags/ }), { target: { value: "emmanuel, estudo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await within(dialog).findByText("Arquivo Markdown não encontrado em data/knowledge.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("data/knowledge/emmanuel/novo.md")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(createDocumentMock).toHaveBeenLastCalledWith({
        bookId: "book-1",
        filePath: "data/knowledge/emmanuel/novo.md",
        catalogKey: "emmanuel-novo",
        title: "Novo documento",
        description: "",
        summary: "",
        type: "readme",
        tags: ["emmanuel", "estudo"],
        sensitiveTopics: [],
        teacherReviewRecommended: false,
        editorialNotes: "",
        sortOrder: 0,
      });
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Novo documento" })).not.toBeInTheDocument());
  });

  it("exibe arquivo ausente no detalhe sem preview nem caminho absoluto", async () => {
    getDocumentMock.mockResolvedValueOnce({ ...document, fileExists: false });
    renderPage("/admin/conteudos?tab=documents");
    await screen.findByRole("heading", { name: "Visão geral" });

    fireEvent.click(screen.getByRole("button", { name: "Detalhar e editar" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar documento" });
    expect(within(dialog).getByText("O arquivo relativo registrado não foi encontrado em data/knowledge.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("data/knowledge/emmanuel/visao.md")).toBeInTheDocument();
    expect(screen.queryByText(/\/home\/|C:\\\\/)).not.toBeInTheDocument();
    expect(screen.queryByText(/preview|pré-visual/i)).not.toBeInTheDocument();
  });

  it("pagina documentos preservando filtros e volta para página 1 ao alterar busca", async () => {
    listDocumentsMock.mockResolvedValue({ items: [document], meta: { ...meta, page: 1, total: 20, totalPages: 2 } });
    renderPage("/admin/conteudos?tab=documents&editorialStatus=reviewed");
    await screen.findByRole("heading", { name: "Visão geral" });

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() => {
      expect(listDocumentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ editorialStatus: "reviewed", page: 2 }));
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/conteudos?tab=documents&editorialStatus=reviewed&documentsPage=2");

    fireEvent.change(screen.getByLabelText("Buscar documentos"), { target: { value: "visão" } });

    await waitFor(() => {
      expect(listDocumentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ editorialStatus: "reviewed", search: "visão", page: 1 }));
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/admin/conteudos?tab=documents&editorialStatus=reviewed&documentsPage=1&documentsSearch=vis%C3%A3o");
  });

  it("abre modal de documento, preserva foco e envia version no PATCH", async () => {
    renderPage("/admin/conteudos?tab=documents");
    await screen.findByRole("heading", { name: "Visão geral" });
    const trigger = screen.getByRole("button", { name: "Detalhar e editar" });

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Editar documento" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Título editorial")).toHaveFocus();

    fireEvent.change(screen.getByLabelText("Título editorial"), { target: { value: "Visão atualizada" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(updateDocumentMock).toHaveBeenCalledWith(
        "doc-1",
        expect.objectContaining({ title: "Visão atualizada", version: 2 }),
      );
    });
  });

  it("mostra conflito e permite recarregar sem descartar o rascunho automaticamente", async () => {
    updateDocumentMock.mockRejectedValueOnce(
      new ServiceRequestError({ kind: "api", code: "KNOWLEDGE_CONFLICT", message: "Conflito" }),
    );
    renderPage("/admin/conteudos?tab=documents");
    await screen.findByRole("heading", { name: "Visão geral" });

    fireEvent.click(screen.getByRole("button", { name: "Detalhar e editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar documento" });
    fireEvent.change(screen.getByLabelText("Título editorial"), { target: { value: "Rascunho local" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await within(dialog).findByRole("heading", { name: "Conflito de versão" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar registro" }));

    await waitFor(() => expect(getDocumentMock).toHaveBeenCalledWith("doc-1"));
    expect(screen.getByDisplayValue("Rascunho local")).toBeInTheDocument();
  });

  it("confirma aprovação antes da transição editorial", async () => {
    renderPage("/admin/conteudos?tab=documents");
    await screen.findByRole("heading", { name: "Visão geral" });

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    const dialog = await screen.findByRole("dialog", { name: "Aprovar" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(transitionDocumentMock).toHaveBeenCalledWith("doc-1", {
        editorialStatus: "approved",
        version: 2,
      });
    });
  });
});
