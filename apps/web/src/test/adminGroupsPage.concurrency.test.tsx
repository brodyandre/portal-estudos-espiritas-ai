import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminSelectableGroups } from "../services/adminGroupsService";
import { listAdminStudyMeetings } from "../services/adminStudyMeetingsService";
import { ServiceRequestError } from "../services/api";
import type { AdminSelectableGroupsResult } from "../types/adminGroups";
import type { AdminStudyMeetingListResult } from "../types/adminStudyMeetings";
import {
  activeGroup,
  buildMeetingsResult,
  createDeferred,
  endedMeeting,
  groups,
  inactiveGroup,
  renderPage,
  scheduledMeeting,
} from "./AdminGroupsPageTestSupport";

vi.mock("../services/adminGroupsService", () => ({
  listAdminSelectableGroups: vi.fn(),
}));

vi.mock("../services/adminStudyMeetingsService", () => ({
  cancelAdminStudyMeeting: vi.fn(),
  createAdminStudyMeeting: vi.fn(),
  listAdminStudyMeetings: vi.fn(),
  updateAdminStudyMeeting: vi.fn(),
}));

const listGroupsMock = vi.mocked(listAdminSelectableGroups);
const listMeetingsMock = vi.mocked(listAdminStudyMeetings);

describe("AdminGroupsPage concurrency", () => {
  beforeEach(() => {
    listGroupsMock.mockReset();
    listMeetingsMock.mockReset();
    listGroupsMock.mockResolvedValue({ items: groups, source: "api" });
    listMeetingsMock.mockResolvedValue(buildMeetingsResult());
  });

  afterEach(() => {
    cleanup();
    listGroupsMock.mockReset();
    listMeetingsMock.mockReset();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("resposta antiga de grupos não sobrescreve retry mais recente", async () => {
    const failedGroups = createDeferred<AdminSelectableGroupsResult>();
    const freshGroups = createDeferred<AdminSelectableGroupsResult>();
    listGroupsMock
      .mockReturnValueOnce(failedGroups.promise)
      .mockReturnValueOnce(freshGroups.promise);

    renderPage();

    await act(async () => {
      failedGroups.reject(new ServiceRequestError({ kind: "network", message: "offline" }));
      await failedGroups.promise.catch(() => undefined);
    });

    fireEvent.click(await screen.findByRole("button", { name: "Tentar carregar grupos" }));

    await act(async () => {
      freshGroups.resolve({ items: [inactiveGroup], source: "api" });
      await freshGroups.promise;
    });
    expect(await screen.findByRole("option", { name: "A Caminho da Luz (inativo)" })).toBeInTheDocument();

    expect(screen.queryByRole("option", { name: "Emmanuel (ativo)" })).not.toBeInTheDocument();
  });

  it("resposta antiga de encontros não sobrescreve troca de grupo", async () => {
    const firstMeetings = createDeferred<AdminStudyMeetingListResult>();
    const secondMeetings = createDeferred<AdminStudyMeetingListResult>();
    listMeetingsMock
      .mockReturnValueOnce(firstMeetings.promise)
      .mockReturnValueOnce(secondMeetings.promise);

    renderPage();
    await screen.findByText("Carregando encontros");
    fireEvent.change(await screen.findByLabelText(/Grupo/), {
      target: { value: "a-caminho-da-luz" },
    });

    await act(async () => {
      secondMeetings.resolve(buildMeetingsResult([endedMeeting]));
      await secondMeetings.promise;
    });

    expect(await screen.findByText("Encontro encerrado")).toBeInTheDocument();

    await act(async () => {
      firstMeetings.resolve(buildMeetingsResult([scheduledMeeting]));
      await firstMeetings.promise;
    });

    expect(screen.queryByText("Encontro agendado")).not.toBeInTheDocument();
  });

  it("resposta antiga não sobrescreve filtros aplicados mais recentes", async () => {
    const initial = createDeferred<AdminStudyMeetingListResult>();
    const filtered = createDeferred<AdminStudyMeetingListResult>();
    listMeetingsMock
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(filtered.promise);

    renderPage();
    fireEvent.click(await screen.findByLabelText(/Cancelados/));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await act(async () => {
      filtered.resolve(buildMeetingsResult([endedMeeting]));
      await filtered.promise;
    });

    expect(await screen.findByText("Encontro encerrado")).toBeInTheDocument();

    await act(async () => {
      initial.resolve(buildMeetingsResult([scheduledMeeting]));
      await initial.promise;
    });

    expect(screen.queryByText("Encontro agendado")).not.toBeInTheDocument();
  });

  it("mudança de página mantém grupo e filtros da solicitação atual", async () => {
    listMeetingsMock
      .mockResolvedValueOnce(buildMeetingsResult([scheduledMeeting], {
        total: 24,
        totalPages: 3,
      }));
    const pageTwo = createDeferred<AdminStudyMeetingListResult>();
    listMeetingsMock.mockReturnValueOnce(pageTwo.promise);

    renderPage();
    expect(await screen.findByText("Encontro agendado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await act(async () => {
      pageTwo.resolve(buildMeetingsResult([endedMeeting], {
        page: 2,
        total: 24,
        totalPages: 3,
      }));
      await pageTwo.promise;
    });

    expect(await screen.findByText("Encontro encerrado")).toBeInTheDocument();
    expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: false,
      sortOrder: "asc",
      pageSize: 10,
      page: 2,
    });
  });

  it("não atualiza estado após unmount", async () => {
    const pendingGroups = createDeferred<AdminSelectableGroupsResult>();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listGroupsMock.mockReturnValueOnce(pendingGroups.promise);

    try {
      const { unmount } = renderPage();
      unmount();

      await act(async () => {
        pendingGroups.resolve({ items: groups, source: "api" });
        await pendingGroups.promise;
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
