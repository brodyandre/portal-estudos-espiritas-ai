import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
import { ServiceRequestError } from "../services/api";
import type { AccountInvitationListResult } from "../types/adminAccountInvitations";
import {
  baseInvitation,
  baseResult,
  buildBaseResult,
  buildInvitation,
  buildResult,
  buildResendResult,
  createDeferred,
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

  it("botao cancelar convite aparece para convite pendente", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByRole("button", { name: "Cancelar convite" })).toBeInTheDocument();
  });

  it("botao cancelar convite nao aparece para convite aceito", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({}, [buildInvitation({ lifecycleStatus: "accepted" })]));

    renderPage();

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar convite" })).not.toBeInTheDocument();
  });

  it("botao cancelar convite nao aparece para convite expirado", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({}, [buildInvitation({ lifecycleStatus: "expired" })]));

    renderPage();

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar convite" })).not.toBeInTheDocument();
  });

  it("botao cancelar convite nao aparece para convite cancelado", async () => {
    listInvitationsMock.mockResolvedValue(buildResult({}, [buildInvitation({ lifecycleStatus: "canceled" })]));

    renderPage();

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar convite" })).not.toBeInTheDocument();
  });

  it("deliveryStatus nao interfere na elegibilidade do cancelamento", async () => {
    listInvitationsMock.mockResolvedValue(
      buildResult({}, [buildInvitation({ deliveryStatus: "failed", lifecycleStatus: "pending" })]),
    );

    renderPage();

    expect(await screen.findByRole("button", { name: "Cancelar convite" })).toBeInTheDocument();
  });

  it("clique em cancelar abre confirmacao", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));

    const dialog = screen.getByRole("dialog", { name: /Cancelar convite de Ana Beatriz/i });
    const title = screen.getByRole("heading", { name: "Cancelar convite de Ana Beatriz?" });

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby", "cancel-invitation-dialog-title");
    expect(dialog).not.toHaveAttribute("aria-label");
    expect(title).toHaveAttribute("id", "cancel-invitation-dialog-title");
    expect(dialog.getAttribute("aria-labelledby")).not.toContain("invitation-internal-id-001");
    expect(title).not.toHaveTextContent("invitation-internal-id-001");
  });

  it("confirmacao mostra nome e email mascarado", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));

    expect(screen.getByText("Cancelar convite de Ana Beatriz?")).toBeInTheDocument();
    expect(screen.getAllByText("a***z@example.com").length).toBeGreaterThan(0);
  });

  it("confirmacao nao mostra id do convite", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));

    expect(screen.queryByText("invitation-internal-id-001")).not.toBeInTheDocument();
  });

  it("manter convite fecha confirmacao sem chamar servico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Manter convite" }));

    expect(screen.queryByRole("dialog", { name: /Cancelar convite de Ana Beatriz/i })).not.toBeInTheDocument();
    expect(cancelInvitationMock).not.toHaveBeenCalled();
  });

  it("confirmar cancelamento chama servico com id correto", async () => {
    const cancellation = createDeferred<{ canceled: true }>();
    cancelInvitationMock.mockReturnValue(cancellation.promise);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => {
      expect(cancelInvitationMock).toHaveBeenCalledWith("invitation-internal-id-001");
    });

    await act(async () => {
      cancellation.resolve({ canceled: true });
      await cancellation.promise;
    });

    expect(await screen.findByText("Convite cancelado com sucesso.")).toBeInTheDocument();
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("duplo clique em confirmar cancelamento nao gera duas chamadas", async () => {
    const cancellation = createDeferred<{ canceled: true }>();
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockReturnValue(cancellation.promise);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    const confirmButton = screen.getByRole("button", { name: "Confirmar cancelamento" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(cancelInvitationMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      cancellation.resolve({ canceled: true });
      await cancellation.promise;
    });
  });

  it("botoes ficam desabilitados durante o cancelamento", async () => {
    const cancellation = createDeferred<{ canceled: true }>();
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockReturnValue(cancellation.promise);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => {
      expect(cancelInvitationMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("button", { name: "Cancelando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Manter convite" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar convite" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reenviar convite" })).toBeDisabled();

    await act(async () => {
      cancellation.resolve({ canceled: true });
      await cancellation.promise;
    });

    await screen.findByText("Convite cancelado com sucesso.");
  });

  it("sucesso fecha confirmacao", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockResolvedValue({ canceled: true });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Confirmar cancelamento de convite" })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("sucesso exibe mensagem segura", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockResolvedValue({ canceled: true });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Convite cancelado com sucesso.")).toBeInTheDocument();
    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("sucesso recarrega exatamente a consulta aplicada", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockResolvedValue({ canceled: true });

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("Ordenar por"), {
      target: { value: "recipient" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalledTimes(1));
    listInvitationsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith({
        search: "Ana",
        sortBy: "recipient",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
  });

  it("rascunhos nao aplicados nao entram na recarga apos sucesso", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockResolvedValue({ canceled: true });

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Nao aplicado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith({
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
    expect(listInvitationsMock).not.toHaveBeenCalledWith(expect.objectContaining({ search: "Nao aplicado" }));
  });

  it("sucesso nao remove item otimisticamente antes da recarga", async () => {
    const reload = createDeferred<AccountInvitationListResult>();
    listInvitationsMock.mockResolvedValueOnce(baseResult).mockReturnValueOnce(reload.promise);
    cancelInvitationMock.mockResolvedValue({ canceled: true });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Convite cancelado com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("Ana Beatriz")).toBeInTheDocument();

    await act(async () => {
      reload.resolve(buildResult({}, []));
      await reload.promise;
    });
  });

  it("erro 409 permanece como erro de acao seguro", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "ACCOUNT_INVITATION_NOT_CANCELABLE",
        message: "ACCOUNT_INVITATION_NOT_CANCELABLE",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(
      await screen.findByText("Este convite não pode mais ser cancelado. Atualize a lista para consultar o estado atual."),
    ).toBeInTheDocument();
    expect(screen.queryByText("ACCOUNT_INVITATION_NOT_CANCELABLE")).not.toBeInTheDocument();
  });

  it("erro 409 nao altera o item localmente", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "ACCOUNT_INVITATION_NOT_CANCELABLE",
        message: "ACCOUNT_INVITATION_NOT_CANCELABLE",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Este convite não pode mais ser cancelado. Atualize a lista para consultar o estado atual.")).toBeInTheDocument();
    expect(screen.getAllByText("Aguardando aceite").length).toBeGreaterThan(0);
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });

  it("erro 429 nao dispara retry automatico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "RATE_LIMITED",
        message: "Muitas tentativas. Tente novamente em cerca de 1 minuto.",
        retryAfterSeconds: 60,
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Muitas tentativas. Tente novamente em cerca de 1 minuto.")).toBeInTheDocument();
    expect(cancelInvitationMock).toHaveBeenCalledTimes(1);
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });

  it("erro 401 de cancelamento usa mensagem segura do servico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "UNAUTHORIZED",
        message: "Sessão expirada. Entre novamente.",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Sessão expirada. Entre novamente.")).toBeInTheDocument();
    expect(screen.queryByText("invitation-internal-id-001")).not.toBeInTheDocument();
  });

  it("erro 403 de cancelamento usa mensagem segura do servico", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "FORBIDDEN",
        message: "Você não tem permissão para cancelar este convite.",
      }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Você não tem permissão para cancelar este convite.")).toBeInTheDocument();
    expect(screen.queryByText("invitation-internal-id-001")).not.toBeInTheDocument();
  });

  it("falha de rede permite nova tentativa explicita", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock
      .mockRejectedValueOnce(new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }))
      .mockResolvedValueOnce({ canceled: true });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => expect(cancelInvitationMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Convite cancelado com sucesso.")).toBeInTheDocument();
  });

  it("erro de acao nao substitui erro de carregamento", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível cancelar o convite")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar convites")).not.toBeInTheDocument();
  });

  it("nova tentativa limpa erro anterior", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }),
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));
    expect(
      await screen.findByRole("dialog", { name: /Cancelar convite de Ana Beatriz/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Nao foi possivel conectar ao backend local agora.")).not.toBeInTheDocument();
    });
  });

  it("nao atualiza estado apos desmontar durante cancelamento", async () => {
    const cancellation = createDeferred<{ canceled: true }>();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockReturnValue(cancellation.promise);

    const { unmount } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    unmount();

    await act(async () => {
      cancellation.resolve({ canceled: true });
      await cancellation.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("resposta antiga da listagem nao sobrescreve recarga apos sucesso", async () => {
    const reload = createDeferred<AccountInvitationListResult>();
    const reloadedInvitation = buildInvitation({ recipientName: "Convite Atualizado" });
    listInvitationsMock.mockResolvedValueOnce(baseResult).mockReturnValueOnce(reload.promise);
    cancelInvitationMock.mockResolvedValue({ canceled: true });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await act(async () => {
      reload.resolve(buildResult({ total: 1, totalPages: 1 }, [reloadedInvitation]));
      await reload.promise;
    });

    expect(await screen.findByText("Convite Atualizado")).toBeInTheDocument();
    expect(screen.queryByText("Página 2 de 3 · 24 convites")).not.toBeInTheDocument();
  });

  it("somente um convite pode estar em cancelamento", async () => {
    const cancellation = createDeferred<{ canceled: true }>();
    listInvitationsMock.mockResolvedValue(
      buildResult(
        { total: 2, totalPages: 1 },
        [
          baseInvitation,
          buildInvitation({
            id: "second-invitation-id",
            recipientName: "Bruno Lima",
            recipientEmailMasked: "b***a@example.com",
          }),
        ],
      ),
    );
    cancelInvitationMock.mockReturnValue(cancellation.promise);

    renderPage();
    const cancelButtons = await screen.findAllByRole("button", { name: "Cancelar convite" });
    fireEvent.click(cancelButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(cancelInvitationMock).toHaveBeenCalledTimes(1);
    expect(cancelButtons[0]).toBeDisabled();
    expect(cancelButtons[1]).toBeDisabled();

    await act(async () => {
      cancellation.resolve({ canceled: true });
      await cancellation.promise;
    });
  });

  it("filtros continuam funcionando apos erro de cancelamento", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }),
    );

    renderPage();
    await waitForInitialLoad();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
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

  it("paginacao continua funcionando apos erro de cancelamento", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    cancelInvitationMock.mockRejectedValue(
      new ServiceRequestError({ kind: "network", message: "Nao foi possivel conectar ao backend local agora." }),
    );

    renderPage();
    await waitForInitialLoad();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText("Nao foi possivel conectar ao backend local agora.")).toBeInTheDocument();
    listInvitationsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });
});
