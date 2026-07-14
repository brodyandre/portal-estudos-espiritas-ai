import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
import { ServiceRequestError } from "../services/api";
import {
  baseResult,
  buildBaseResult,
  buildResult,
  buildResendResult,
  changeFilters,
  createWaitForInitialLoad,
  renderPage,
  restoreOriginalLocation,
} from "./AdminAccountInvitationsPageTestSupport";

vi.mock("../services/adminAccountInvitationsService", () => ({
  cancelAdminAccountInvitation: vi.fn(),
  listAdminAccountInvitations: vi.fn(),
  resendAdminAccountInvitation: vi.fn(),
}));

const cancelInvitationMock = vi.mocked(cancelAdminAccountInvitation);
const listInvitationsMock = vi.mocked(listAdminAccountInvitations);
const resendInvitationMock = vi.mocked(resendAdminAccountInvitation);
const waitForInitialLoad = createWaitForInitialLoad(listInvitationsMock);

describe("AdminAccountInvitationsPage", () => {
  beforeEach(() => {
    listInvitationsMock.mockReset();
    cancelInvitationMock.mockReset();
    resendInvitationMock.mockReset();

    listInvitationsMock.mockResolvedValue(buildBaseResult());
    cancelInvitationMock.mockResolvedValue({ canceled: true });
    resendInvitationMock.mockResolvedValue(buildResendResult());
  });

  afterEach(() => {
    cleanup();

    listInvitationsMock.mockReset();
    cancelInvitationMock.mockReset();
    resendInvitationMock.mockReset();

    vi.clearAllMocks();

    window.localStorage.clear();
    window.sessionStorage.clear();

    restoreOriginalLocation();
  });

  it("nao consulta automaticamente ao editar filtros", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    changeFilters();

    expect(listInvitationsMock).not.toHaveBeenCalled();
  });

  it("aplicar filtros envia todos os parametros corretos", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    changeFilters();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith({
        search: "Ana",
        deliveryStatus: "sent",
        lifecycleStatus: "pending",
        invitationType: "admin_reinvite",
        sortBy: "recipient",
        sortOrder: "asc",
        pageSize: 25,
        page: 1,
      });
    });
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });

  it("enter no formulario aplica filtros", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Bruno" },
    });
    fireEvent.submit(screen.getByLabelText("Buscar por destinatário").closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith({
        search: "Bruno",
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
  });

  it("busca e trimada antes da consulta", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "  Ana Beatriz  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Ana Beatriz" }),
      );
    });
  });

  it("filtros vazios sao enviados como ausentes", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith({
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
  });

  it("aplicar filtros reinicia a pagina para 1", async () => {
    listInvitationsMock.mockResolvedValueOnce(buildResult({ page: 2, total: 24, totalPages: 3 }));
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await screen.findByText("Página 2 de 3 · 24 convites");
    listInvitationsMock.mockClear();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Ana", page: 1 }),
      );
    });
  });

  it("limpar filtros restaura os defaults e executa uma consulta", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    changeFilters();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith({
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });

  it("limpar filtros atualiza os campos visuais", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    changeFilters();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Buscar por destinatário")).toHaveValue("");
    expect(screen.getByLabelText("Status de entrega")).toHaveValue("");
    expect(screen.getByLabelText("Ciclo de vida")).toHaveValue("");
    expect(screen.getByLabelText("Tipo")).toHaveValue("");
    expect(screen.getByLabelText("Ordenar por")).toHaveValue("createdAt");
    expect(screen.getByLabelText("Direção")).toHaveValue("desc");
    expect(screen.getByLabelText("Tamanho da página")).toHaveValue("10");
  });

  it("limpar estado ja limpo nao gera consulta duplicada", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(listInvitationsMock).not.toHaveBeenCalled();
  });

  it("envia pageSize como numero", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Tamanho da página"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 50 }));
    });
  });

  it("ordenacao envia sortBy e sortOrder", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Ordenar por"), {
      target: { value: "expiresAt" },
    });
    fireEvent.change(screen.getByLabelText("Direção"), {
      target: { value: "asc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "expiresAt", sortOrder: "asc" }),
      );
    });
  });

  it("anterior fica desabilitado na primeira pagina", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByRole("button", { name: "Anterior" })).toBeDisabled();
  });

  it("proxima fica desabilitada na ultima pagina", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({ page: 3, total: 24, totalPages: 3 }));

    renderPage();

    expect(await screen.findByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("filtros continuam funcionando apos erro de reenvio", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }),
    );

    renderPage();
    await waitForInitialLoad();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));
    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();
    listInvitationsMock.mockClear();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Ana", page: 1 }),
      );
    });
  });

  it("paginacao continua funcionando apos erro de reenvio", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockRejectedValue(
      new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }),
    );

    renderPage();
    await waitForInitialLoad();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));
    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();
    listInvitationsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  it("clique em proxima mantem filtros aplicados", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalledTimes(1));
    listInvitationsMock.mockClear();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Nao aplicado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Ana", page: 2 }),
      );
    });
  });

  it("clique em anterior mantem filtros aplicados", async () => {
    listInvitationsMock.mockResolvedValueOnce(baseResult);
    listInvitationsMock.mockResolvedValueOnce(baseResult);
    listInvitationsMock.mockResolvedValueOnce(buildResult({ page: 2, total: 24, totalPages: 3 }));
    listInvitationsMock.mockResolvedValueOnce(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalledTimes(1));
    listInvitationsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalledTimes(1));
    await screen.findByText("Página 2 de 3 · 24 convites");
    listInvitationsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Ana", page: 1 }),
      );
    });
  });

  it("retry repete a ultima consulta aplicada", async () => {
    listInvitationsMock.mockResolvedValueOnce(baseResult);
    listInvitationsMock.mockRejectedValueOnce(new ServiceRequestError({ kind: "api", message: "Falha filtrada." }));
    listInvitationsMock.mockResolvedValueOnce(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(await screen.findByText("Falha filtrada.")).toBeInTheDocument();
    listInvitationsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Ana", page: 1 }),
      );
    });
  });

  it("edicao nao aplicada nao afeta retry", async () => {
    listInvitationsMock.mockResolvedValueOnce(baseResult);
    listInvitationsMock.mockRejectedValueOnce(new ServiceRequestError({ kind: "api", message: "Falha filtrada." }));
    listInvitationsMock.mockResolvedValueOnce(baseResult);

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(await screen.findByText("Falha filtrada.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Bruno" },
    });
    listInvitationsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Ana", page: 1 }),
      );
    });
  });

  it("corrige pagina acima do total sem loop", async () => {
    listInvitationsMock.mockResolvedValueOnce(buildResult({ page: 2, total: 24, totalPages: 3 }));
    listInvitationsMock.mockResolvedValueOnce(buildResult({ page: 3, total: 24, totalPages: 2 }));
    listInvitationsMock.mockResolvedValueOnce(buildResult({ page: 2, total: 24, totalPages: 2 }));

    renderPage();
    await screen.findByText("Página 2 de 3 · 24 convites");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(await screen.findByText("Página 2 de 2 · 24 convites")).toBeInTheDocument();
    expect(listInvitationsMock).toHaveBeenCalledTimes(3);
    expect(listInvitationsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("totalPages zero nao dispara correcao infinita", async () => {
    listInvitationsMock.mockResolvedValueOnce(baseResult);
    listInvitationsMock.mockResolvedValueOnce({
      items: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      },
    });

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Sem resultado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(await screen.findByText("0 convites")).toBeInTheDocument();
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });

  it("falha preserva os campos editaveis", async () => {
    listInvitationsMock.mockResolvedValueOnce(baseResult);
    listInvitationsMock.mockRejectedValueOnce(new ServiceRequestError({ kind: "api", message: "Falha filtrada." }));

    renderPage();
    await waitForInitialLoad();
    changeFilters();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(await screen.findByText("Falha filtrada.")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar por destinatário")).toHaveValue("  Ana  ");
    expect(screen.getByLabelText("Status de entrega")).toHaveValue("sent");
    expect(screen.getByLabelText("Ciclo de vida")).toHaveValue("pending");
    expect(screen.getByLabelText("Tipo")).toHaveValue("admin_reinvite");
    expect(screen.getByLabelText("Ordenar por")).toHaveValue("recipient");
    expect(screen.getByLabelText("Direção")).toHaveValue("asc");
    expect(screen.getByLabelText("Tamanho da página")).toHaveValue("25");
  });

  it("renderiza erro seguro retornado pelo servico", async () => {
    listInvitationsMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "RATE_LIMITED",
        message: "Muitas tentativas. Tente novamente mais tarde.",
      }),
    );

    renderPage();

    expect(await screen.findByText("Muitas tentativas. Tente novamente mais tarde.")).toBeInTheDocument();
    expect(screen.queryByText("/api/admin/account-invitations")).not.toBeInTheDocument();
  });

  it("refaz a chamada somente quando o usuario clica em tentar novamente", async () => {
    listInvitationsMock
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "network",
          message: "Nao foi possivel conectar ao backend local agora.",
        }),
      )
      .mockResolvedValueOnce(baseResult);

    renderPage();

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
    expect(listInvitationsMock).toHaveBeenCalledTimes(2);
  });
});
