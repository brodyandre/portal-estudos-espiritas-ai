import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminUsersList } from "../services/adminUsersListService";
import { ServiceRequestError } from "../services/api";
import type { AdminUsersListResult } from "../types/adminUsersList";
import {
  baseResult,
  buildResult,
  buildUser,
  createDeferred,
  renderPage,
  restoreOriginalLocation,
} from "./AdminUsersPageTestSupport";

vi.mock("../services/adminUsersListService", () => ({
  listAdminUsersList: vi.fn(),
}));

const listUsersMock = vi.mocked(listAdminUsersList);

describe("AdminUsersPage concurrency", () => {
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

  it("resposta antiga não substitui a mais recente", async () => {
    const staleRequest = createDeferred<AdminUsersListResult>();
    const freshRequest = createDeferred<AdminUsersListResult>();

    listUsersMock
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(freshRequest.promise);

    renderPage();

    fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
      target: { value: "Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await act(async () => {
      freshRequest.resolve(
        buildResult({}, [buildUser({ id: "admin-user-002", name: "Bruno Lima" })]),
      );
      await freshRequest.promise;
    });

    expect(await screen.findByText("Bruno Lima")).toBeInTheDocument();

    await act(async () => {
      staleRequest.resolve(
        buildResult({}, [buildUser({ id: "admin-user-003", name: "Convite Antigo" })]),
      );
      await staleRequest.promise;
    });

    expect(screen.queryByText("Convite Antigo")).not.toBeInTheDocument();
  });

  it("erro antigo não substitui sucesso recente", async () => {
    const staleRequest = createDeferred<AdminUsersListResult>();
    const freshRequest = createDeferred<AdminUsersListResult>();

    listUsersMock
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(freshRequest.promise);

    renderPage();

    fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
      target: { value: "Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await act(async () => {
      freshRequest.resolve(
        buildResult({}, [buildUser({ id: "admin-user-002", name: "Bruno Lima" })]),
      );
      await freshRequest.promise;
    });

    expect(await screen.findByText("Bruno Lima")).toBeInTheDocument();

    await act(async () => {
      staleRequest.reject(
        new ServiceRequestError({
          kind: "network",
          message: "offline",
        }),
      );
      await staleRequest.promise.catch(() => undefined);
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
  });

  it("sucesso antigo não substitui erro da consulta atual", async () => {
    const staleRequest = createDeferred<AdminUsersListResult>();
    const currentRequest = createDeferred<AdminUsersListResult>();

    listUsersMock
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);

    renderPage();

    fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
      target: { value: "Falha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await act(async () => {
      currentRequest.reject(
        new ServiceRequestError({
          kind: "network",
          message: "offline",
        }),
      );
      await currentRequest.promise.catch(() => undefined);
    });

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await act(async () => {
      staleRequest.resolve(
        buildResult({}, [buildUser({ id: "admin-user-004", name: "Resposta Antiga" })]),
      );
      await staleRequest.promise;
    });

    expect(screen.queryByText("Resposta Antiga")).not.toBeInTheDocument();
  });

  it("não atualiza estado após desmontagem", async () => {
    const pendingRequest = createDeferred<AdminUsersListResult>();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listUsersMock.mockReturnValueOnce(pendingRequest.promise);

    try {
      const { unmount } = renderPage();
      unmount();

      await act(async () => {
        pendingRequest.resolve(baseResult);
        await pendingRequest.promise;
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
