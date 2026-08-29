import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAdminSelectableGroups } from "../services/adminGroupsService";
import {
  createAdminTeacher,
  getAdminUserPedagogicalGroups,
  sendAdminTeacherInvitation,
  updateAdminUserPedagogicalGroups,
} from "../services/adminTeachersService";
import { updateAdminUserStatus } from "../services/adminUserStatusService";
import { listAdminUsersList } from "../services/adminUsersListService";
import {
  attentionTeacher,
  awaitingTeacher,
  baseTeacher,
  buildTeacher,
  buildTeachersResult,
  inactiveTeacher,
  renderAdminTeachersRoute,
  selectableGroups,
  storeAuthenticatedUser,
} from "./AdminTeachersPageTestSupport";

vi.mock("../services/adminUsersListService", () => ({
  listAdminUsersList: vi.fn(),
}));

vi.mock("../services/adminGroupsService", () => ({
  listAdminSelectableGroups: vi.fn(),
}));

vi.mock("../services/adminTeachersService", () => ({
  createAdminTeacher: vi.fn(),
  getAdminUserPedagogicalGroups: vi.fn(),
  sendAdminTeacherInvitation: vi.fn(),
  updateAdminUserPedagogicalGroups: vi.fn(),
}));

vi.mock("../services/adminUserStatusService", () => ({
  updateAdminUserStatus: vi.fn(),
}));

const listUsersMock = vi.mocked(listAdminUsersList);
const listGroupsMock = vi.mocked(listAdminSelectableGroups);
const createTeacherMock = vi.mocked(createAdminTeacher);
const getPedagogicalGroupsMock = vi.mocked(getAdminUserPedagogicalGroups);
const updatePedagogicalGroupsMock = vi.mocked(updateAdminUserPedagogicalGroups);
const sendInvitationMock = vi.mocked(sendAdminTeacherInvitation);
const updateStatusMock = vi.mocked(updateAdminUserStatus);

const teacherGroupsResponse = (id: string, groupSlugs: string[]) => ({
  user: {
    id,
    groups: selectableGroups
      .filter((group) => groupSlugs.includes(group.slug))
      .map((group) => ({
        name: group.name,
        slug: group.slug,
        status: group.status,
      })),
  },
});

describe("AdminTeachersPage", () => {
  beforeEach(() => {
    storeAuthenticatedUser("admin", { id: "admin-owner" });
    listUsersMock.mockReset();
    listGroupsMock.mockReset();
    createTeacherMock.mockReset();
    getPedagogicalGroupsMock.mockReset();
    updatePedagogicalGroupsMock.mockReset();
    sendInvitationMock.mockReset();
    updateStatusMock.mockReset();

    listUsersMock.mockResolvedValue(buildTeachersResult([baseTeacher]));
    listGroupsMock.mockResolvedValue({ items: selectableGroups, source: "api" });
    getPedagogicalGroupsMock.mockImplementation(async (userId: string) =>
      teacherGroupsResponse(userId, userId === "admin-owner" ? [] : ["emmanuel"]),
    );
    createTeacherMock.mockResolvedValue({
      user: {
        id: "teacher-new",
        fullName: "Profa. Nova",
        role: "teacher",
        status: "active",
        accountActivated: false,
      },
      groups: teacherGroupsResponse("teacher-new", ["emmanuel"]).user.groups,
    });
    updatePedagogicalGroupsMock.mockImplementation(async (userId: string, input) =>
      teacherGroupsResponse(userId, input.groupIds),
    );
    sendInvitationMock.mockResolvedValue({
      user: {
        id: "teacher-002",
        fullName: "Prof. Davi",
        email: "davi@example.com",
      },
      invitation: {
        expiresAt: "2026-07-20T10:00:00.000Z",
        deliveryStatus: "sent",
        invitationType: "admin_reinvite",
      },
    });
    updateStatusMock.mockResolvedValue({
      user: {
        id: "teacher-001",
        status: "inactive",
      },
      revokedSessions: 1,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("carrega a rota administrativa e consulta apenas role teacher", async () => {
    listUsersMock.mockResolvedValueOnce(
      buildTeachersResult([
        baseTeacher,
        {
          ...baseTeacher,
          id: "student-001",
          name: "Aluno Pedro",
          role: "student",
          emailMasked: "pe***@demo.local",
          teacherGroups: [],
        },
      ]),
    );

    renderAdminTeachersRoute();

    expect(await screen.findByText("Profa. Clara")).toBeInTheDocument();
    expect(screen.queryByText("Aluno Pedro")).not.toBeInTheDocument();
    expect(listUsersMock).toHaveBeenCalledWith({
      role: "teacher",
      sortBy: "name",
      sortOrder: "asc",
      page: 1,
      pageSize: 10,
    });
    expect(listGroupsMock).toHaveBeenCalledWith("all");
    expect(getPedagogicalGroupsMock).toHaveBeenCalledWith("admin-owner");
  });

  it("expõe estados operacionais de professores sem hardcode de grupos", async () => {
    listUsersMock.mockResolvedValueOnce(
      buildTeachersResult([baseTeacher, awaitingTeacher, inactiveTeacher, attentionTeacher]),
    );

    renderAdminTeachersRoute();

    expect(await screen.findByText("Profa. Clara")).toBeInTheDocument();
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aguardando ativação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inativo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requer atenção").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Obras Póstumas").length).toBeGreaterThan(0);
  });

  it("aplica filtros de estado, busca e grupo com contrato de listagem de professores", async () => {
    renderAdminTeachersRoute();
    await screen.findByText("Profa. Clara");
    listUsersMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Ativos" }));
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        role: "teacher",
        sortBy: "name",
        sortOrder: "asc",
        status: "active",
        activationStatus: "activated",
        page: 1,
        pageSize: 10,
      });
    });

    listUsersMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Aguardando ativação" }));
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith(expect.objectContaining({
        role: "teacher",
        status: "active",
        activationStatus: "not_activated",
      }));
    });

    listUsersMock.mockClear();
    fireEvent.change(screen.getByLabelText("Buscar professor"), {
      target: { value: "  Davi  " },
    });
    fireEvent.change(screen.getByLabelText("Grupo"), {
      target: { value: "obras-postumas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith(expect.objectContaining({
        search: "Davi",
        group: "obras-postumas",
        role: "teacher",
        status: "active",
        activationStatus: "not_activated",
        page: 1,
      }));
    });
  });

  it("cadastra professor exigindo grupo pedagógico e sem escolher senha ou papel", async () => {
    renderAdminTeachersRoute();
    await screen.findByText("Profa. Clara");

    fireEvent.click(screen.getByRole("button", { name: "Novo professor" }));
    const dialog = await screen.findByRole("dialog", { name: "Cadastrar professor" });

    fireEvent.change(within(dialog).getByLabelText("Nome completo"), {
      target: { value: "Profa. Nova" },
    });
    fireEvent.change(within(dialog).getByLabelText("E-mail"), {
      target: { value: "nova@example.com" },
    });
    fireEvent.click(within(dialog).getByLabelText("Obras Póstumas"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar professor" }));

    await waitFor(() => {
      expect(createTeacherMock).toHaveBeenCalledWith({
        fullName: "Profa. Nova",
        email: "nova@example.com",
        groupIds: ["obras-postumas"],
      });
    });
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Papel")).not.toBeInTheDocument();
    expect(await screen.findByText("Professor criado com sucesso. A conta está aguardando ativação.")).toBeInTheDocument();
  });

  it("edita vínculos pedagógicos pelo contrato de pedagogical-groups", async () => {
    renderAdminTeachersRoute();
    await screen.findByText("Profa. Clara");

    fireEvent.click(screen.getByRole("button", { name: "Editar grupos de Profa. Clara" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar grupos" });

    await waitFor(() => {
      expect(getPedagogicalGroupsMock).toHaveBeenCalledWith("teacher-001");
    });
    fireEvent.click(within(dialog).getByLabelText("Obras Póstumas"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar vínculos" }));

    await waitFor(() => {
      expect(updatePedagogicalGroupsMock).toHaveBeenCalledWith("teacher-001", {
        groupIds: ["emmanuel", "obras-postumas"],
      });
    });
    expect(await screen.findByText("Grupos pedagógicos do professor atualizados com sucesso.")).toBeInTheDocument();
  });

  it("permite envio por userId e mantém reenvio bloqueado por falta de invitationId correlacionado", async () => {
    listUsersMock.mockResolvedValueOnce(buildTeachersResult([awaitingTeacher]));
    renderAdminTeachersRoute();
    await screen.findByText("Prof. Davi");

    expect(screen.getByRole("button", { name: "Reenviar convite" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite para Prof. Davi" }));

    await waitFor(() => {
      expect(sendInvitationMock).toHaveBeenCalledWith("teacher-002");
    });
    expect(await screen.findByText("Convite enviado para Prof. Davi.")).toBeInTheDocument();
    expect(screen.queryByText(/token|secret|https:\/\//iu)).not.toBeInTheDocument();
  });

  it("salva a supervisão pedagógica do ADMIN sem alterar papel", async () => {
    renderAdminTeachersRoute();
    await screen.findByText("Profa. Clara");

    const supervision = screen.getByRole("region", { name: "Minha supervisão pedagógica" });
    expect(within(supervision).getByRole("link", { name: "Acessar área do professor" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.click(within(supervision).getByLabelText("A Caminho da Luz"));
    fireEvent.click(within(supervision).getByRole("button", { name: "Salvar acessos" }));

    await waitFor(() => {
      expect(updatePedagogicalGroupsMock).toHaveBeenCalledWith("admin-owner", {
        groupIds: ["a-caminho-da-luz"],
      });
    });
    expect(await screen.findByText("Sua supervisão pedagógica foi atualizada.")).toBeInTheDocument();
    expect(within(supervision).getByRole("link", { name: "Acessar área do professor" })).toHaveAttribute(
      "href",
      "/professor",
    );
  });

  it("inativa professor somente após confirmação explícita", async () => {
    renderAdminTeachersRoute();
    await screen.findByText("Profa. Clara");

    fireEvent.click(screen.getByRole("button", { name: "Inativar professor Profa. Clara" }));
    expect(await screen.findByRole("dialog", { name: "Inativar Profa. Clara?" })).toBeInTheDocument();
    expect(updateStatusMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar inativação" }));
    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledWith("teacher-001", "inactive");
    });
  });
});
