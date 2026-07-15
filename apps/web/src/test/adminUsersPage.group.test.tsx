import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminSelectableGroups } from "../services/adminGroupsService";
import { ServiceRequestError } from "../services/api";
import { updateAdminUserGroup } from "../services/adminUserGroupService";
import { listAdminUsersList } from "../services/adminUsersListService";
import { updateAdminUserStatus } from "../services/adminUserStatusService";
import type { AdminSelectableGroup } from "../types/adminGroups";
import {
  baseResult,
  buildResult,
  buildUser,
  changeFilters,
  createDeferred,
  createWaitForInitialLoad,
  renderPage,
  restoreOriginalLocation,
} from "./AdminUsersPageTestSupport";

vi.mock("../services/adminUsersListService", () => ({
  listAdminUsersList: vi.fn(),
}));

vi.mock("../services/adminGroupsService", () => ({
  listAdminSelectableGroups: vi.fn(),
}));

vi.mock("../services/adminUserGroupService", () => ({
  updateAdminUserGroup: vi.fn(),
}));

vi.mock("../services/adminUserStatusService", () => ({
  updateAdminUserStatus: vi.fn(),
}));

const listUsersMock = vi.mocked(listAdminUsersList);
const listGroupsMock = vi.mocked(listAdminSelectableGroups);
const updateUserGroupMock = vi.mocked(updateAdminUserGroup);
const updateStatusMock = vi.mocked(updateAdminUserStatus);

const activeGroups: AdminSelectableGroup[] = [
  { name: "Emmanuel", slug: "emmanuel", status: "active" },
  { name: "A Caminho da Luz", slug: "a-caminho-da-luz", status: "active" },
];

const usersWithAndWithoutGroup = buildResult({}, [
  buildUser({
    id: "user-with-group",
    name: "Ana Beatriz Moraes",
    group: {
      name: "Emmanuel",
      slug: "emmanuel",
    },
  }),
  buildUser({
    id: "user-without-group",
    name: "Bruno Lima",
    group: null,
    emailMasked: "br***@demo.local",
  }),
]);

const openGroupDialog = async (name = "Ana Beatriz Moraes") => {
  const button = await screen.findByRole("button", { name: `Alterar grupo de ${name}` });
  await act(async () => {
    fireEvent.click(button);
  });
  await screen.findByRole("dialog", { name: "Alterar grupo do usuário" });
  return button;
};

describe("AdminUsersPage group actions", () => {
  beforeEach(() => {
    listUsersMock.mockReset();
    listGroupsMock.mockReset();
    updateUserGroupMock.mockReset();
    updateStatusMock.mockReset();
    listUsersMock.mockResolvedValue(usersWithAndWithoutGroup);
    listGroupsMock.mockResolvedValue({
      items: activeGroups,
      source: "api",
    });
    updateUserGroupMock.mockResolvedValue({
      user: {
        id: "user-with-group",
        group: {
          name: "A Caminho da Luz",
          slug: "a-caminho-da-luz",
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    listUsersMock.mockReset();
    listGroupsMock.mockReset();
    updateUserGroupMock.mockReset();
    updateStatusMock.mockReset();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    restoreOriginalLocation();
  });

  it("renderiza o grupo atual e o botão Alterar grupo com nome acessível", async () => {
    renderPage();

    expect(await screen.findByText("Ana Beatriz Moraes")).toBeInTheDocument();
    expect(screen.getByText("Emmanuel")).toBeInTheDocument();
    expect(screen.getByText("Sem grupo vinculado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Alterar grupo de Ana Beatriz Moraes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alterar grupo de Bruno Lima" })).toBeInTheDocument();
  });

  it("abre o dialog do usuário correto, carrega grupos e foca o select", async () => {
    const deferredGroups = createDeferred<Awaited<ReturnType<typeof listAdminSelectableGroups>>>();
    listGroupsMock.mockReturnValue(deferredGroups.promise);

    renderPage();
    const trigger = await openGroupDialog();

    expect(screen.getByRole("dialog", { name: "Alterar grupo do usuário" })).toBeInTheDocument();
    expect(screen.getByText(/Selecione o grupo de estudo de Ana Beatriz Moraes/i)).toBeInTheDocument();
    expect(screen.getByText(/Grupo atual:/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carregando grupos" })).toBeInTheDocument();
    expect(listGroupsMock).toHaveBeenCalledWith("active");

    await act(async () => {
      deferredGroups.resolve({
        items: activeGroups,
        source: "api",
      });
      await deferredGroups.promise;
    });

    const select = await screen.findByLabelText("Grupo");
    expect(select).toHaveFocus();
    expect(trigger).not.toHaveFocus();
  });

  it("permite tentar carregar grupos novamente após erro", async () => {
    listGroupsMock
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "network",
          message: "offline",
        }),
      )
      .mockResolvedValueOnce({
        items: activeGroups,
        source: "api",
      });

    renderPage();
    await openGroupDialog();

    expect(
      await screen.findByText(
        "Não foi possível carregar os grupos agora. Verifique a API local e tente novamente.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar carregar grupos" }));

    expect(await screen.findByLabelText("Grupo")).toBeInTheDocument();
    expect(listGroupsMock).toHaveBeenCalledTimes(2);
  });

  it("limpa erro local e seleção antiga ao reabrir o dialog para outro usuário", async () => {
    updateUserGroupMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code: "ADMIN_USER_GROUP_INACTIVE",
        message: "grupo inativo",
      }),
    );

    renderPage();
    await openGroupDialog();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(
      await screen.findByText(
        "Este grupo ficou inativo e não pode ser vinculado. Escolha outro grupo.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await openGroupDialog("Bruno Lima");

    expect(await screen.findByLabelText("Grupo")).toHaveValue("__without_group__");
    expect(
      screen.queryByText(
        "Este grupo ficou inativo e não pode ser vinculado. Escolha outro grupo.",
      ),
    ).not.toBeInTheDocument();
  });

  it("seleciona o grupo atual e desabilita confirmação sem mudança", async () => {
    renderPage();
    await openGroupDialog();

    const select = await screen.findByLabelText("Grupo");
    const confirmButton = screen.getByRole("button", { name: "Salvar alteração" });

    expect(select).toHaveValue("emmanuel");
    expect(confirmButton).toBeDisabled();
  });

  it("seleciona Sem grupo para usuário sem vínculo", async () => {
    renderPage();
    await openGroupDialog("Bruno Lima");

    expect(await screen.findByLabelText("Grupo")).toHaveValue("__without_group__");
    expect(screen.getByRole("button", { name: "Salvar alteração" })).toBeDisabled();
  });

  it("associa grupo para usuário sem vínculo, preserva filtros e recarrega a listagem", async () => {
    listUsersMock
      .mockResolvedValueOnce(baseResult)
      .mockResolvedValueOnce(
        buildResult(
          {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          },
          [
            buildUser({
              id: "user-without-group",
              name: "Bruno Lima",
              group: null,
              emailMasked: "br***@demo.local",
            }),
          ],
        ),
      )
      .mockResolvedValueOnce(
        buildResult(
          {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          },
          [
            buildUser({
              id: "user-without-group",
              name: "Bruno Lima",
              group: {
                name: "A Caminho da Luz",
                slug: "a-caminho-da-luz",
              },
              emailMasked: "br***@demo.local",
            }),
          ],
        ),
      );

    renderPage();
    const waitForInitialLoad = createWaitForInitialLoad(listUsersMock);
    await waitForInitialLoad();

    changeFilters();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(await screen.findByText("Bruno Lima")).toBeInTheDocument();
    listUsersMock.mockClear();

    await openGroupDialog("Bruno Lima");

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vincular grupo" }));

    await waitFor(() => {
      expect(updateUserGroupMock).toHaveBeenCalledWith("user-without-group", {
        groupSlug: "a-caminho-da-luz",
      });
    });

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        activationStatus: "not_activated",
        group: "emmanuel",
        page: 1,
        pageSize: 10,
        role: "teacher",
        search: "Ana",
        sortBy: "name",
        sortOrder: "asc",
        status: "inactive",
      });
    });

    expect(await screen.findByText("Grupo do usuário atualizado com sucesso.")).toBeInTheDocument();
  });

  it("substitui o grupo atual por outro grupo ativo", async () => {
    listUsersMock
      .mockResolvedValueOnce(usersWithAndWithoutGroup)
      .mockResolvedValueOnce(
        buildResult({}, [
          buildUser({
            id: "user-with-group",
            name: "Ana Beatriz Moraes",
            group: {
              name: "A Caminho da Luz",
              slug: "a-caminho-da-luz",
            },
          }),
        ]),
      );

    renderPage();
    await openGroupDialog();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    await waitFor(() => {
      expect(updateUserGroupMock).toHaveBeenCalledWith("user-with-group", {
        groupSlug: "a-caminho-da-luz",
      });
    });
  });

  it("remove o vínculo enviando groupSlug null e mantém o texto claro no dialog", async () => {
    renderPage();
    await openGroupDialog();

    expect(
      screen.getByText(
        "Remover o vínculo não exclui o usuário, não exclui o grupo e não altera o status da conta.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "__without_group__" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remover vínculo" }));

    await waitFor(() => {
      expect(updateUserGroupMock).toHaveBeenCalledWith("user-with-group", {
        groupSlug: null,
      });
    });
  });

  it("mantém o dialog aberto quando o grupo atual não está mais ativo e permite remover o vínculo", async () => {
    listUsersMock.mockResolvedValue(
      buildResult({}, [
        buildUser({
          id: "user-inactive-group",
          name: "Clara Moura",
          group: {
            name: "Grupo Antigo",
            slug: "grupo-antigo",
          },
        }),
      ]),
    );

    renderPage();
    await openGroupDialog("Clara Moura");

    expect(await screen.findByText("Grupo atual indisponível")).toBeInTheDocument();
    expect(screen.getByLabelText("Grupo")).toHaveValue("__without_group__");
    expect(screen.getByRole("button", { name: "Remover vínculo" })).toBeEnabled();
  });

  it.each([
    ["AUTH_REQUIRED", "Sua sessão expirou. Faça login novamente."],
    ["FORBIDDEN", "Seu perfil não pode alterar grupos de usuários."],
    ["PASSWORD_CHANGE_REQUIRED", "Troque sua senha temporária antes de continuar."],
    [
      "ADMIN_USER_GROUP_ACTOR_NOT_AUTHORIZED",
      "Seu perfil não pode alterar o grupo deste usuário.",
    ],
  ])("fecha o dialog e mostra erro global para %s", async (code, message) => {
    updateUserGroupMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code,
        message: "erro",
      }),
    );

    renderPage();
    await openGroupDialog();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Alterar grupo do usuário" })).not.toBeInTheDocument();
  });

  it("fecha o dialog e recarrega a lista quando o usuário não é encontrado", async () => {
    updateUserGroupMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code: "ADMIN_USER_NOT_FOUND",
        message: "nao encontrado",
      }),
    );

    renderPage();
    await openGroupDialog();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(await screen.findByText("O usuário não foi encontrado. Atualize a listagem.")).toBeInTheDocument();
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(2);
    });
  });

  it.each([
    ["ADMIN_USER_GROUP_NOT_FOUND", "O grupo não está mais disponível. Atualize a lista de grupos e tente novamente."],
    ["ADMIN_USER_GROUP_INACTIVE", "Este grupo ficou inativo e não pode ser vinculado. Escolha outro grupo."],
    ["INVALID_ADMIN_USER_GROUP_INPUT", "A seleção de grupo é inválida. Atualize os dados e tente novamente."],
  ])("mantém o dialog aberto e recarrega grupos para %s", async (code, message) => {
    updateUserGroupMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code,
        message: "erro",
      }),
    );

    renderPage();
    await openGroupDialog();
    listGroupsMock.mockClear();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(await screen.findAllByText(message)).not.toHaveLength(0);
    expect(screen.getByRole("dialog", { name: "Alterar grupo do usuário" })).toBeInTheDocument();
    await waitFor(() => {
      expect(listGroupsMock).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["ADMIN_USER_GROUP_ALREADY_SET", "O usuário já está vinculado a esse grupo. A listagem será atualizada."],
    ["ADMIN_USER_GROUP_ALREADY_EMPTY", "O usuário já está sem grupo. A listagem será atualizada."],
  ])("fecha o dialog e recarrega a listagem para %s", async (code, message) => {
    updateUserGroupMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code,
        message: "erro",
      }),
    );

    renderPage();
    await openGroupDialog();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(2);
    });
  });

  it("recarrega usuários e grupos em caso de conflito", async () => {
    updateUserGroupMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code: "ADMIN_USER_GROUP_CONFLICT",
        message: "conflito",
      }),
    );

    renderPage();
    await openGroupDialog();
    listUsersMock.mockClear();
    listGroupsMock.mockClear();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(
      await screen.findByText(
        "O vínculo foi alterado por outra operação. Atualize os dados e tente novamente.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(1);
      expect(listGroupsMock).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["ADMIN_USER_GROUP_RATE_LIMITED", "Muitas alterações foram solicitadas. Aguarde e tente novamente."],
    [
      "ADMIN_USER_GROUP_UNAVAILABLE_IN_DEMO",
      "A alteração de grupo não está disponível no modo de demonstração.",
    ],
    [undefined, "Não foi possível alterar o grupo do usuário. Tente novamente."],
  ])("mantém o dialog aberto para erro local %s", async (code, message) => {
    updateUserGroupMock.mockRejectedValueOnce(
      new ServiceRequestError({
        kind: "api",
        code,
        message: "erro",
      }),
    );

    renderPage();
    await openGroupDialog();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Alterar grupo do usuário" })).toBeInTheDocument();
  });

  it("permite cancelar e fechar com Escape, devolvendo o foco ao botão de origem", async () => {
    renderPage();
    const trigger = await openGroupDialog();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Alterar grupo do usuário" })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Alterar grupo do usuário" })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("desabilita controles durante o envio e evita envio duplicado", async () => {
    const mutation = createDeferred<Awaited<ReturnType<typeof updateAdminUserGroup>>>();
    updateUserGroupMock.mockReturnValue(mutation.promise);

    renderPage();
    await openGroupDialog();

    fireEvent.change(await screen.findByLabelText("Grupo"), {
      target: { value: "a-caminho-da-luz" },
    });

    const confirmButton = screen.getByRole("button", { name: "Salvar alteração" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(await screen.findByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.getByLabelText("Grupo")).toBeDisabled();
    expect(updateUserGroupMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      mutation.resolve({
        user: {
          id: "user-with-group",
          group: {
            name: "A Caminho da Luz",
            slug: "a-caminho-da-luz",
          },
        },
      });
      await mutation.promise;
    });
  });

  it("mantém a ação de status disponível para usuários ativos e inativos", async () => {
    listUsersMock.mockResolvedValue(
      buildResult({}, [
        buildUser({
          id: "active-user",
          name: "Ana Ativa",
          status: "active",
        }),
        buildUser({
          id: "inactive-user",
          name: "Bruno Inativo",
          status: "inactive",
        }),
      ]),
    );

    renderPage();

    const anaActions = within(await screen.findByLabelText("Ações para Ana Ativa"));
    const brunoActions = within(screen.getByLabelText("Ações para Bruno Inativo"));

    expect(anaActions.getByRole("button", { name: "Inativar usuário Ana Ativa" })).toBeInTheDocument();
    expect(anaActions.getByRole("button", { name: "Alterar grupo de Ana Ativa" })).toBeInTheDocument();
    expect(brunoActions.getByRole("button", { name: "Ativar usuário Bruno Inativo" })).toBeInTheDocument();
    expect(brunoActions.getByRole("button", { name: "Alterar grupo de Bruno Inativo" })).toBeInTheDocument();
  });
});
