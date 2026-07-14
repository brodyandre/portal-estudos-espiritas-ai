import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
import type { AccountInvitationListResult } from "../types/adminAccountInvitations";
import {
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

  it("reenvio recarrega exatamente a consulta aplicada", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    resendInvitationMock.mockResolvedValue(buildResendResult());

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
    fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

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

  it("rascunhos nao aplicados nao entram na recarga apos reenvio", async () => {
    const initialResult = buildBaseResult();
    const refreshedBase = buildBaseResult();
    const refreshedRecipientName = "Ana Beatriz Recarregada";
    const refreshedResult: AccountInvitationListResult = {
      ...refreshedBase,
      items: refreshedBase.items.map((invitation, index) =>
        index === 0
          ? {
              ...invitation,
              recipientName: refreshedRecipientName,
            }
          : invitation,
      ),
    };

    listInvitationsMock.mockResolvedValueOnce(initialResult);
    resendInvitationMock.mockResolvedValue(buildResendResult());

    renderPage();
    await waitForInitialLoad();
    expect(listInvitationsMock).not.toHaveBeenCalled();
    listInvitationsMock.mockResolvedValue(refreshedResult);

    fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
      target: { value: "Nao aplicado" },
    });
    expect(screen.getByLabelText("Buscar por destinatário")).toHaveValue("Nao aplicado");
    expect(listInvitationsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

    await waitFor(() => {
      expect(resendInvitationMock).toHaveBeenCalledTimes(1);
    });
    expect(resendInvitationMock).toHaveBeenCalledWith("invitation-internal-id-001");

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledTimes(1);
    });

    const reloadCall = listInvitationsMock.mock.calls[0];
    expect(reloadCall).toBeDefined();
    if (!reloadCall) {
      throw new Error("A recarga pós-reenvio não foi registrada.");
    }

    const reloadQuery = reloadCall[0];
    if (!reloadQuery) {
      throw new Error("A query da recarga pós-reenvio não foi registrada.");
    }

    expect(reloadQuery).toEqual({
      sortBy: "createdAt",
      sortOrder: "desc",
      pageSize: 10,
      page: 1,
    });
    expect(reloadQuery).not.toEqual(
      expect.objectContaining({
        search: "Nao aplicado",
      }),
    );
    expect(reloadQuery.search).toBeUndefined();

    const refreshedCard = screen.getByText(refreshedRecipientName).closest(".admin-user-card");
    expect(refreshedCard).not.toBeNull();
    expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();

    expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Confirmar reenvio" }),
      ).not.toBeInTheDocument();
    });
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Buscar por destinatário")).toHaveValue("Nao aplicado");
  });

  it("reenvio nao atualiza item otimisticamente antes da recarga", async () => {
    const initialResult = buildBaseResult();
    const refreshedResult = buildResult(
      {},
      [buildInvitation({ invitationType: "admin_reinvite" })],
    );
    const reloadRequest = createDeferred<AccountInvitationListResult>();
    let listCall = 0;

    listInvitationsMock.mockImplementation(() => {
      listCall += 1;

      if (listCall === 1) {
        return Promise.resolve(initialResult);
      }

      if (listCall === 2) {
        return reloadRequest.promise;
      }

      throw new Error("Chamada inesperada de listagem no teste de atualização otimista.");
    });
    resendInvitationMock.mockResolvedValue(buildResendResult());

    try {
      renderPage();
      await waitForInitialLoad();

      const invitationCard = screen.getByText("Ana Beatriz").closest(".admin-user-card");
      expect(invitationCard).not.toBeNull();

      expect(within(invitationCard as HTMLElement).getAllByText("Aprovação de inscrição").length).toBeGreaterThan(0);
      expect(
        within(invitationCard as HTMLElement).queryByText("Reconvite administrativo"),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirmar reenvio" }));

      await waitFor(() => {
        expect(resendInvitationMock).toHaveBeenCalledWith("invitation-internal-id-001");
      });

      expect(await screen.findByText("Convite reenviado com sucesso.")).toBeInTheDocument();
      expect(
        screen.queryByRole("dialog", { name: /Reenviar convite para Ana Beatriz/i }),
      ).not.toBeInTheDocument();

      await waitFor(() => {
        expect(listInvitationsMock).toHaveBeenCalledTimes(1);
      });

      expect(within(invitationCard as HTMLElement).getAllByText("Aprovação de inscrição").length).toBeGreaterThan(0);
      expect(
        within(invitationCard as HTMLElement).queryByText("Reconvite administrativo"),
      ).not.toBeInTheDocument();

      await act(async () => {
        reloadRequest.resolve(refreshedResult);
        await reloadRequest.promise;
      });

      const refreshedCard = screen.getByText("Ana Beatriz").closest(".admin-user-card");
      expect(refreshedCard).not.toBeNull();

      await waitFor(() => {
        expect(
          within(refreshedCard as HTMLElement).getAllByText("Reconvite administrativo").length,
        ).toBeGreaterThan(0);
      });
      expect(
        within(refreshedCard as HTMLElement).queryByText("Aprovação de inscrição"),
      ).not.toBeInTheDocument();
    } finally {
      reloadRequest.resolve(refreshedResult);
      await Promise.allSettled([reloadRequest.promise]);
    }
  });
});
