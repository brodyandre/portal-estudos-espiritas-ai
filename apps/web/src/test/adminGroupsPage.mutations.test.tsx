import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminSelectableGroups } from "../services/adminGroupsService";
import {
  cancelAdminStudyMeeting,
  createAdminStudyMeeting,
  listAdminStudyMeetings,
  updateAdminStudyMeeting,
} from "../services/adminStudyMeetingsService";
import { ServiceRequestError } from "../services/api";
import { isoToDatetimeLocalValue } from "../utils/adminStudyMeetings";
import {
  activeGroup,
  buildMeetingsResult,
  canceledMeeting,
  createDeferred,
  endedMeeting,
  groups,
  inProgressMeeting,
  inactiveGroup,
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

const futureStart = "2026-07-16T10:00";
const futureEnd = "2026-07-16T11:00";
const expectedFutureStartIso = new Date(futureStart).toISOString();
const expectedFutureEndIso = new Date(futureEnd).toISOString();

const getField = (id: string) => {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error(`Campo ${id} não encontrado.`);
  }

  return element;
};

const fillValidCreateForm = () => {
  fireEvent.change(getField("admin-meeting-title"), {
    target: { value: "Estudo do Evangelho" },
  });
  fireEvent.change(getField("admin-meeting-description"), {
    target: { value: "   " },
  });
  fireEvent.change(getField("admin-meeting-starts-at"), {
    target: { value: futureStart },
  });
  fireEvent.change(getField("admin-meeting-ends-at"), {
    target: { value: futureEnd },
  });
};

describe("AdminGroupsPage mutations", () => {
  beforeEach(() => {
    listGroupsMock.mockReset();
    listMeetingsMock.mockReset();
    createMeetingMock.mockReset();
    updateMeetingMock.mockReset();
    cancelMeetingMock.mockReset();
    listGroupsMock.mockResolvedValue({ items: groups, source: "api" });
    listMeetingsMock.mockResolvedValue(buildMeetingsResult([scheduledMeeting], {
      total: 24,
      totalPages: 3,
    }));
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

  it("exibe Novo encontro apenas para grupo ativo em modo API", async () => {
    renderPage();
    await waitForInitialMeetings();

    expect(screen.getByRole("button", { name: "Novo encontro" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Grupo/), {
      target: { value: inactiveGroup.slug },
    });

    await waitFor(() => {
      expect(listMeetingsMock).toHaveBeenLastCalledWith(inactiveGroup.slug, expect.any(Object));
    });
    expect(screen.queryByRole("button", { name: "Novo encontro" })).not.toBeInTheDocument();
  });

  it("cria encontro com validações, ISO explícito, sucesso e refetch dos filtros aplicados", async () => {
    listMeetingsMock
      .mockResolvedValueOnce(buildMeetingsResult([scheduledMeeting], {
        total: 24,
        totalPages: 3,
      }))
      .mockResolvedValue(buildMeetingsResult([scheduledMeeting, endedMeeting], {
        page: 2,
        total: 24,
        totalPages: 3,
      }));

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", expect.objectContaining({ page: 2 })));

    fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));
    expect(screen.getByRole("dialog", { name: "Novo encontro" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));
    expect(screen.getByText("Informe o título do encontro.")).toBeInTheDocument();

    fillValidCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));

    await waitFor(() => {
      expect(createMeetingMock).toHaveBeenCalledWith("emmanuel", {
        title: "Estudo do Evangelho",
        description: null,
        startsAt: expectedFutureStartIso,
        endsAt: expectedFutureEndIso,
      });
    });
    expect(await screen.findByText("Encontro criado com sucesso.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Novo encontro" })).not.toBeInTheDocument();
    expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: false,
      sortOrder: "asc",
      pageSize: 10,
      page: 2,
    });
  });

  it("bloqueia datas inválidas, início no passado e término não posterior", async () => {
    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Agenda" } });
    fireEvent.change(getField("admin-meeting-starts-at"), { target: { value: "2026-07-15T10:00" } });
    fireEvent.change(getField("admin-meeting-ends-at"), { target: { value: "2026-07-15T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));

    expect(screen.getByText("O início precisa estar no futuro.")).toBeInTheDocument();
    expect(createMeetingMock).not.toHaveBeenCalled();

    fireEvent.change(getField("admin-meeting-starts-at"), { target: { value: futureStart } });
    fireEvent.change(getField("admin-meeting-ends-at"), { target: { value: futureStart } });
    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));

    expect(screen.getByText("O término precisa ser posterior ao início.")).toBeInTheDocument();
    expect(createMeetingMock).not.toHaveBeenCalled();
  });

  it("bloqueia submit duplicado, preserva formulário em erro de rede e permite tentar novamente", async () => {
    const pendingCreate = createDeferred<typeof scheduledMeeting>();
    createMeetingMock
      .mockReturnValueOnce(pendingCreate.promise)
      .mockRejectedValueOnce(new ServiceRequestError({ kind: "network", message: "offline" }))
      .mockResolvedValueOnce(scheduledMeeting);

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));
    fillValidCreateForm();

    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvando..." }));
    expect(createMeetingMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingCreate.resolve(scheduledMeeting);
      await pendingCreate.promise;
    });
    await screen.findByText("Encontro criado com sucesso.");

    fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));
    fillValidCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));

    expect(await screen.findByText(/Não foi possível conectar ao backend local/)).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Estudo do Evangelho");

    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));
    expect(await screen.findByText("Encontro criado com sucesso.")).toBeInTheDocument();
    expect(createMeetingMock).toHaveBeenCalledTimes(3);
  });

  it("mostra rate limit, grupo inativo durante operação e conflito sem alterar a lista", async () => {
    createMeetingMock
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "ADMIN_STUDY_MEETING_RATE_LIMITED",
        message: "limite",
        retryAfterSeconds: 120,
      }))
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_GROUP_INACTIVE",
        message: "inativo",
      }))
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_MEETING_CONFLICT",
        message: "conflito",
      }));

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));
    fillValidCreateForm();

    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));
    expect(await screen.findByText(/2 minutos/)).toBeInTheDocument();
    expect(screen.getByText("Encontro agendado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));
    expect(await screen.findByText("O grupo está inativo para esta operação.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));
    expect(await screen.findByText(/conflito temporal/i)).toBeInTheDocument();
  });

  it("edita apenas encontro agendado de grupo ativo e envia somente campos permitidos alterados", async () => {
    listMeetingsMock.mockResolvedValue(buildMeetingsResult([
      scheduledMeeting,
      inProgressMeeting,
      endedMeeting,
      canceledMeeting,
    ]));

    renderPage();
    await waitForInitialMeetings();

    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("dialog", { name: "Editar encontro" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue(scheduledMeeting.title);
    expect(getField("admin-meeting-starts-at")).toHaveValue(isoToDatetimeLocalValue(scheduledMeeting.startsAt));

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(screen.getByText("Altere pelo menos um campo antes de salvar.")).toBeInTheDocument();
    expect(updateMeetingMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Nova preparação" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateMeetingMock).toHaveBeenCalledWith("emmanuel", scheduledMeeting.id, {
        description: "Nova preparação",
      });
    });
    expect(await screen.findByText("Encontro atualizado com sucesso.")).toBeInTheDocument();
  });

  it("não permite edição em grupo inativo, mas mantém cancelamento de futuro disponível", async () => {
    listGroupsMock.mockResolvedValue({ items: [inactiveGroup], source: "api" });
    listMeetingsMock.mockResolvedValue(buildMeetingsResult([scheduledMeeting]));

    renderPage();
    await waitForInitialMeetings();

    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar encontro" })).toBeInTheDocument();
  });

  it("mantém erros de edição no dialog para encontro iniciado, cancelado ou inexistente", async () => {
    updateMeetingMock
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_MEETING_ALREADY_STARTED",
        message: "iniciado",
      }))
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_MEETING_ALREADY_CANCELED",
        message: "cancelado",
      }))
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_MEETING_NOT_FOUND",
        message: "não encontrado",
      }));

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Novo título" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText(/já começou/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText(/já foi cancelado/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText(/Encontro não encontrado/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Editar encontro" })).toBeInTheDocument();
  });

  it("cancela encontro com motivo trimado, sem remoção otimista e refetch aplicado", async () => {
    const pendingCancel = createDeferred<typeof canceledMeeting>();
    cancelMeetingMock.mockReturnValueOnce(pendingCancel.promise);

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar encontro" }));

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(screen.getByText("Informe o motivo do cancelamento.")).toBeInTheDocument();
    expect(cancelMeetingMock).not.toHaveBeenCalled();

    fireEvent.change(getField("admin-meeting-cancellation-reason"), {
      target: { value: "  Recesso semanal  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelando..." }));

    expect(cancelMeetingMock).toHaveBeenCalledTimes(1);
    expect(cancelMeetingMock).toHaveBeenCalledWith("emmanuel", scheduledMeeting.id, {
      cancellationReason: "Recesso semanal",
    });
    expect(screen.getByText("Encontro agendado")).toBeInTheDocument();

    await act(async () => {
      pendingCancel.resolve(canceledMeeting);
      await pendingCancel.promise;
    });

    expect(await screen.findByText("Encontro cancelado com sucesso.")).toBeInTheDocument();
    expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: false,
      sortOrder: "asc",
      pageSize: 10,
      page: 1,
    });
  });

  it("mapeia erros de cancelamento já cancelado, iniciado, encerrado e rate limit", async () => {
    cancelMeetingMock
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_MEETING_ALREADY_CANCELED",
        message: "cancelado",
      }))
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_MEETING_ALREADY_STARTED",
        message: "iniciado",
      }))
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "STUDY_MEETING_ALREADY_ENDED",
        message: "encerrado",
      }))
      .mockRejectedValueOnce(new ServiceRequestError({
        kind: "api",
        code: "ADMIN_STUDY_MEETING_RATE_LIMITED",
        message: "limite",
        retryAfterSeconds: 60,
      }));

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar encontro" }));
    fireEvent.change(getField("admin-meeting-cancellation-reason"), {
      target: { value: "Motivo válido" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText(/já foi cancelado/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText(/já começou/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText(/já terminou/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText(/1 minuto/)).toBeInTheDocument();
  });

  it("não executa mutações no modo demonstrativo", async () => {
    listGroupsMock.mockResolvedValue({ items: [activeGroup], source: "demo" });

    renderPage();
    await waitForInitialMeetings();

    expect(screen.queryByRole("button", { name: "Novo encontro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar encontro" })).not.toBeInTheDocument();
    expect(createMeetingMock).not.toHaveBeenCalled();
    expect(updateMeetingMock).not.toHaveBeenCalled();
    expect(cancelMeetingMock).not.toHaveBeenCalled();
  });

  it("não atualiza estado após unmount durante mutação", async () => {
    const pendingCreate = createDeferred<typeof scheduledMeeting>();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createMeetingMock.mockReturnValueOnce(pendingCreate.promise);

    try {
      const { unmount } = renderPage();
      await waitForInitialMeetings();
      fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));
      fillValidCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));
      unmount();

      await act(async () => {
        pendingCreate.resolve(scheduledMeeting);
        await pendingCreate.promise;
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("bloqueia criação e cancelamento simultâneos e refetch usa filtros aplicados, não rascunho", async () => {
    const pendingCreate = createDeferred<typeof scheduledMeeting>();
    createMeetingMock.mockReturnValueOnce(pendingCreate.promise);

    renderPage();
    await waitForInitialMeetings();
    fireEvent.click(screen.getByLabelText(/Cancelados/));
    fireEvent.click(screen.getByRole("button", { name: "Novo encontro" }));
    fillValidCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Criar encontro" }));

    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar encontro" })).toBeDisabled();

    await act(async () => {
      pendingCreate.resolve(scheduledMeeting);
      await pendingCreate.promise;
    });

    expect(await screen.findByText("Encontro criado com sucesso.")).toBeInTheDocument();
    expect(listMeetingsMock).toHaveBeenLastCalledWith("emmanuel", {
      includeCanceled: false,
      sortOrder: "asc",
      pageSize: 10,
      page: 1,
    });
  });
});
