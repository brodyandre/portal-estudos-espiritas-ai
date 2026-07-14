import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminUsersList } from "../services/adminUsersListService";
import {
  baseResult,
  buildResult,
  changeFilters,
  createWaitForInitialLoad,
  renderPage,
  restoreOriginalLocation,
} from "./AdminUsersPageTestSupport";

vi.mock("../services/adminUsersListService", () => ({
  listAdminUsersList: vi.fn(),
}));

const listUsersMock = vi.mocked(listAdminUsersList);
const waitForInitialLoad = createWaitForInitialLoad(listUsersMock);

describe("AdminUsersPage filters", () => {
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

  it("não consulta automaticamente ao editar filtros", async () => {
    renderPage();
    await waitForInitialLoad();
    changeFilters();

    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("aplicar envia todos os filtros corretos", async () => {
    renderPage();
    await waitForInitialLoad();
    changeFilters();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        search: "Ana",
        role: "teacher",
        status: "inactive",
        activationStatus: "not_activated",
        group: "emmanuel",
        sortBy: "name",
        sortOrder: "asc",
        pageSize: 10,
        page: 1,
      });
    });
  });

  it("enter no formulário aplica filtros", async () => {
    renderPage();
    await waitForInitialLoad();
    fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
      target: { value: "Bruno" },
    });
    fireEvent.submit(screen.getByLabelText("Buscar por nome ou e-mail").closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        search: "Bruno",
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
  });

  it("aplicar volta para página 1", async () => {
    listUsersMock.mockResolvedValueOnce(buildResult({ page: 2, total: 24, totalPages: 3 }));
    listUsersMock.mockResolvedValue(baseResult);

    renderPage();
    await screen.findByText("Página 2 de 3 · 24 usuários");
    listUsersMock.mockClear();

    fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "Ana",
          page: 1,
        }),
      );
    });
  });

  it("limpar restaura os defaults", async () => {
    renderPage();
    await waitForInitialLoad();
    changeFilters();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
    expect(screen.getByLabelText("Buscar por nome ou e-mail")).toHaveValue("");
    expect(screen.getByLabelText("Papel")).toHaveValue("");
    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(screen.getByLabelText("Ativação")).toHaveValue("");
    expect(screen.getByLabelText("Grupo (slug)")).toHaveValue("");
    expect(screen.getByLabelText("Ordenar por")).toHaveValue("createdAt");
    expect(screen.getByLabelText("Direção")).toHaveValue("desc");
  });

  it("limpar estado já limpo não gera consulta duplicada", async () => {
    renderPage();
    await waitForInitialLoad();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("paginação anterior e próxima usam a query aplicada", async () => {
    listUsersMock
      .mockResolvedValueOnce(buildResult({ page: 2, total: 24, totalPages: 3 }))
      .mockResolvedValue(baseResult);

    renderPage();
    await screen.findByText("Página 2 de 3 · 24 usuários");
    listUsersMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });

    listUsersMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 2,
      });
    });
  });

  it("desabilita os limites da paginação", async () => {
    listUsersMock.mockResolvedValue(buildResult({ page: 1, total: 10, totalPages: 1 }));

    renderPage();

    expect(await screen.findByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("corrige página inválida após nova resposta", async () => {
    listUsersMock
      .mockResolvedValueOnce(
        buildResult(
          {
            page: 4,
            total: 12,
            totalPages: 2,
          },
          [],
        ),
      )
      .mockResolvedValueOnce(buildResult({ page: 2, total: 12, totalPages: 2 }));

    renderPage();

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenNthCalledWith(1, {
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenNthCalledWith(2, {
        sortBy: "createdAt",
        sortOrder: "desc",
        pageSize: 10,
        page: 2,
      });
    });
  });
});
