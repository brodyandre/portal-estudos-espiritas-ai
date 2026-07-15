import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminSelectableGroups } from "../services/adminGroupsService";
import { listAdminStudyMeetings } from "../services/adminStudyMeetingsService";
import { ServiceRequestError } from "../services/api";
import {
  buildMeetingsResult,
  canceledMeeting,
  endedMeeting,
  expectDefaultMeetingsQuery,
  groups,
  inProgressMeeting,
  renderPage,
  renderProtectedRoute,
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

describe("AdminGroupsPage", () => {
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

  it("admin acessa /admin/grupos e carrega o primeiro grupo", async () => {
    renderProtectedRoute("admin");

    expect(await screen.findByRole("heading", { name: "Encontros dos grupos" })).toBeInTheDocument();
    expect(await screen.findByText("Encontro agendado")).toBeInTheDocument();
    expect(screen.getByLabelText(/Grupo/)).toHaveValue("emmanuel");
    expect(listGroupsMock).toHaveBeenCalledWith("all");
    expectDefaultMeetingsQuery(listMeetingsMock);
  });

  it("usuário sem papel admin continua bloqueado", async () => {
    renderProtectedRoute("student");

    expect(await screen.findByText("Acesso restrito")).toBeInTheDocument();
    expect(listGroupsMock).not.toHaveBeenCalled();
    expect(listMeetingsMock).not.toHaveBeenCalled();
  });

  it("identifica grupo ativo e inativo no seletor", async () => {
    renderPage();

    expect(await screen.findByText("Encontro agendado")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Emmanuel (ativo)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "A Caminho da Luz (inativo)" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Grupo/), {
      target: { value: "a-caminho-da-luz" },
    });

    expect(await screen.findAllByText("Grupo inativo")).toHaveLength(2);
    expect(
      screen.getByText(/novas alterações administrativas ficarão indisponíveis/i),
    ).toBeInTheDocument();
  });

  it("mostra ausência de grupos", async () => {
    listGroupsMock.mockResolvedValue({ items: [], source: "api" });

    renderPage();

    expect(await screen.findByText("Nenhum grupo disponível")).toBeInTheDocument();
    expect(listMeetingsMock).not.toHaveBeenCalled();
  });

  it("mostra erro de grupos e permite retry independente", async () => {
    listGroupsMock
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "network",
          message: "offline",
        }),
      )
      .mockResolvedValueOnce({ items: groups, source: "api" });

    renderPage();

    expect(await screen.findByText("Não foi possível carregar os grupos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar carregar grupos" }));

    expect(await screen.findByText("Encontro agendado")).toBeInTheDocument();
    expect(listGroupsMock).toHaveBeenCalledTimes(2);
  });

  it("renderiza loading, sucesso, descrição anulável, motivo e status derivados", async () => {
    listMeetingsMock.mockResolvedValue(
      buildMeetingsResult([
        scheduledMeeting,
        inProgressMeeting,
        endedMeeting,
        canceledMeeting,
      ]),
    );

    renderPage();

    expect(screen.getByText("Carregando grupos")).toBeInTheDocument();
    expect(await screen.findByText("Encontro agendado")).toBeInTheDocument();
    expect(screen.getByText("Leitura preparatória da semana")).toBeInTheDocument();
    expect(screen.getByText("Encontro em andamento")).toBeInTheDocument();
    expect(screen.getByText("Encontro encerrado")).toBeInTheDocument();
    expect(screen.getByText("Encontro cancelado")).toBeInTheDocument();
    expect(screen.getByText("Recesso do grupo")).toBeInTheDocument();
    expect(screen.getByText("Agendado")).toBeInTheDocument();
    expect(screen.getByText("Em andamento")).toBeInTheDocument();
    expect(screen.getByText("Encerrado")).toBeInTheDocument();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(screen.queryByText("2026-07-15T22:00:00.000Z")).not.toBeInTheDocument();
  });

  it("mostra agenda vazia", async () => {
    listMeetingsMock.mockResolvedValue(buildMeetingsResult([], { total: 0, totalPages: 0 }));

    renderPage();

    expect(await screen.findByText("Agenda vazia")).toBeInTheDocument();
    expect(screen.getByText("0 encontros")).toBeInTheDocument();
  });

  it("mostra erro de encontros e permite retry independente", async () => {
    listMeetingsMock
      .mockRejectedValueOnce(
        new ServiceRequestError({
          kind: "api",
          code: "INVALID_STUDY_MEETING_LIST_INPUT",
          message: "filtros inválidos",
        }),
      )
      .mockResolvedValueOnce(buildMeetingsResult([endedMeeting]));

    renderPage();

    expect(await screen.findByText("Não foi possível carregar os encontros")).toBeInTheDocument();
    expect(screen.getByText("Revise os filtros da agenda e tente novamente.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar carregar encontros" }));

    expect(await screen.findByText("Encontro encerrado")).toBeInTheDocument();
    expect(listGroupsMock).toHaveBeenCalledTimes(1);
  });

  it("mostra mensagem de rate limit com tempo aproximado", async () => {
    listMeetingsMock.mockRejectedValue(
      new ServiceRequestError({
        kind: "api",
        code: "ADMIN_STUDY_MEETING_RATE_LIMITED",
        message: "muitas tentativas",
        retryAfterSeconds: 120,
      }),
    );

    renderPage();

    expect(await screen.findByText(/2 minutos/)).toBeInTheDocument();
  });

  it("modo demonstrativo mostra aviso e não expõe ações de mutação", async () => {
    listGroupsMock.mockResolvedValue({ items: groups, source: "demo" });

    renderPage();

    expect(await screen.findByText("Modo demonstrativo")).toBeInTheDocument();
    expect(screen.getByText(/dados demonstrativos somente leitura/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancelar/i })).not.toBeInTheDocument();
  });
});
