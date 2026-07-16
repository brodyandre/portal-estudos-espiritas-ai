import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { ProfileHeader } from "../components/display/ProfileHeader";
import { AlertBox } from "../components/ui/AlertBox";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { Select } from "../components/ui/Select";
import { StatusTag } from "../components/ui/StatusTag";
import { TextArea } from "../components/ui/TextArea";
import { TextInput } from "../components/ui/TextInput";
import { ServiceRequestError, formatRetryAfterLabel } from "../services/api";
import {
  createAdminKnowledgeBook,
  createAdminKnowledgeDocument,
  getAdminKnowledgeBook,
  getAdminKnowledgeDocument,
  listAdminKnowledgeBooks,
  listAdminKnowledgeDocuments,
  transitionAdminKnowledgeDocument,
  updateAdminKnowledgeBook,
  updateAdminKnowledgeDocument,
} from "../services/adminKnowledgeService";
import type {
  AdminKnowledgeBook,
  AdminKnowledgeBookFormState,
  AdminKnowledgeBookSortBy,
  AdminKnowledgeBookStatus,
  AdminKnowledgeBooksFilters,
  AdminKnowledgeDocument,
  AdminKnowledgeDocumentFormState,
  AdminKnowledgeDocumentSortBy,
  AdminKnowledgeDocumentType,
  AdminKnowledgeDocumentsFilters,
  AdminKnowledgeEditorialStatus,
  AdminKnowledgePaginationMeta,
  AdminKnowledgeSortOrder,
  CreateAdminKnowledgeBookInput,
  CreateAdminKnowledgeDocumentInput,
  UpdateAdminKnowledgeBookInput,
  UpdateAdminKnowledgeDocumentInput,
} from "../types/adminKnowledge";
import {
  ADMIN_KNOWLEDGE_BOOK_STATUSES,
  ADMIN_KNOWLEDGE_DOCUMENT_TYPES,
  ADMIN_KNOWLEDGE_EDITORIAL_STATUSES,
} from "../types/adminKnowledge";

type TabKey = "books" | "documents";
type LoadState<TItem> =
  | { status: "loading" }
  | { status: "success"; items: TItem[]; meta: AdminKnowledgePaginationMeta }
  | { status: "empty"; items: TItem[]; meta: AdminKnowledgePaginationMeta }
  | { status: "error"; message: string };

type BookDialogState =
  | { mode: "create"; book: null; trigger: HTMLElement | null }
  | { mode: "edit"; book: AdminKnowledgeBook; trigger: HTMLElement | null }
  | null;

type DocumentDialogState =
  | { mode: "create"; document: null; trigger: HTMLElement | null }
  | { mode: "edit"; document: AdminKnowledgeDocument; trigger: HTMLElement | null }
  | null;

type ConfirmState =
  | {
      title: string;
      description: string;
      confirmLabel: string;
      onConfirm: () => void;
      trigger: HTMLElement | null;
    }
  | null;

type ConflictState =
  | {
      type: "book";
      id: string;
      current: AdminKnowledgeBook | null;
      message: string;
    }
  | {
      type: "document";
      id: string;
      current: AdminKnowledgeDocument | null;
      message: string;
    }
  | null;

const PAGE_SIZE = 10;
const DEFAULT_META: AdminKnowledgePaginationMeta = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 };
const CONFLICT_MESSAGE =
  "Este registro foi alterado por outro processo. Recarregue a versão atual antes de salvar novamente.";
const BOOKS_TAB_ID = "admin-knowledge-tab-books";
const BOOKS_PANEL_ID = "admin-knowledge-panel-books";
const DOCUMENTS_TAB_ID = "admin-knowledge-tab-documents";
const DOCUMENTS_PANEL_ID = "admin-knowledge-panel-documents";

const bookStatusLabel: Record<AdminKnowledgeBookStatus, string> = {
  active: "Ativo",
  archived: "Arquivado",
};

const documentTypeLabel: Record<AdminKnowledgeDocumentType, string> = {
  readme: "README",
  orientacoes: "Orientações",
  demo: "Demo",
  visao_geral: "Visão geral",
  tema: "Tema",
  capitulo: "Capítulo",
  faq: "FAQ",
  palavras_chave: "Palavras-chave",
  other: "Outro",
};

const editorialLabel: Record<AdminKnowledgeEditorialStatus, string> = {
  draft: "Rascunho",
  needs_review: "Precisa de revisão",
  reviewed: "Revisado",
  approved: "Aprovado",
  archived: "Arquivado",
};

const editorialDescription: Record<AdminKnowledgeEditorialStatus, string> = {
  draft: "Metadados ainda em preparação.",
  needs_review: "Aguardando revisão humana.",
  reviewed: "Revisão registrada, pronto para decisão editorial.",
  approved: "Aprovado para uso administrativo.",
  archived: "Retirado do fluxo editorial ativo.",
};

const editorialTone: Record<AdminKnowledgeEditorialStatus, "draft" | "published" | "attention"> = {
  draft: "draft",
  needs_review: "attention",
  reviewed: "published",
  approved: "published",
  archived: "attention",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDate = (value: string | null) => {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : dateFormatter.format(date);
};

const parseIntegerParam = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getTabFromParams = (params: URLSearchParams): TabKey =>
  params.get("tab") === "documents" ? "documents" : "books";

const setParam = (params: URLSearchParams, key: string, value: string | number | null | undefined) => {
  const serialized = value === undefined || value === null ? "" : String(value).trim();
  if (serialized && serialized !== "all") params.set(key, serialized);
  else params.delete(key);
};

const splitList = (value: string) =>
  Array.from(new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)));

const joinList = (values: string[]) => values.join(", ");

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ServiceRequestError) {
    if (error.retryAfterSeconds) {
      return `${error.message} Tente novamente em cerca de ${formatRetryAfterLabel(error.retryAfterSeconds)}.`;
    }
    if (error.kind === "network") {
      return "Catálogo editorial indisponível. Verifique a preparação local do banco e da API.";
    }
    switch (error.code) {
      case "AUTH_REQUIRED":
        return "Sua sessão expirou. Faça login novamente para administrar o catálogo.";
      case "FORBIDDEN":
        return "Seu perfil não tem permissão para administrar o catálogo editorial.";
      case "INVALID_ADMIN_KNOWLEDGE_QUERY":
        return "Revise os filtros do catálogo e tente novamente.";
      case "INVALID_ADMIN_KNOWLEDGE_INPUT":
        return "Revise os campos informados e tente novamente.";
      case "KNOWLEDGE_FILE_NOT_FOUND":
        return "Arquivo Markdown não encontrado em data/knowledge.";
      case "KNOWLEDGE_FILE_PATH_INVALID":
        return "Use um caminho relativo válido dentro de data/knowledge.";
      case "KNOWLEDGE_FILE_TYPE_NOT_ALLOWED":
        return "Apenas arquivos Markdown .md podem ser cadastrados.";
      case "KNOWLEDGE_BOOK_SLUG_ALREADY_EXISTS":
        return "Já existe um livro com este slug.";
      case "KNOWLEDGE_DOCUMENT_ALREADY_EXISTS":
        return "Já existe um documento cadastrado para este arquivo.";
      case "KNOWLEDGE_CATALOG_KEY_ALREADY_EXISTS":
        return "Já existe um documento com esta chave de catálogo.";
      case "KNOWLEDGE_BOOK_ARCHIVED":
        return "Livro arquivado não aceita esta alteração.";
      case "KNOWLEDGE_EDITORIAL_TRANSITION_NOT_ALLOWED":
        return "Esta transição editorial não é permitida para o estado atual.";
      case "KNOWLEDGE_CONFLICT":
        return CONFLICT_MESSAGE;
      case "ADMIN_KNOWLEDGE_RATE_LIMITED":
        return "Muitas alterações foram solicitadas. Aguarde antes de tentar novamente.";
      default:
        return error.message || fallback;
    }
  }
  return fallback;
};

const isConflict = (error: unknown) =>
  error instanceof ServiceRequestError && error.code === "KNOWLEDGE_CONFLICT";

const bookToFormState = (book?: AdminKnowledgeBook): AdminKnowledgeBookFormState => ({
  slug: book?.slug ?? "",
  title: book?.title ?? "",
  description: book?.description ?? "",
  status: book?.status ?? "active",
  sortOrder: String(book?.sortOrder ?? 0),
  version: book?.version,
});

const documentToFormState = (document?: AdminKnowledgeDocument): AdminKnowledgeDocumentFormState => ({
  bookId: document?.bookId ?? "",
  filePath: document?.filePath ?? "",
  catalogKey: document?.catalogKey ?? "",
  title: document?.title ?? "",
  description: document?.description ?? "",
  summary: document?.summary ?? "",
  type: document?.type ?? "tema",
  tags: joinList(document?.tags ?? []),
  sensitiveTopics: joinList(document?.sensitiveTopics ?? []),
  teacherReviewRecommended: document?.teacherReviewRecommended ?? false,
  editorialNotes: document?.editorialNotes ?? "",
  sortOrder: String(document?.sortOrder ?? 0),
  version: document?.version,
});

const buildBookInput = (values: AdminKnowledgeBookFormState): CreateAdminKnowledgeBookInput | null => {
  const title = values.title.trim();
  const slug = values.slug.trim().toLowerCase();
  const sortOrder = Number(values.sortOrder);
  if (!title || !slug || !Number.isInteger(sortOrder)) return null;
  return {
    slug,
    title,
    description: values.description.trim(),
    status: values.status,
    sortOrder,
  };
};

const buildBookUpdateInput = (values: AdminKnowledgeBookFormState): UpdateAdminKnowledgeBookInput | null => {
  const input = buildBookInput(values);
  if (!input || !values.version) return null;
  return { ...input, version: values.version };
};

const buildDocumentInput = (values: AdminKnowledgeDocumentFormState): CreateAdminKnowledgeDocumentInput | null => {
  const title = values.title.trim();
  const filePath = values.filePath.trim();
  const bookId = values.bookId.trim();
  const sortOrder = Number(values.sortOrder);
  if (!title || !bookId || !filePath || !Number.isInteger(sortOrder)) return null;
  const sensitiveTopics = splitList(values.sensitiveTopics);
  return {
    bookId,
    filePath,
    catalogKey: values.catalogKey.trim() || null,
    title,
    description: values.description.trim(),
    summary: values.summary.trim(),
    type: values.type,
    tags: splitList(values.tags),
    sensitiveTopics,
    teacherReviewRecommended: values.teacherReviewRecommended || sensitiveTopics.length > 0,
    editorialNotes: values.editorialNotes.trim(),
    sortOrder,
  };
};

const buildDocumentUpdateInput = (values: AdminKnowledgeDocumentFormState): UpdateAdminKnowledgeDocumentInput | null => {
  const input = buildDocumentInput(values);
  if (!input || !values.version) return null;
  const { filePath: _filePath, catalogKey: _catalogKey, ...editable } = input;
  return { ...editable, version: values.version };
};

const getDocumentTransitions = (document: AdminKnowledgeDocument) => {
  const transitions: Array<{ status: AdminKnowledgeEditorialStatus; label: string; confirm?: string }> = [];
  if (document.editorialStatus === "draft") {
    transitions.push({ status: "needs_review", label: "Enviar para revisão" });
    transitions.push({ status: "reviewed", label: "Marcar como revisado" });
    transitions.push({ status: "archived", label: "Arquivar", confirm: "Arquivar este documento?" });
  }
  if (document.editorialStatus === "needs_review") {
    transitions.push({ status: "reviewed", label: "Marcar como revisado" });
    transitions.push({ status: "archived", label: "Arquivar", confirm: "Arquivar este documento?" });
  }
  if (document.editorialStatus === "reviewed") {
    transitions.push({ status: "approved", label: "Aprovar", confirm: "Aprovar este documento revisado?" });
    transitions.push({ status: "needs_review", label: "Devolver para revisão" });
    transitions.push({ status: "archived", label: "Arquivar", confirm: "Arquivar este documento?" });
  }
  if (document.editorialStatus === "approved") {
    transitions.push({ status: "needs_review", label: "Devolver para revisão", confirm: "Devolver um documento aprovado para revisão?" });
    transitions.push({ status: "archived", label: "Arquivar", confirm: "Arquivar este documento aprovado?" });
  }
  if (document.editorialStatus === "archived") {
    transitions.push({ status: "draft", label: "Retornar para rascunho", confirm: "Retornar para rascunho limpará dados editoriais incoerentes. Continuar?" });
  }
  return transitions;
};

const PaginationControls = ({
  meta,
  onPageChange,
}: {
  meta: AdminKnowledgePaginationMeta;
  onPageChange: (page: number) => void;
}) => {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="admin-knowledge-pagination" aria-label="Paginação do catálogo">
      <Button disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} variant="secondary">
        Página anterior
      </Button>
      <span>
        Página {meta.page} de {meta.totalPages} · {meta.total} itens
      </span>
      <Button disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} variant="secondary">
        Próxima página
      </Button>
    </div>
  );
};

export const AdminKnowledgePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = getTabFromParams(searchParams);
  const [booksState, setBooksState] = useState<LoadState<AdminKnowledgeBook>>({ status: "loading" });
  const [documentsState, setDocumentsState] = useState<LoadState<AdminKnowledgeDocument>>({ status: "loading" });
  const [bookDialog, setBookDialog] = useState<BookDialogState>(null);
  const [documentDialog, setDocumentDialog] = useState<DocumentDialogState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [conflictState, setConflictState] = useState<ConflictState>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const booksFilters = useMemo<AdminKnowledgeBooksFilters>(
    () => ({
      page: parseIntegerParam(searchParams.get("booksPage"), 1),
      pageSize: PAGE_SIZE,
      search: searchParams.get("booksSearch") ?? undefined,
      status: (searchParams.get("booksStatus") as AdminKnowledgeBookStatus | null) ?? "all",
      sortBy: (searchParams.get("booksSortBy") as AdminKnowledgeBookSortBy | null) ?? "sortOrder",
      sortOrder: (searchParams.get("booksSortOrder") as AdminKnowledgeSortOrder | null) ?? "asc",
    }),
    [searchParams],
  );

  const documentsFilters = useMemo<AdminKnowledgeDocumentsFilters>(
    () => ({
      page: parseIntegerParam(searchParams.get("documentsPage"), 1),
      pageSize: PAGE_SIZE,
      search: searchParams.get("documentsSearch") ?? undefined,
      bookId: searchParams.get("bookId") ?? undefined,
      type: (searchParams.get("type") as AdminKnowledgeDocumentType | null) ?? "all",
      editorialStatus: (searchParams.get("editorialStatus") as AdminKnowledgeEditorialStatus | null) ?? "all",
      teacherReviewRecommended:
        searchParams.get("teacherReviewRecommended") === null
          ? "all"
          : searchParams.get("teacherReviewRecommended") === "true",
      hasSensitiveTopics:
        searchParams.get("hasSensitiveTopics") === null
          ? "all"
          : searchParams.get("hasSensitiveTopics") === "true",
      sortBy: (searchParams.get("documentsSortBy") as AdminKnowledgeDocumentSortBy | null) ?? "sortOrder",
      sortOrder: (searchParams.get("documentsSortOrder") as AdminKnowledgeSortOrder | null) ?? "asc",
    }),
    [searchParams],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) setParam(next, key, value);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const loadBooks = useCallback(async () => {
    setBooksState({ status: "loading" });
    try {
      const result = await listAdminKnowledgeBooks(booksFilters);
      setBooksState({
        status: result.items.length > 0 ? "success" : "empty",
        items: result.items,
        meta: result.meta,
      });
    } catch (error) {
      setBooksState({ status: "error", message: getErrorMessage(error, "Não foi possível carregar os livros.") });
    }
  }, [booksFilters]);

  const loadDocuments = useCallback(async () => {
    setDocumentsState({ status: "loading" });
    try {
      const result = await listAdminKnowledgeDocuments(documentsFilters);
      setDocumentsState({
        status: result.items.length > 0 ? "success" : "empty",
        items: result.items,
        meta: result.meta,
      });
    } catch (error) {
      setDocumentsState({ status: "error", message: getErrorMessage(error, "Não foi possível carregar os documentos.") });
    }
  }, [documentsFilters]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const books = booksState.status === "success" || booksState.status === "empty" ? booksState.items : [];
  const documents = documentsState.status === "success" || documentsState.status === "empty" ? documentsState.items : [];
  const booksMeta = booksState.status === "success" || booksState.status === "empty" ? booksState.meta : DEFAULT_META;
  const documentsMeta = documentsState.status === "success" || documentsState.status === "empty" ? documentsState.meta : DEFAULT_META;

  const handleOpenBookDialog = async (
    mode: "create" | "edit",
    book: AdminKnowledgeBook | null,
    trigger: HTMLElement | null,
  ) => {
    setActionError(null);
    setConflictState(null);
    if (mode === "edit" && book) {
      try {
        const detail = await getAdminKnowledgeBook(book.id);
        setBookDialog({ mode: "edit", book: detail, trigger });
      } catch (error) {
        setActionError(getErrorMessage(error, "Não foi possível carregar o detalhe do livro."));
      }
      return;
    }
    setBookDialog({ mode: "create", book: null, trigger });
  };

  const handleOpenDocumentDialog = async (
    mode: "create" | "edit",
    document: AdminKnowledgeDocument | null,
    trigger: HTMLElement | null,
  ) => {
    setActionError(null);
    setConflictState(null);
    if (mode === "edit" && document) {
      try {
        const detail = await getAdminKnowledgeDocument(document.id);
        setDocumentDialog({ mode: "edit", document: detail, trigger });
      } catch (error) {
        setActionError(getErrorMessage(error, "Não foi possível carregar o detalhe do documento."));
      }
      return;
    }
    setDocumentDialog({ mode: "create", document: null, trigger });
  };

  const refreshAfterMutation = async () => {
    await Promise.all([loadBooks(), loadDocuments()]);
  };

  const handleSaveBook = async (values: AdminKnowledgeBookFormState) => {
    setIsSaving(true);
    setActionError(null);
    try {
      if (bookDialog?.mode === "create") {
        const input = buildBookInput(values);
        if (!input) throw new Error("invalid");
        await createAdminKnowledgeBook(input);
        setSuccessMessage("Livro criado com sucesso.");
      } else if (bookDialog?.mode === "edit") {
        const input = buildBookUpdateInput(values);
        if (!input) throw new Error("invalid");
        await updateAdminKnowledgeBook(bookDialog.book.id, input);
        setSuccessMessage("Livro atualizado com sucesso.");
      }
      const trigger = bookDialog?.trigger ?? null;
      setBookDialog(null);
      await refreshAfterMutation();
      window.setTimeout(() => trigger?.focus(), 0);
    } catch (error) {
      if (isConflict(error) && bookDialog?.mode === "edit") {
        setConflictState({ type: "book", id: bookDialog.book.id, current: null, message: CONFLICT_MESSAGE });
      }
      setActionError(getErrorMessage(error, "Não foi possível salvar o livro."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDocument = async (values: AdminKnowledgeDocumentFormState) => {
    setIsSaving(true);
    setActionError(null);
    try {
      if (documentDialog?.mode === "create") {
        const input = buildDocumentInput(values);
        if (!input) throw new Error("invalid");
        await createAdminKnowledgeDocument(input);
        setSuccessMessage("Documento cadastrado com sucesso.");
      } else if (documentDialog?.mode === "edit") {
        const input = buildDocumentUpdateInput(values);
        if (!input) throw new Error("invalid");
        await updateAdminKnowledgeDocument(documentDialog.document.id, input);
        setSuccessMessage("Documento atualizado com sucesso.");
      }
      const trigger = documentDialog?.trigger ?? null;
      setDocumentDialog(null);
      await refreshAfterMutation();
      window.setTimeout(() => trigger?.focus(), 0);
    } catch (error) {
      if (isConflict(error) && documentDialog?.mode === "edit") {
        setConflictState({ type: "document", id: documentDialog.document.id, current: null, message: CONFLICT_MESSAGE });
      }
      setActionError(getErrorMessage(error, "Não foi possível salvar o documento."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBookStatus = (book: AdminKnowledgeBook, status: AdminKnowledgeBookStatus, trigger: HTMLElement | null) => {
    const run = async () => {
      setIsSaving(true);
      try {
        await updateAdminKnowledgeBook(book.id, { status, version: book.version });
        setSuccessMessage(status === "archived" ? "Livro arquivado com sucesso." : "Livro ativado com sucesso.");
        await refreshAfterMutation();
      } catch (error) {
        setActionError(getErrorMessage(error, "Não foi possível alterar o estado do livro."));
      } finally {
        setConfirmState(null);
        setIsSaving(false);
        window.setTimeout(() => trigger?.focus(), 0);
      }
    };
    if (status === "archived") {
      setConfirmState({
        title: "Arquivar livro",
        description: `Arquivar ${book.title}? Documentos desse livro não poderão ser aprovados enquanto ele estiver arquivado.`,
        confirmLabel: "Arquivar livro",
        onConfirm: () => void run(),
        trigger,
      });
    } else {
      void run();
    }
  };

  const handleTransition = (
    document: AdminKnowledgeDocument,
    status: AdminKnowledgeEditorialStatus,
    trigger: HTMLElement | null,
  ) => {
    const run = async () => {
      setTransitioningId(document.id);
      setActionError(null);
      try {
        await transitionAdminKnowledgeDocument(document.id, { editorialStatus: status, version: document.version });
        setSuccessMessage(`Estado editorial alterado para ${editorialLabel[status]}.`);
        await refreshAfterMutation();
      } catch (error) {
        if (isConflict(error)) setConflictState({ type: "document", id: document.id, current: null, message: CONFLICT_MESSAGE });
        setActionError(getErrorMessage(error, "Não foi possível alterar o estado editorial."));
        if (error instanceof ServiceRequestError && error.code === "KNOWLEDGE_EDITORIAL_TRANSITION_NOT_ALLOWED") {
          await loadDocuments();
        }
      } finally {
        setConfirmState(null);
        setTransitioningId(null);
        window.setTimeout(() => trigger?.focus(), 0);
      }
    };
    const transition = getDocumentTransitions(document).find((item) => item.status === status);
    if (transition?.confirm) {
      setConfirmState({
        title: transition.label,
        description: transition.confirm,
        confirmLabel: transition.label,
        onConfirm: () => void run(),
        trigger,
      });
    } else {
      void run();
    }
  };

  const reloadConflictRecord = async () => {
    if (!conflictState) return;
    try {
      if (conflictState.type === "book") {
        const current = await getAdminKnowledgeBook(conflictState.id);
        setConflictState({ ...conflictState, current });
      } else {
        const current = await getAdminKnowledgeDocument(conflictState.id);
        setConflictState({ ...conflictState, current });
      }
    } catch (error) {
      setActionError(getErrorMessage(error, "Não foi possível recarregar o registro."));
    }
  };

  const discardDraftForCurrent = () => {
    if (!conflictState?.current) return;
    if (conflictState.type === "book" && bookDialog?.mode === "edit") {
      setBookDialog({ ...bookDialog, book: conflictState.current });
    }
    if (conflictState.type === "document" && documentDialog?.mode === "edit") {
      setDocumentDialog({ ...documentDialog, document: conflictState.current });
    }
    setConflictState(null);
  };

  return (
    <div className="page-stack">
      <ProfileHeader
        badge="Catálogo editorial"
        description="Administre livros e metadados de documentos Markdown persistidos pela API local, mantendo o conteúdo autoral imutável no filesystem."
        eyebrow="Administração"
        meta={[
          { label: "Livros", value: String(booksMeta.total) },
          { label: "Documentos", value: String(documentsMeta.total) },
          { label: "Fonte", value: "API 6A" },
        ]}
        title="Gestão de conteúdos"
      />

      <AlertBox title="Operação local" tone="info">
        Nenhum item é catalogado por esta interface. Migration, seed e catalogação continuam sendo operações locais separadas.
      </AlertBox>

      {successMessage ? (
        <AlertBox title="Ação concluída" tone="success">
          {successMessage}
        </AlertBox>
      ) : null}
      {actionError ? (
        <AlertBox title="Atenção" tone="warning">
          {actionError}
        </AlertBox>
      ) : null}

      <div className="admin-knowledge-tabs" role="tablist" aria-label="Catálogo editorial">
        <Button
          aria-controls={BOOKS_PANEL_ID}
          aria-selected={activeTab === "books"}
          id={BOOKS_TAB_ID}
          onClick={() => updateParams({ tab: "books" })}
          role="tab"
          tabIndex={activeTab === "books" ? 0 : -1}
          variant={activeTab === "books" ? "primary" : "secondary"}
        >
          Livros
        </Button>
        <Button
          aria-controls={DOCUMENTS_PANEL_ID}
          aria-selected={activeTab === "documents"}
          id={DOCUMENTS_TAB_ID}
          onClick={() => updateParams({ tab: "documents" })}
          role="tab"
          tabIndex={activeTab === "documents" ? 0 : -1}
          variant={activeTab === "documents" ? "primary" : "secondary"}
        >
          Documentos
        </Button>
      </div>

      {activeTab === "books" ? (
        <section
          aria-labelledby={BOOKS_TAB_ID}
          className="page-section admin-knowledge-panel"
          id={BOOKS_PANEL_ID}
          role="tabpanel"
        >
          <div className="admin-knowledge-toolbar">
            <TextInput
              id="admin-knowledge-books-search"
              label="Buscar livros"
              onChange={(event) => updateParams({ booksSearch: event.target.value, booksPage: 1 })}
              placeholder="Título, slug ou descrição"
              value={booksFilters.search ?? ""}
            />
            <Select
              id="admin-knowledge-books-status"
              label="Status"
              onChange={(event) => updateParams({ booksStatus: event.target.value, booksPage: 1 })}
              options={[
                { label: "Todos", value: "all" },
                ...ADMIN_KNOWLEDGE_BOOK_STATUSES.map((status) => ({ label: bookStatusLabel[status], value: status })),
              ]}
              value={booksFilters.status ?? "all"}
            />
            <Select
              id="admin-knowledge-books-sort"
              label="Ordenar por"
              onChange={(event) => updateParams({ booksSortBy: event.target.value, booksPage: 1 })}
              options={[
                { label: "Ordem", value: "sortOrder" },
                { label: "Título", value: "title" },
                { label: "Status", value: "status" },
                { label: "Criado em", value: "createdAt" },
                { label: "Atualizado em", value: "updatedAt" },
              ]}
              value={booksFilters.sortBy}
            />
            <Select
              id="admin-knowledge-books-order"
              label="Direção"
              onChange={(event) => updateParams({ booksSortOrder: event.target.value, booksPage: 1 })}
              options={[
                { label: "Ascendente", value: "asc" },
                { label: "Descendente", value: "desc" },
              ]}
              value={booksFilters.sortOrder}
            />
            <Button onClick={(event) => void handleOpenBookDialog("create", null, event.currentTarget)}>
              Novo livro
            </Button>
          </div>
          <KnowledgeListState
            emptyFiltered={Boolean(booksFilters.search || booksFilters.status !== "all")}
            onRetry={() => void loadBooks()}
            state={booksState}
          />
          {books.length > 0 ? (
            <div className="admin-knowledge-grid">
              {books.map((book) => (
                <Card className="admin-knowledge-card" key={book.id} tone={book.status === "archived" ? "soft" : "default"}>
                  <div className="admin-knowledge-card__header">
                    <div>
                      <h2>{book.title}</h2>
                      <p>{book.slug}</p>
                    </div>
                    <StatusTag label={bookStatusLabel[book.status]} tone={book.status === "active" ? "published" : "attention"} />
                  </div>
                  <p>{book.description || "Sem descrição editorial."}</p>
                  <dl className="admin-user-card__meta">
                    <div><dt>Ordem</dt><dd>{book.sortOrder}</dd></div>
                    <div><dt>Versão</dt><dd>{book.version}</dd></div>
                    <div><dt>Atualizado</dt><dd>{formatDate(book.updatedAt)}</dd></div>
                  </dl>
                  <div className="button-row admin-knowledge-card__actions">
                    <Button onClick={(event) => void handleOpenBookDialog("edit", book, event.currentTarget)} variant="secondary">
                      Editar
                    </Button>
                    <Button
                      onClick={(event) => handleBookStatus(book, book.status === "active" ? "archived" : "active", event.currentTarget)}
                      variant="ghost"
                    >
                      {book.status === "active" ? "Arquivar" : "Ativar"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
          <PaginationControls meta={booksMeta} onPageChange={(page) => updateParams({ booksPage: page })} />
        </section>
      ) : (
        <section
          aria-labelledby={DOCUMENTS_TAB_ID}
          className="page-section admin-knowledge-panel"
          id={DOCUMENTS_PANEL_ID}
          role="tabpanel"
        >
          <div className="admin-knowledge-toolbar admin-knowledge-toolbar--documents">
            <TextInput
              id="admin-knowledge-documents-search"
              label="Buscar documentos"
              onChange={(event) => updateParams({ documentsSearch: event.target.value, documentsPage: 1 })}
              placeholder="Título, resumo ou caminho"
              value={documentsFilters.search ?? ""}
            />
            <Select
              id="admin-knowledge-document-book"
              label="Livro"
              onChange={(event) => updateParams({ bookId: event.target.value, documentsPage: 1 })}
              options={[{ label: "Todos", value: "all" }, ...books.map((book) => ({ label: book.title, value: book.id }))]}
              value={documentsFilters.bookId ?? "all"}
            />
            <Select
              id="admin-knowledge-document-type"
              label="Tipo"
              onChange={(event) => updateParams({ type: event.target.value, documentsPage: 1 })}
              options={[{ label: "Todos", value: "all" }, ...ADMIN_KNOWLEDGE_DOCUMENT_TYPES.map((type) => ({ label: documentTypeLabel[type], value: type }))]}
              value={documentsFilters.type ?? "all"}
            />
            <Select
              id="admin-knowledge-document-status"
              label="Estado"
              onChange={(event) => updateParams({ editorialStatus: event.target.value, documentsPage: 1 })}
              options={[{ label: "Todos", value: "all" }, ...ADMIN_KNOWLEDGE_EDITORIAL_STATUSES.map((status) => ({ label: editorialLabel[status], value: status }))]}
              value={documentsFilters.editorialStatus ?? "all"}
            />
            <Select
              id="admin-knowledge-document-review"
              label="Revisão"
              onChange={(event) => updateParams({ teacherReviewRecommended: event.target.value, documentsPage: 1 })}
              options={[
                { label: "Todos", value: "all" },
                { label: "Recomendada", value: "true" },
                { label: "Não recomendada", value: "false" },
              ]}
              value={String(documentsFilters.teacherReviewRecommended)}
            />
            <Select
              id="admin-knowledge-document-sensitive"
              label="Temas sensíveis"
              onChange={(event) => updateParams({ hasSensitiveTopics: event.target.value, documentsPage: 1 })}
              options={[
                { label: "Todos", value: "all" },
                { label: "Com temas", value: "true" },
                { label: "Sem temas", value: "false" },
              ]}
              value={String(documentsFilters.hasSensitiveTopics)}
            />
            <Select
              id="admin-knowledge-documents-sort"
              label="Ordenar por"
              onChange={(event) => updateParams({ documentsSortBy: event.target.value, documentsPage: 1 })}
              options={[
                { label: "Ordem", value: "sortOrder" },
                { label: "Título", value: "title" },
                { label: "Tipo", value: "type" },
                { label: "Estado", value: "editorialStatus" },
                { label: "Criado em", value: "createdAt" },
                { label: "Atualizado em", value: "updatedAt" },
              ]}
              value={documentsFilters.sortBy}
            />
            <Select
              id="admin-knowledge-documents-order"
              label="Direção"
              onChange={(event) => updateParams({ documentsSortOrder: event.target.value, documentsPage: 1 })}
              options={[
                { label: "Ascendente", value: "asc" },
                { label: "Descendente", value: "desc" },
              ]}
              value={documentsFilters.sortOrder}
            />
            <Button onClick={(event) => void handleOpenDocumentDialog("create", null, event.currentTarget)}>
              Novo documento
            </Button>
          </div>
          <KnowledgeListState
            emptyFiltered={Boolean(documentsFilters.search || documentsFilters.bookId || documentsFilters.type !== "all" || documentsFilters.editorialStatus !== "all")}
            onRetry={() => void loadDocuments()}
            state={documentsState}
          />
          {documents.length > 0 ? (
            <div className="admin-knowledge-grid">
              {documents.map((document) => (
                <Card className="admin-knowledge-card" key={document.id} tone={document.editorialStatus === "archived" ? "soft" : "default"}>
                  <div className="admin-knowledge-card__header">
                    <div>
                      <h2>{document.title}</h2>
                      <p>{document.book.title ?? document.bookId} · {documentTypeLabel[document.type]}</p>
                    </div>
                    <StatusTag label={editorialLabel[document.editorialStatus]} tone={editorialTone[document.editorialStatus]} />
                  </div>
                  <p>{document.description || document.summary || "Sem resumo editorial."}</p>
                  <div className="admin-knowledge-badges">
                    <Badge tone="neutral">{document.filePath}</Badge>
                    {document.teacherReviewRecommended ? <Badge tone="brand">Revisão recomendada</Badge> : <Badge tone="neutral">Revisão simples</Badge>}
                    {document.sensitiveTopics.length > 0 ? <Badge tone="sand">Temas sensíveis</Badge> : null}
                  </div>
                  <p className="admin-knowledge-status-help">{editorialDescription[document.editorialStatus]}</p>
                  <dl className="admin-user-card__meta">
                    <div><dt>Versão</dt><dd>{document.version}</dd></div>
                    <div><dt>Atualizado</dt><dd>{formatDate(document.updatedAt)}</dd></div>
                    <div><dt>Revisor</dt><dd>{document.reviewedBy?.name ?? "Não informado"}</dd></div>
                    <div><dt>Aprovador</dt><dd>{document.approvedBy?.name ?? "Não informado"}</dd></div>
                  </dl>
                  <div className="admin-knowledge-badges" aria-label={`Tags de ${document.title}`}>
                    {document.tags.map((tag) => <Badge key={`${document.id}-${tag}`} tone="sand">{tag}</Badge>)}
                  </div>
                  <div className="button-row admin-knowledge-card__actions">
                    <Button onClick={(event) => void handleOpenDocumentDialog("edit", document, event.currentTarget)} variant="secondary">
                      Detalhar e editar
                    </Button>
                    {getDocumentTransitions(document).map((transition) => (
                      <Button
                        disabled={transitioningId === document.id}
                        key={`${document.id}-${transition.status}`}
                        onClick={(event) => handleTransition(document, transition.status, event.currentTarget)}
                        variant={transition.status === "approved" ? "primary" : "ghost"}
                      >
                        {transition.label}
                      </Button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
          <PaginationControls meta={documentsMeta} onPageChange={(page) => updateParams({ documentsPage: page })} />
        </section>
      )}

      {bookDialog ? (
        <BookDialog
          conflictState={conflictState?.type === "book" ? conflictState : null}
          dialog={bookDialog}
          error={actionError}
          isSaving={isSaving}
          onCancel={() => {
            const trigger = bookDialog.trigger;
            setBookDialog(null);
            setConflictState(null);
            window.setTimeout(() => trigger?.focus(), 0);
          }}
          onDiscardConflict={discardDraftForCurrent}
          onReloadConflict={() => void reloadConflictRecord()}
          onSubmit={(values) => void handleSaveBook(values)}
        />
      ) : null}

      {documentDialog ? (
        <DocumentDialog
          books={books}
          conflictState={conflictState?.type === "document" ? conflictState : null}
          dialog={documentDialog}
          error={actionError}
          isSaving={isSaving}
          onCancel={() => {
            const trigger = documentDialog.trigger;
            setDocumentDialog(null);
            setConflictState(null);
            window.setTimeout(() => trigger?.focus(), 0);
          }}
          onDiscardConflict={discardDraftForCurrent}
          onReloadConflict={() => void reloadConflictRecord()}
          onSubmit={(values) => void handleSaveDocument(values)}
        />
      ) : null}

      {confirmState ? (
        <ConfirmDialog
          confirmState={confirmState}
          isSaving={isSaving || Boolean(transitioningId)}
          onCancel={() => {
            const trigger = confirmState.trigger;
            setConfirmState(null);
            window.setTimeout(() => trigger?.focus(), 0);
          }}
        />
      ) : null}
    </div>
  );
};

const KnowledgeListState = <TItem,>({
  state,
  emptyFiltered,
  onRetry,
}: {
  state: LoadState<TItem>;
  emptyFiltered: boolean;
  onRetry: () => void;
}) => {
  if (state.status === "loading") {
    return <LoadingState title="Carregando catálogo editorial" description="Consultando a API administrativa da base de conhecimento." />;
  }
  if (state.status === "error") {
    return (
      <AlertBox title="Catálogo editorial indisponível" tone="warning">
        <p>{state.message}</p>
        <div className="button-row">
          <Button onClick={onRetry} variant="secondary">
            Tentar novamente
          </Button>
        </div>
      </AlertBox>
    );
  }
  if (state.status === "empty") {
    return (
      <EmptyState
        title={emptyFiltered ? "Nenhum resultado para os filtros" : "Nenhum item foi encontrado no catálogo editorial"}
        description={
          emptyFiltered
            ? "Ajuste busca e filtros para consultar outra parte do catálogo."
            : "A preparação do catálogo é realizada por operação local e não por esta interface."
        }
      />
    );
  }
  return null;
};

const BookDialog = ({
  conflictState,
  dialog,
  error,
  isSaving,
  onCancel,
  onDiscardConflict,
  onReloadConflict,
  onSubmit,
}: {
  conflictState: Extract<ConflictState, { type: "book" }> | null;
  dialog: NonNullable<BookDialogState>;
  error: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onDiscardConflict: () => void;
  onReloadConflict: () => void;
  onSubmit: (values: AdminKnowledgeBookFormState) => void;
}) => {
  const [values, setValues] = useState(() => bookToFormState(dialog.book ?? undefined));
  const [fieldError, setFieldError] = useState<string | null>(null);
  useDialogFocus("admin-book-title", onCancel, isSaving);
  const title = dialog.mode === "create" ? "Novo livro" : "Editar livro";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!buildBookInput(values)) {
      setFieldError("Informe slug, título e ordem numérica.");
      return;
    }
    setFieldError(null);
    onSubmit(values);
  };

  return (
    <div aria-describedby="admin-book-dialog-description" aria-labelledby="admin-book-dialog-title" aria-modal="true" className="admin-modal-backdrop" role="dialog">
      <Card className="admin-modal admin-knowledge-modal" tone="soft">
        <h2 id="admin-book-dialog-title">{title}</h2>
        <p id="admin-book-dialog-description">Edite apenas metadados administrativos do livro. Alterações usam concorrência otimista por versão.</p>
        <form className="teacher-form-grid" onSubmit={handleSubmit}>
          {error ? <AlertBox title="Não foi possível salvar" tone="warning">{error}</AlertBox> : null}
          {fieldError ? <AlertBox title="Revise o formulário" tone="warning">{fieldError}</AlertBox> : null}
          <ConflictBox conflictState={conflictState} onDiscard={onDiscardConflict} onReload={onReloadConflict} />
          <TextInput id="admin-book-slug" label="Slug" disabled={isSaving} onChange={(event) => setValues({ ...values, slug: event.target.value })} value={values.slug} />
          <TextInput id="admin-book-title" label="Título" disabled={isSaving} onChange={(event) => setValues({ ...values, title: event.target.value })} value={values.title} />
          <TextArea id="admin-book-description" label="Descrição" disabled={isSaving} onChange={(event) => setValues({ ...values, description: event.target.value })} value={values.description} />
          <Select id="admin-book-status" label="Status" disabled={isSaving} onChange={(event) => setValues({ ...values, status: event.target.value as AdminKnowledgeBookStatus })} options={ADMIN_KNOWLEDGE_BOOK_STATUSES.map((status) => ({ label: bookStatusLabel[status], value: status }))} value={values.status} />
          <TextInput id="admin-book-sort" label="Ordem" disabled={isSaving} onChange={(event) => setValues({ ...values, sortOrder: event.target.value })} type="number" value={values.sortOrder} />
          <div className="button-row admin-knowledge-modal__actions">
            <Button disabled={isSaving} type="submit">{isSaving ? "Salvando..." : "Salvar"}</Button>
            <Button disabled={isSaving} onClick={onCancel} variant="secondary">Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

const DocumentDialog = ({
  books,
  conflictState,
  dialog,
  error,
  isSaving,
  onCancel,
  onDiscardConflict,
  onReloadConflict,
  onSubmit,
}: {
  books: AdminKnowledgeBook[];
  conflictState: Extract<ConflictState, { type: "document" }> | null;
  dialog: NonNullable<DocumentDialogState>;
  error: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onDiscardConflict: () => void;
  onReloadConflict: () => void;
  onSubmit: (values: AdminKnowledgeDocumentFormState) => void;
}) => {
  const [values, setValues] = useState(() => documentToFormState(dialog.document ?? undefined));
  const [fieldError, setFieldError] = useState<string | null>(null);
  useDialogFocus("admin-document-title", onCancel, isSaving);
  const title = dialog.mode === "create" ? "Novo documento" : "Editar documento";
  const fileExists = dialog.document?.fileExists;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!buildDocumentInput(values)) {
      setFieldError("Informe livro, caminho, título, tipo e ordem numérica.");
      return;
    }
    setFieldError(null);
    onSubmit(values);
  };

  return (
    <div aria-describedby="admin-document-dialog-description" aria-labelledby="admin-document-dialog-title" aria-modal="true" className="admin-modal-backdrop" role="dialog">
      <Card className="admin-modal admin-knowledge-modal" tone="soft">
        <h2 id="admin-document-dialog-title">{title}</h2>
        <p id="admin-document-dialog-description">Cadastre e edite metadados editoriais. O conteúdo Markdown não é exibido nem alterado nesta interface.</p>
        <form className="teacher-form-grid" onSubmit={handleSubmit}>
          {error ? <AlertBox title="Não foi possível salvar" tone="warning">{error}</AlertBox> : null}
          {fieldError ? <AlertBox title="Revise o formulário" tone="warning">{fieldError}</AlertBox> : null}
          {fileExists === false ? <AlertBox title="Arquivo ausente" tone="warning">O arquivo relativo registrado não foi encontrado em data/knowledge.</AlertBox> : null}
          {fileExists === true ? <AlertBox title="Arquivo encontrado" tone="success">O caminho relativo foi validado pelo backend.</AlertBox> : null}
          <ConflictBox conflictState={conflictState} onDiscard={onDiscardConflict} onReload={onReloadConflict} />
          <Select id="admin-document-book" label="Livro" disabled={isSaving} onChange={(event) => setValues({ ...values, bookId: event.target.value })} options={[{ label: "Selecione", value: "" }, ...books.map((book) => ({ label: book.title, value: book.id }))]} value={values.bookId} />
          <TextInput id="admin-document-path" label="Caminho relativo" disabled={isSaving || dialog.mode === "edit"} helperText="Deve iniciar com data/knowledge/ e terminar em .md." onChange={(event) => setValues({ ...values, filePath: event.target.value })} value={values.filePath} />
          <TextInput id="admin-document-catalog-key" label="Chave de catálogo" disabled={isSaving || dialog.mode === "edit"} onChange={(event) => setValues({ ...values, catalogKey: event.target.value })} value={values.catalogKey} />
          <TextInput id="admin-document-title" label="Título editorial" disabled={isSaving} onChange={(event) => setValues({ ...values, title: event.target.value })} value={values.title} />
          <TextArea id="admin-document-description" label="Descrição" disabled={isSaving} onChange={(event) => setValues({ ...values, description: event.target.value })} value={values.description} />
          <TextArea id="admin-document-summary" label="Resumo" disabled={isSaving} onChange={(event) => setValues({ ...values, summary: event.target.value })} value={values.summary} />
          <Select id="admin-document-type" label="Tipo" disabled={isSaving} onChange={(event) => setValues({ ...values, type: event.target.value as AdminKnowledgeDocumentType })} options={ADMIN_KNOWLEDGE_DOCUMENT_TYPES.map((type) => ({ label: documentTypeLabel[type], value: type }))} value={values.type} />
          <TextInput id="admin-document-tags" label="Tags" disabled={isSaving} helperText="Separe por vírgulas." onChange={(event) => setValues({ ...values, tags: event.target.value })} value={values.tags} />
          <TextInput id="admin-document-sensitive" label="Temas sensíveis" disabled={isSaving} helperText="Separe por vírgulas. Preencher este campo força revisão recomendada." onChange={(event) => setValues({ ...values, sensitiveTopics: event.target.value, teacherReviewRecommended: event.target.value.trim() ? true : values.teacherReviewRecommended })} value={values.sensitiveTopics} />
          <label className="admin-knowledge-checkbox">
            <input checked={values.teacherReviewRecommended} disabled={isSaving || Boolean(values.sensitiveTopics.trim())} onChange={(event) => setValues({ ...values, teacherReviewRecommended: event.target.checked })} type="checkbox" />
            <span>Revisão por professor recomendada</span>
          </label>
          <TextArea id="admin-document-notes" label="Notas editoriais" disabled={isSaving} onChange={(event) => setValues({ ...values, editorialNotes: event.target.value })} value={values.editorialNotes} />
          <TextInput id="admin-document-sort" label="Ordem" disabled={isSaving} onChange={(event) => setValues({ ...values, sortOrder: event.target.value })} type="number" value={values.sortOrder} />
          <div className="admin-knowledge-badges">
            {splitList(values.tags).map((tag) => <Badge key={`tag-${tag}`} tone="sand">{tag}</Badge>)}
            {splitList(values.sensitiveTopics).map((topic) => <Badge key={`topic-${topic}`} tone="brand">{topic}</Badge>)}
          </div>
          <div className="button-row admin-knowledge-modal__actions">
            <Button disabled={isSaving} type="submit">{isSaving ? "Salvando..." : "Salvar"}</Button>
            <Button disabled={isSaving} onClick={onCancel} variant="secondary">Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

const ConflictBox = ({
  conflictState,
  onDiscard,
  onReload,
}: {
  conflictState: ConflictState;
  onDiscard: () => void;
  onReload: () => void;
}) => {
  if (!conflictState) return null;
  return (
    <AlertBox title="Conflito de versão" tone="warning">
      <p>{conflictState.message}</p>
      <div className="button-row">
        <Button onClick={onReload} variant="secondary">Recarregar registro</Button>
        {conflictState.current ? <Button onClick={onDiscard} variant="ghost">Descartar minha edição e usar a versão atual</Button> : null}
      </div>
    </AlertBox>
  );
};

const ConfirmDialog = ({
  confirmState,
  isSaving,
  onCancel,
}: {
  confirmState: NonNullable<ConfirmState>;
  isSaving: boolean;
  onCancel: () => void;
}) => {
  useDialogFocus("admin-confirm-cancel", onCancel, isSaving);
  return (
    <div aria-describedby="admin-confirm-description" aria-labelledby="admin-confirm-title" aria-modal="true" className="admin-modal-backdrop" role="dialog">
      <Card className="admin-modal" tone="soft">
        <h2 id="admin-confirm-title">{confirmState.title}</h2>
        <p id="admin-confirm-description">{confirmState.description}</p>
        <div className="button-row admin-knowledge-modal__actions">
          <Button disabled={isSaving} onClick={confirmState.onConfirm}>{isSaving ? "Executando..." : confirmState.confirmLabel}</Button>
          <Button disabled={isSaving} id="admin-confirm-cancel" onClick={onCancel} variant="secondary">Cancelar</Button>
        </div>
      </Card>
    </div>
  );
};

const useDialogFocus = (
  focusId: string,
  onCancel: () => void,
  isSubmitting: boolean,
) => {
  useEffect(() => {
    document.getElementById(focusId)?.focus();
  }, [focusId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isSubmitting) return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isSubmitting, onCancel]);
};
