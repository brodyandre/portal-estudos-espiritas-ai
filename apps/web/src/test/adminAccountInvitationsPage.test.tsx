import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
import { adminSidebarConfig } from "../app/navigation";
import { ServiceRequestError } from "../services/api";
import type { AccountInvitationListItem, AccountInvitationListResult } from "../types/adminAccountInvitations";
import {
  baseInvitation,
  baseResult,
  buildBaseResult,
  buildResendResult,
  createDeferred,
  formatDateForTest,
  renderAppAt,
  renderPage,
  restoreOriginalLocation,
  storeAuthenticatedUser,
} from "./AdminAccountInvitationsPageTestSupport";

vi.mock("../services/adminAccountInvitationsService", () => ({
  cancelAdminAccountInvitation: vi.fn(),
  listAdminAccountInvitations: vi.fn(),
  resendAdminAccountInvitation: vi.fn(),
}));

const cancelInvitationMock = vi.mocked(cancelAdminAccountInvitation);
const listInvitationsMock = vi.mocked(listAdminAccountInvitations);
const resendInvitationMock = vi.mocked(resendAdminAccountInvitation);

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

  it("renderiza a rota administrativa de convites para admin", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    storeAuthenticatedUser("admin");

    renderAppAt("#/admin/convites");

    expect(await screen.findByRole("heading", { level: 1, name: "Convites de acesso" })).toBeInTheDocument();
    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
  });

  it("bloqueia acesso de perfil nao administrativo", () => {
    listInvitationsMock.mockResolvedValue(baseResult);
    storeAuthenticatedUser("teacher");

    renderAppAt("#/admin/convites");

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área." })).toBeInTheDocument();
    expect(listInvitationsMock).not.toHaveBeenCalled();
  });

  it("inclui o item de navegacao administrativa para convites", () => {
    expect(adminSidebarConfig.items).toContainEqual(
      expect.objectContaining({
        type: "route",
        to: "/admin/convites",
        label: "Convites de acesso",
      }),
    );
  });

  it("exibe carregamento inicial", async () => {
    const initialLoad = createDeferred<AccountInvitationListResult>();
    listInvitationsMock.mockReturnValue(initialLoad.promise);

    renderPage();

    try {
      expect(screen.getByRole("heading", { name: "Carregando convites" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();

      await waitFor(() => {
        expect(listInvitationsMock).toHaveBeenCalledTimes(1);
      });
    } finally {
      await act(async () => {
        initialLoad.resolve(buildBaseResult());
        await initialLoad.promise;
      });
    }

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Carregando convites" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Ana Beatriz")).toBeInTheDocument();
  });

  it("faz a chamada inicial com a paginacao e ordenacao esperadas", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    await waitFor(() => {
      expect(listInvitationsMock).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    });
  });

  it("renderiza o nome do destinatario", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
  });

  it("renderiza somente o e-mail mascarado", async () => {
    listInvitationsMock.mockResolvedValue({
      ...baseResult,
      items: [
        {
          ...baseInvitation,
          recipientEmail: "ana.beatriz@example.com",
        } as unknown as AccountInvitationListItem,
      ],
    });

    renderPage();

    expect(await screen.findByText("a***z@example.com")).toBeInTheDocument();
    expect(screen.queryByText("ana.beatriz@example.com")).not.toBeInTheDocument();
  });

  it("renderiza rotulos de tipo, entrega e ciclo de vida", async () => {
    listInvitationsMock.mockResolvedValue({
      ...baseResult,
      items: [
        baseInvitation,
        {
          ...baseInvitation,
          id: "invitation-internal-id-002",
          recipientName: "Bruno Lima",
          recipientEmailMasked: "b***a@example.com",
          invitationType: "admin_reinvite",
          deliveryStatus: "not_configured",
          lifecycleStatus: "accepted",
        },
      ],
    });

    renderPage();

    expect((await screen.findAllByText("Aprovação de inscrição")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enviado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aguardando aceite").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reconvite administrativo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("E-mail não configurado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aceito").length).toBeGreaterThan(0);
  });

  it("renderiza datas formatadas em pt-BR", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText(formatDateForTest(baseInvitation.createdAt))).toBeInTheDocument();
    expect(screen.getByText(formatDateForTest(baseInvitation.expiresAt))).toBeInTheDocument();
  });

  it("renderiza o resumo de paginacao vindo do meta", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText("Página 1 de 3 · 24 convites")).toBeInTheDocument();
  });

  it("nao exibe pagina 1 de 0 quando nao ha convites", async () => {
    listInvitationsMock.mockResolvedValue({
      items: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      },
    });

    renderPage();

    expect(await screen.findByText("0 convites")).toBeInTheDocument();
    expect(screen.queryByText(/Página 1 de 0/u)).not.toBeInTheDocument();
  });

  it("renderiza estado vazio", async () => {
    listInvitationsMock.mockResolvedValue({
      items: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      },
    });

    renderPage();

    expect(await screen.findByText("0 convites")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nenhum convite encontrado" })).toBeInTheDocument();
  });

  it("usa singular quando ha um convite", async () => {
    listInvitationsMock.mockResolvedValue({
      items: [baseInvitation],
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });

    renderPage();

    expect(await screen.findByText("Página 1 de 1 · 1 convite")).toBeInTheDocument();
  });

  it("mantem plural quando ha mais de um convite", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText("Página 1 de 3 · 24 convites")).toBeInTheDocument();
  });

  it("nao exibe o id interno do convite", async () => {
    listInvitationsMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
    expect(screen.queryByText("invitation-internal-id-001")).not.toBeInTheDocument();
  });

  it("nao exibe propriedades sensiveis excedentes do mock", async () => {
    listInvitationsMock.mockResolvedValue({
      ...baseResult,
      items: [
        {
          ...baseInvitation,
          token: "raw-token-value",
          tokenHash: "token-hash-value",
          rawToken: "raw-token-value",
          activationUrl: "https://example.com/ativar?token=raw-token-value",
          userId: "user-id-value",
          invitedByUserId: "inviter-id-value",
          jwt: "jwt-value",
          smtp: "smtp-value",
          ip: "127.0.0.1",
        } as unknown as AccountInvitationListItem,
      ],
    });

    renderPage();

    expect(await screen.findByText("Ana Beatriz")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("raw-token-value");
    expect(document.body).not.toHaveTextContent("token-hash-value");
    expect(document.body).not.toHaveTextContent("https://example.com/ativar");
    expect(document.body).not.toHaveTextContent("user-id-value");
    expect(document.body).not.toHaveTextContent("inviter-id-value");
    expect(document.body).not.toHaveTextContent("jwt-value");
    expect(document.body).not.toHaveTextContent("smtp-value");
    expect(document.body).not.toHaveTextContent("127.0.0.1");
  });

  it("nao faz nova chamada automatica apos erro", async () => {
    listInvitationsMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        message: "Falha controlada.",
      }),
    );

    renderPage();

    expect(await screen.findByText("Falha controlada.")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  });
});
