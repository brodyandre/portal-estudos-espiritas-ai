import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminSelectableGroups } from "../services/adminGroupsService";
import { listAdminStudyMeetings } from "../services/adminStudyMeetingsService";
import {
  buildMeetingsResult,
  endedMeeting,
  groups,
  renderPage,
  scheduledMeeting,
  waitForInitialMeetings,
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

describe("AdminGroupsPage filters and pagination", () => {
  beforeEach(() => {
    listGroupsMock.mockReset();
    listMeetingsMock.mockReset();
    listGroupsMock.mockResolvedValue({ items: groups, source: "api" });
    listMeetingsMock.mockResolvedValue(buildMeetingsResult([scheduledMeeting], {
      total: 24,
      totalPages: 3,
    }));
  });

  afterEach(() => {
    cleanup();
    listGroupsMock.mockReset();
    listMeetingsMock.mockReset();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("editar rascunho não consulta automaticamente", async () => {
    renderPage();
    await waitForInitialMeetings();
    listMeetingsMock.mockClear();

    fireEvent.click(screen.getByLabelText(/Cancelados/));
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "desc" } });
    fireEvent.change(screen.getByLabelText("Itens por página"), { target: { value: "25" } });

    expect(listMeetingsMock).not.toHaveBeenCalled();
  });

  it("aplicar envia exatamente os filtros e volta à página 1", async () => {
    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() => {
      expect(listMeetingsMock).toHaveBeenLastCalledWith(
        "emmanuel",
        expect.objectContaining({ page: 2 }),
      );
    });

    listMeetingsMock.mockClear();
    fireEvent.click(screen.getByLabelText(/Cancelados/));
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "desc" } });
    fireEvent.change(screen.getByLabelText("Itens por página"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listMeetingsMock).toHaveBeenCalledWith("emmanuel", {
        includeCanceled: true,
        sortOrder: "desc",
        pageSize: 25,
        page: 1,
      });
    });
  });

  it("limpar restaura defaults e consulta página 1", async () => {
    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByLabelText(/Cancelados/));
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "desc" } });
    fireEvent.change(screen.getByLabelText("Itens por página"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: true,
      sortOrder: "desc",
      pageSize: 50,
      page: 1,
    }));

    listMeetingsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      expect(listMeetingsMock).toHaveBeenCalledWith("emmanuel", {
        includeCanceled: false,
        sortOrder: "asc",
        pageSize: 10,
        page: 1,
      });
    });
    expect(screen.getByLabelText("Ordenação")).toHaveValue("asc");
    expect(screen.getByLabelText("Itens por página")).toHaveValue("10");
    expect(screen.getByLabelText(/Cancelados/)).not.toBeChecked();
  });

  it("troca de grupo mantém filtros aplicados e reinicia página", async () => {
    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByLabelText(/Cancelados/));
    fireEvent.change(screen.getByLabelText("Ordenação"), { target: { value: "desc" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: true,
      sortOrder: "desc",
      pageSize: 10,
      page: 1,
    }));

    listMeetingsMock.mockClear();
    fireEvent.change(screen.getByLabelText(/Grupo/), {
      target: { value: "a-caminho-da-luz" },
    });

    await waitFor(() => {
      expect(listMeetingsMock).toHaveBeenCalledWith("a-caminho-da-luz", {
        includeCanceled: true,
        sortOrder: "desc",
        pageSize: 10,
        page: 1,
      });
    });
  });

  it("paginação avança, volta e preserva grupo e filtros", async () => {
    listMeetingsMock
      .mockResolvedValueOnce(buildMeetingsResult([scheduledMeeting], {
        page: 1,
        total: 24,
        totalPages: 3,
      }))
      .mockResolvedValueOnce(buildMeetingsResult([endedMeeting], {
        page: 2,
        total: 24,
        totalPages: 3,
      }))
      .mockResolvedValueOnce(buildMeetingsResult([scheduledMeeting], {
        page: 1,
        total: 24,
        totalPages: 3,
      }));

    renderPage();
    await waitForInitialMeetings();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: false,
      sortOrder: "asc",
      pageSize: 10,
      page: 2,
    }));
    expect(await screen.findByText("Página 2 de 3 · 24 encontros")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    await waitFor(() => expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: false,
      sortOrder: "asc",
      pageSize: 10,
      page: 1,
    }));
  });

  it("desabilita limites de paginação", async () => {
    listMeetingsMock.mockResolvedValue(buildMeetingsResult([scheduledMeeting], {
      page: 1,
      total: 1,
      totalPages: 1,
    }));

    renderPage();
    await waitForInitialMeetings();

    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });

  it("corrige página fora do total sem renderizar item inválido", async () => {
    listMeetingsMock
      .mockResolvedValueOnce(buildMeetingsResult([scheduledMeeting], {
        page: 1,
        total: 24,
        totalPages: 3,
      }))
      .mockResolvedValueOnce(buildMeetingsResult([endedMeeting], {
        page: 2,
        total: 1,
        totalPages: 1,
      }))
      .mockResolvedValueOnce(buildMeetingsResult([scheduledMeeting], {
        page: 1,
        total: 1,
        totalPages: 1,
      }));

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() => {
      expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
        includeCanceled: false,
        sortOrder: "asc",
        pageSize: 10,
        page: 1,
      });
    });
    expect(screen.queryByText("Encontro encerrado")).not.toBeInTheDocument();
    expect(screen.getByText("Encontro agendado")).toBeInTheDocument();
  });
});
