import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminSelectableGroups } from "../services/adminGroupsService";
import {
  cancelAdminStudyMeeting,
  createAdminStudyMeeting,
  listAdminStudyMeetings,
  updateAdminStudyMeeting,
} from "../services/adminStudyMeetingsService";
import {
  buildMeetingsResult,
  canceledMeeting,
  createDeferred,
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
const createMeetingMock = vi.mocked(createAdminStudyMeeting);
const updateMeetingMock = vi.mocked(updateAdminStudyMeeting);
const cancelMeetingMock = vi.mocked(cancelAdminStudyMeeting);

const getField = (id: string) => {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error(`Campo ${id} não encontrado.`);
  }

  return element;
};

describe("AdminGroupsPage dialog accessibility", () => {
  beforeEach(() => {
    listGroupsMock.mockReset();
    listMeetingsMock.mockReset();
    createMeetingMock.mockReset();
    updateMeetingMock.mockReset();
    cancelMeetingMock.mockReset();
    listGroupsMock.mockResolvedValue({ items: groups, source: "api" });
    listMeetingsMock.mockResolvedValue(buildMeetingsResult([scheduledMeeting]));
    createMeetingMock.mockResolvedValue(scheduledMeeting);
    updateMeetingMock.mockResolvedValue(scheduledMeeting);
    cancelMeetingMock.mockResolvedValue(canceledMeeting);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("dialog de criação possui semântica, descrição acessível, foco inicial e Escape", async () => {
    renderPage();
    await waitForInitialMeetings();
    const trigger = screen.getByRole("button", { name: "Novo encontro" });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Novo encontro" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/Crie um encontro futuro/i);
    expect(screen.getByLabelText("Título")).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Novo encontro" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("dialog de edição restaura foco ao cancelar", async () => {
    renderPage();
    await waitForInitialMeetings();
    const trigger = screen.getByRole("button", { name: "Editar" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Editar encontro" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Título")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Editar encontro" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("dialog de cancelamento possui nome, descrição, foco inicial e erro acessível", async () => {
    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar encontro" }));

    const dialog = screen.getByRole("dialog", { name: "Cancelar encontro" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/ficará registrado/i);
    expect(getField("admin-meeting-cancellation-reason")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    const reason = getField("admin-meeting-cancellation-reason");
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveAccessibleDescription("Informe o motivo do cancelamento.");
  });

  it("Escape fica bloqueado e campos/botões desabilitados durante submit", async () => {
    const pendingCreate = createDeferred<typeof scheduledMeeting>();
    createMeetingMock.mockReturnValueOnce(pendingCreate.promise);

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Encontro futuro" } });
    fireEvent.change(getField("admin-meeting-starts-at"), { target: { value: "2026-07-16T10:00" } });
    fireEvent.change(getField("admin-meeting-ends-at"), { target: { value: "2026-07-16T11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));

    expect(screen.getByLabelText("Título")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Novo encontro" })).toBeInTheDocument();

    await act(async () => {
      pendingCreate.resolve(scheduledMeeting);
      await pendingCreate.promise;
    });

    expect(await screen.findByText("Encontro criado com sucesso.")).toBeInTheDocument();
  });

  it("dialog de cancelamento devolve foco ao botão de origem após sucesso", async () => {
    renderPage();
    await waitForInitialMeetings();
    const trigger = screen.getByRole("button", { name: "Cancelar encontro" });

    fireEvent.click(trigger);
    fireEvent.change(getField("admin-meeting-cancellation-reason"), {
      target: { value: "Recesso" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText("Encontro cancelado com sucesso.")).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
