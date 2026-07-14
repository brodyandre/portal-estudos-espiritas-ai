import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminUsersList } from "../services/adminUsersListService";
import { updateAdminUserStatus } from "../services/adminUserStatusService";
import { ServiceRequestError } from "../services/api";
import {
  baseResult,
  buildResult,
  buildUser,
  createDeferred,
  renderPage,
  restoreOriginalLocation,
  storeAuthenticatedUser,
} from "./AdminUsersPageTestSupport";

vi.mock("../services/adminUsersListService", () => ({
  listAdminUsersList: vi.fn(),
}));

vi.mock("../services/adminUserStatusService", () => ({
  updateAdminUserStatus: vi.fn(),
}));

const listUsersMock = vi.mocked(listAdminUsersList);
const updateStatusMock = vi.mocked(updateAdminUserStatus);

const activeUser = buildUser({
  id: "active-user",
  name: "Ana Ativa",
  status: "active",
});

const inactiveUser = buildUser({
  id: "inactive-user",
  name: "Bruno Inativo",
  status: "inactive",
});

const pendingUser = buildUser({
  id: "pending-user",
  name: "Carla Pendente",
  status: "pending",
});

const rejectedUser = buildUser({
  id: "rejected-user",
  name: "Diego Recusado",
  status: "rejected",
});

const statusResult = buildResult({}, [
  activeUser,
  inactiveUser,
  pendingUser,
  rejectedUser,
]);

const getActionsFor = (name: string) => within(screen.getByLabelText(`Ações para ${name}`));

describe("AdminUsersPage status actions", () => {
  beforeEach(() => {
    listUsersMock.mockReset();
    updateStatusMock.mockReset();
    listUsersMock.mockResolvedValue(statusResult);
    updateStatusMock.mockResolvedValue({
      user: {
        id: "active-user",
        status: "inactive",
      },
      revokedSessions: 0,
    });
  });

  afterEach(() => {
    cleanup();
    listUsersMock.mockReset();
    updateStatusMock.mockReset();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    restoreOriginalLocation();
  });

  it("mostra Inativar para active, Ativar para inactive e nenhuma ação clicável para pending/rejected", async () => {
    renderPage();

    expect(await screen.findByText("Ana Ativa")).toBeInTheDocument();
    expect(getActionsFor("Ana Ativa").getByRole("button", { name: "Inativar usuário Ana Ativa" })).toBeInTheDocument();
    expect(getActionsFor("Bruno Inativo").getByRole("button", { name: "Ativar usuário Bruno Inativo" })).toBeInTheDocument();
    expect(getActionsFor("Carla Pendente").queryByRole("button")).not.toBeInTheDocument();
    expect(getActionsFor("Diego Recusado").queryByRole("button")).not.toBeInTheDocument();
    expect(getActionsFor("Carla Pendente").getByText("Sem ação de status disponível.")).toBeInTheDocument();
    expect(getActionsFor("Diego Recusado").getByText("Sem ação de status disponível.")).toBeInTheDocument();
  });

  it("abre modal de inativação com aviso de revogação de sessões", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" }));

    expect(screen.getByRole("dialog", { name: "Inativar Ana Ativa?" })).toBeInTheDocument();
    expect(screen.getByText(/As sessões atuais do usuário serão revogadas/i)).toBeInTheDocument();
    expect(screen.getByText(/precisará autenticar-se novamente/i)).toBeInTheDocument();
    expect(screen.getByText(/tokens antigos permanecerão inválidos/i)).toBeInTheDocument();
  });

  it("abre modal de ativação", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Ativar usuário Bruno Inativo" }));

    expect(screen.getByRole("dialog", { name: "Ativar Bruno Inativo?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ativação" })).toBeInTheDocument();
  });

  it("cancelamento fecha modal sem chamar a API", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Inativar Ana Ativa?" })).not.toBeInTheDocument();
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("confirmação chama o endpoint com contrato correto", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));

    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledWith("active-user", "inactive");
    });
  });

  it("loading desabilita nova submissão e clique repetido não duplica requisição", async () => {
    const statusChange = createDeferred<Awaited<ReturnType<typeof updateAdminUserStatus>>>();
    updateStatusMock.mockReturnValue(statusChange.promise);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" }));
    const confirmButton = screen.getByRole("button", { name: "Confirmar inativação" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(await screen.findByRole("button", { name: "Inativando..." })).toBeDisabled();
    expect(updateStatusMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      statusChange.resolve({
        user: {
          id: "active-user",
          status: "inactive",
        },
        revokedSessions: 0,
      });
      await statusChange.promise;
    });
  });

  it("não faz atualização otimista e sucesso recarrega a listagem", async () => {
    const statusChange = createDeferred<Awaited<ReturnType<typeof updateAdminUserStatus>>>();
    updateStatusMock.mockReturnValue(statusChange.promise);
    listUsersMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText("Ana Beatriz Moraes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inativar usuário Ana Beatriz Moraes" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));

    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
    expect(listUsersMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      statusChange.resolve({
        user: {
          id: baseResult.items[0].id,
          status: "inactive",
        },
        revokedSessions: 0,
      });
      await statusChange.promise;
    });

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("Usuário inativado com sucesso.")).toBeInTheDocument();
  });

  it("erro mantém a listagem inalterada e permite nova tentativa", async () => {
    updateStatusMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code: "ADMIN_USER_STATUS_CONFLICT",
        message: "conflito",
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));

    expect(await screen.findByText("O estado do usuário mudou durante a operação. Atualize a lista e tente novamente.")).toBeInTheDocument();
    expect(screen.getByText("Ana Ativa")).toBeInTheDocument();
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Confirmar inativação" })).toBeEnabled();
    expect(listUsersMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["AUTH_REQUIRED", "Sua sessão local expirou. Faça login novamente para alterar status."],
    ["FORBIDDEN", "Seu perfil não pode alterar o status administrativo deste usuário."],
    ["ADMIN_USER_STATUS_ACTOR_NOT_AUTHORIZED", "Seu perfil não pode alterar o status administrativo deste usuário."],
    ["PASSWORD_CHANGE_REQUIRED", "Troque sua senha temporária antes de alterar status administrativos."],
    ["INVALID_ADMIN_USER_STATUS_INPUT", "A solicitação de alteração de status está inválida. Atualize a lista e tente novamente."],
    ["ADMIN_USER_NOT_FOUND", "Usuário não encontrado. Atualize a lista para consultar o estado atual."],
    ["ADMIN_USER_STATUS_ALREADY_SET", "O usuário já está com este status. Atualize a lista para consultar o estado atual."],
    ["ADMIN_USER_STATUS_TRANSITION_NOT_ALLOWED", "Esta transição de status não é permitida para a conta selecionada."],
    ["ADMIN_USER_ACCOUNT_NOT_ACTIVATED", "Esta transição de status não é permitida para a conta selecionada."],
    ["ADMIN_USER_STATUS_CONFLICT", "O estado do usuário mudou durante a operação. Atualize a lista e tente novamente."],
    ["ADMIN_USER_SELF_DEACTIVATION_NOT_ALLOWED", "Você não pode inativar a própria conta administrativa."],
  ])("mapeia código de erro %s", async (code, message) => {
    updateStatusMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code,
        message: "erro estruturado",
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("mapeia rate limit e falha de rede", async () => {
    updateStatusMock
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "api",
          code: "ADMIN_USER_STATUS_RATE_LIMITED",
          message: "limite",
          retryAfterSeconds: 65,
        }),
      )
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "network",
          message: "offline",
        }),
      );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));
    expect(await screen.findByText("Muitas tentativas de alteração de status. Tente novamente em cerca de 2 minutos.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));
    expect(await screen.findByText("Não foi possível conectar ao backend local agora. Verifique a API e tente novamente.")).toBeInTheDocument();
  });

  it("protege autoinativação quando o usuário atual é identificável", async () => {
    storeAuthenticatedUser("admin", { id: "active-user" });

    renderPage();

    const button = await screen.findByRole("button", { name: "Inativar usuário Ana Ativa" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Você não pode inativar a própria conta administrativa.")).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByRole("dialog", { name: "Inativar Ana Ativa?" })).not.toBeInTheDocument();
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("modo demonstrativo não permite nem dispara mutação", async () => {
    listUsersMock.mockResolvedValue(buildResult({}, [activeUser], "demo"));

    renderPage();

    expect(await screen.findByText("Ana Ativa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar usuário Ana Ativa" })).not.toBeInTheDocument();
    expect(screen.getByText("Alteração indisponível no modo demonstrativo.")).toBeInTheDocument();
    expect(updateStatusMock).not.toHaveBeenCalled();
  });
});
