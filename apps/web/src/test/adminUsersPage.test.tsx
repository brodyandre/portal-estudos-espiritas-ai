import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminUsersList } from "../services/adminUsersListService";
import { ServiceRequestError } from "../services/api";
import {
  baseResult,
  buildResult,
  buildUser,
  createDeferred,
  formatDateForTest,
  renderAppAt,
  renderPage,
  restoreOriginalLocation,
  storeAuthenticatedUser,
} from "./AdminUsersPageTestSupport";

vi.mock("../services/adminUsersListService", () => ({
  listAdminUsersList: vi.fn(),
}));

const listUsersMock = vi.mocked(listAdminUsersList);

describe("AdminUsersPage", () => {
  beforeEach(() => {
    listUsersMock.mockReset();
    listUsersMock.mockResolvedValue(baseResult);
  });

  afterEach(() => {
    cleanup();
    listUsersMock.mockReset();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    restoreOriginalLocation();
  });

  it("renderiza a rota administrativa para admin", async () => {
    storeAuthenticatedUser("admin");
    listUsersMock.mockResolvedValue(baseResult);

    renderAppAt("#/admin/usuarios");

    expect(await screen.findByRole("heading", { level: 1, name: "Gestão de usuários" })).toBeInTheDocument();
    expect(await screen.findByText("Ana Beatriz Moraes")).toBeInTheDocument();
  });

  it("bloqueia acesso de perfil nao administrativo", () => {
    storeAuthenticatedUser("teacher");
    listUsersMock.mockResolvedValue(baseResult);

    renderAppAt("#/admin/usuarios");

    expect(screen.getByRole("heading", { name: "Você não tem acesso a esta área." })).toBeInTheDocument();
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("exibe carregamento inicial", async () => {
    const initialLoad = createDeferred<typeof baseResult>();
    listUsersMock.mockReturnValue(initialLoad.promise);

    renderPage();

    try {
      expect(screen.getByRole("heading", { name: "Carregando usuários" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();

      await waitFor(() => {
        expect(listUsersMock).toHaveBeenCalledTimes(1);
      });
    } finally {
      await act(async () => {
        initialLoad.resolve(baseResult);
        await initialLoad.promise;
      });
    }

    expect(await screen.findByText("Ana Beatriz Moraes")).toBeInTheDocument();
  });

  it("renderiza os campos esperados com e-mail mascarado", async () => {
    listUsersMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText("Ana Beatriz Moraes")).toBeInTheDocument();
    expect(screen.getByText("an***@demo.local")).toBeInTheDocument();
    expect(screen.queryByText("ana.beatriz@example.com")).not.toBeInTheDocument();
    expect(screen.getAllByText("Aluno").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ativado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Emmanuel").length).toBeGreaterThan(0);
    expect(screen.getByText(formatDateForTest(baseResult.items[0].createdAt))).toBeInTheDocument();
  });

  it("renderiza grupo ausente com texto seguro", async () => {
    listUsersMock.mockResolvedValue(
      buildResult({}, [
        buildUser({
          id: "admin-user-002",
          name: "Bruno Lima",
          group: null,
        }),
      ]),
    );

    renderPage();

    expect(await screen.findByText("Sem grupo vinculado")).toBeInTheDocument();
  });

  it("renderiza estado vazio sem filtros aplicados", async () => {
    listUsersMock.mockResolvedValue(
      buildResult(
        {
          total: 0,
          totalPages: 0,
        },
        [],
      ),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Nenhum usuário cadastrado" })).toBeInTheDocument();
    expect(screen.getByText("0 usuários")).toBeInTheDocument();
  });

  it("renderiza estado vazio com filtros aplicados", async () => {
    listUsersMock
      .mockResolvedValueOnce(baseResult)
      .mockResolvedValueOnce(
        buildResult(
          {
            total: 0,
            totalPages: 0,
          },
          [],
        ),
      );

    renderPage();
    await screen.findByText("Ana Beatriz Moraes");
    listUsersMock.mockClear();

    fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
      target: { value: "Inexistente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(await screen.findByRole("heading", { name: "Nenhum usuário encontrado" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Limpar filtros" }).length).toBeGreaterThan(0);
  });

  it("renderiza erro com retry seguro", async () => {
    listUsersMock
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "network",
          message: "backend offline",
        }),
      )
      .mockResolvedValueOnce(baseResult);

    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível conectar ao backend local agora.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ana Beatriz Moraes")).toBeInTheDocument();
  });

  it("exibe indicador explícito de modo demonstrativo", async () => {
    listUsersMock.mockResolvedValue({
      ...baseResult,
      source: "demo",
    });

    renderPage();

    expect(await screen.findByText("Esta visualização usa apenas dados fictícios e não realiza chamadas para a API local.")).toBeInTheDocument();
  });

  it("não exibe ações mutáveis", async () => {
    listUsersMock.mockResolvedValue(baseResult);

    renderPage();

    expect(await screen.findByText("Ana Beatriz Moraes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar usuário/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Inativar usuário/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Redefinir senha/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Observação administrativa/i)).not.toBeInTheDocument();
  });
});
