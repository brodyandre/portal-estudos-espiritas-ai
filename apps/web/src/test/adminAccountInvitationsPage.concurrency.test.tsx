import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
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

  it("cancelamento e reenvio nao executam simultaneamente", async () => {
    const resend = createDeferred<ReturnType<typeof buildResendResult>>();
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockReturnValue(resend.promise);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(screen.getByRole("button", { name: "Cancelar convite" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));

    expect(cancelInvitationMock).not.toHaveBeenCalled();
    expect(resendInvitationMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resend.resolve(buildResendResult());
      await resend.promise;
    });
  });

  it("nao atualiza estado apos desmontar durante reenvio", async () => {
    const resend = createDeferred<ReturnType<typeof buildResendResult>>();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockReturnValue(resend.promise);

    const { unmount } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));
    unmount();

    await act(async () => {
      resend.resolve(buildResendResult());
      await resend.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("nao atualiza estado apos desmontar durante recarga iniciada por reenvio bem-sucedido", async () => {
    const resend = createDeferred<ReturnType<typeof buildResendResult>>();
    const reload = createDeferred<AccountInvitationListResult>();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listInvitationsMock.mockResolvedValueOnce(baseResult).mockReturnValueOnce(reload.promise);
    resendInvitationMock.mockReturnValue(resend.promise);

    try {
      const { unmount } = renderPage();

      expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
      expect(listInvitationsMock).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

      await waitFor(() => expect(resendInvitationMock).toHaveBeenCalledTimes(1));
      expect(listInvitationsMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        resend.resolve(buildResendResult());
        await resend.promise;
      });

      expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();
      await waitFor(() => expect(listInvitationsMock).toHaveBeenCalledTimes(2));
      expect(listInvitationsMock).toHaveBeenLastCalledWith({
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });

      unmount();

      await act(async () => {
        reload.resolve(buildResult({}, [buildInvitation({ recipientName: "Convite Recarregado" })]));
        await reload.promise;
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(resendInvitationMock).toHaveBeenCalledTimes(1);
      expect(listInvitationsMock).toHaveBeenCalledTimes(2);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("resposta antiga nao sobrescreve recarga apos reenvio", async () => {
    const staleRequest = createDeferred<AccountInvitationListResult>();
    const reloadRequest = createDeferred<AccountInvitationListResult>();
    const initialResult = buildBaseResult();
    const staleResult = buildResult(
      { total: 1, totalPages: 1 },
      [
        buildInvitation({
          id: "stale-invitation-id",
          recipientName: "Convite Antigo",
          recipientEmailMasked: "c***o@example.com",
        }),
      ],
    );
    const refreshedResult = buildResult(
      { total: 1, totalPages: 1 },
      [
        buildInvitation({
          id: "fresh-invitation-id",
          recipientName: "Convite Reenviado",
          recipientEmailMasked: "c***o@example.com",
        }),
      ],
    );
    const defaultQuery = {
      sortBy: "createdAt",
      sortOrder: "desc",
      pageSize: 10,
      page: 1,
    };
    const filteredQuery = {
      ...defaultQuery,
      search: "Convite",
    };
    let defaultQueryCalls = 0;

    listInvitationsMock.mockImplementation((query) => {
      if (!query) {
        throw new Error("A consulta da listagem é obrigatória neste teste.");
      }

      if (
        query.sortBy === filteredQuery.sortBy &&
        query.sortOrder === filteredQuery.sortOrder &&
        query.pageSize === filteredQuery.pageSize &&
        query.page === filteredQuery.page &&
        query.search === filteredQuery.search
      ) {
        return reloadRequest.promise;
      }

      if (
        query.sortBy === defaultQuery.sortBy &&
        query.sortOrder === defaultQuery.sortOrder &&
        query.pageSize === defaultQuery.pageSize &&
        query.page === defaultQuery.page &&
        !("search" in query)
      ) {
        defaultQueryCalls += 1;

        if (defaultQueryCalls === 1) {
          return Promise.resolve(initialResult);
        }

        if (defaultQueryCalls === 2) {
          return staleRequest.promise;
        }
      }

      throw new Error(`Chamada inesperada de listAdminAccountInvitations: ${JSON.stringify(query)}`);
    });
    resendInvitationMock.mockResolvedValue(buildResendResult());

    try {
      renderPage();

      expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
      expect(listInvitationsMock).toHaveBeenNthCalledWith(1, defaultQuery);

      fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

      await waitFor(() => {
        expect(resendInvitationMock).toHaveBeenCalledWith("invitation-internal-id-001");
      });
      expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();

      await waitFor(() => {
        expect(listInvitationsMock).toHaveBeenCalledTimes(2);
      });
      expect(listInvitationsMock).toHaveBeenNthCalledWith(2, defaultQuery);

      fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
        target: { value: "Convite" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

      await waitFor(() => {
        expect(listInvitationsMock).toHaveBeenCalledTimes(3);
      });
      expect(listInvitationsMock).toHaveBeenNthCalledWith(3, filteredQuery);

      await act(async () => {
        reloadRequest.resolve(refreshedResult);
        await reloadRequest.promise;
      });

      await waitFor(() => {
        expect(screen.getByText("Convite Reenviado")).toBeInTheDocument();
      });
      expect(screen.queryByText("Convite Antigo")).not.toBeInTheDocument();

      await act(async () => {
        staleRequest.resolve(staleResult);
        await staleRequest.promise;
      });

      await waitFor(() => {
        expect(screen.getByText("Convite Reenviado")).toBeInTheDocument();
        expect(screen.queryByText("Convite Antigo")).not.toBeInTheDocument();
      });
      expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();
    } finally {
      await act(async () => {
        staleRequest.resolve(staleResult);
        reloadRequest.resolve(refreshedResult);
        await Promise.allSettled([staleRequest.promise, reloadRequest.promise]);
      });
    }
  });

  it("somente uma acao sensivel ocorre por vez", async () => {
    const resend = createDeferred<ReturnType<typeof buildResendResult>>();
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
    resendInvitationMock.mockReturnValue(resend.promise);

    renderPage();
    const resendButtons = await screen.findAllByRole("button", { name: "Reenviar convite" });
    fireEvent.click(resendButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    expect(resendInvitationMock).toHaveBeenCalledTimes(1);
    expect(resendButtons[0]).toBeDisabled();
    for (const cancelButton of screen.getAllByRole("button", { name: "Cancelar convite" })) {
      expect(cancelButton).toBeDisabled();
    }

    await act(async () => {
      resend.resolve(buildResendResult());
      await resend.promise;
    });
  });

  it("resposta antiga nao sobrescreve resposta recente", async () => {
    const slowResult = createDeferred<AccountInvitationListResult>();
    const recentInvitation = { ...baseInvitation, id: "recent-invitation", recipientName: "Bruno Lima" };
    listInvitationsMock.mockResolvedValueOnce(baseResult);
    listInvitationsMock.mockReturnValueOnce(slowResult.promise);
    listInvitationsMock.mockResolvedValueOnce(buildResult({ total: 1, totalPages: 1 }, [recentInvitation]));

    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(await screen.findByText("Bruno Lima")).toBeInTheDocument();
    await act(async () => {
      slowResult.resolve(baseResult);
      await slowResult.promise;
    });
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
  });

  it("nao atualiza estado apos desmontar antes da resposta", async () => {
    const deferred = createDeferred<AccountInvitationListResult>();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listInvitationsMock.mockReturnValue(deferred.promise);

    const { unmount } = renderPage();
    unmount();

    await act(async () => {
      deferred.resolve(baseResult);
      await deferred.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
