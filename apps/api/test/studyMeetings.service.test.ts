import { describe, expect, it } from "vitest";

import type { AuthUser } from "../src/modules/auth/auth.types";
import {
  createMemoryStudyMeetingGroupsRepository,
  createMemoryStudyMeetingsAuditRepository,
  createMemoryStudyMeetingsRepository,
  createMemoryStudyMeetingsState,
  createMemoryStudyMeetingsTransactionRunner,
  type MemoryStudyMeetingsState,
  type StudyMeetingAuditLogEntry,
  type StudyMeetingsRepository,
  type StudyMeetingsTransactionRunner,
} from "../src/modules/study-meetings/study-meetings.repository";
import {
  createStudyMeetingsAdminService,
  type StudyMeetingsAdminServiceDependencies,
} from "../src/modules/study-meetings/study-meetings.service";
import {
  STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH,
  STUDY_MEETING_DESCRIPTION_MAX_LENGTH,
  STUDY_MEETING_ID_MAX_LENGTH,
  STUDY_MEETING_TITLE_MAX_LENGTH,
  type StudyMeetingRecord,
} from "../src/modules/study-meetings/study-meetings.types";

const NOW = new Date("2026-07-20T12:00:00.000Z");

const adminUser: AuthUser = {
  id: "admin-actor",
  fullName: "Admin Demonstrativo",
  email: "admin.demo@example.com",
  role: "admin",
  status: "active",
  mustChangePassword: false,
  permissions: [],
};

const teacherUser: AuthUser = {
  ...adminUser,
  id: "teacher-actor",
  role: "teacher",
};

type HarnessPlan = {
  failCreateWith?: Error;
  failUpdateWith?: Error;
  failCancelWith?: Error;
  failAuditWith?: Error;
  overrideCancelResult?: StudyMeetingRecord | null;
  cancelBeforeUpdate?: {
    canceledAt: string;
    cancellationReason: string;
  };
};

const cloneState = (state: MemoryStudyMeetingsState): MemoryStudyMeetingsState => ({
  groups: state.groups.map((group) => ({ ...group })),
  meetings: state.meetings.map((meeting) => ({ ...meeting })),
  auditLogs: state.auditLogs.map((entry) => ({ ...entry })),
});

const buildBaseState = () =>
  createMemoryStudyMeetingsState({
    groups: [
      { id: "emmanuel", name: "Emmanuel", status: "active" },
      { id: "a-caminho-da-luz", name: "A Caminho da Luz", status: "active" },
      { id: "grupo-inativo", name: "Grupo Inativo", status: "inactive" },
    ],
    meetings: [
      {
        id: "meeting-future",
        groupId: "emmanuel",
        title: "Encontro futuro",
        description: "Descricao futura",
        startsAt: "2026-07-21T20:00:00.000Z",
        endsAt: "2026-07-21T21:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "meeting-progress",
        groupId: "emmanuel",
        title: "Encontro em andamento",
        description: "Descricao andamento",
        startsAt: "2026-07-20T11:00:00.000Z",
        endsAt: "2026-07-20T13:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "meeting-ended",
        groupId: "emmanuel",
        title: "Encontro encerrado",
        description: "Descricao encerrada",
        startsAt: "2026-07-20T09:00:00.000Z",
        endsAt: "2026-07-20T10:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "meeting-canceled",
        groupId: "emmanuel",
        title: "Encontro cancelado",
        description: "Descricao cancelada",
        startsAt: "2026-07-23T20:00:00.000Z",
        endsAt: "2026-07-23T21:00:00.000Z",
        canceledAt: "2026-07-19T10:00:00.000Z",
        cancellationReason: "Professor indisponivel",
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-19T10:00:00.000Z",
      },
      {
        id: "meeting-other-group",
        groupId: "a-caminho-da-luz",
        title: "Outro grupo",
        description: "Descricao grupo",
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "meeting-inactive-group",
        groupId: "grupo-inativo",
        title: "Encontro inativo",
        description: "Descricao grupo inativo",
        startsAt: "2026-07-24T20:00:00.000Z",
        endsAt: "2026-07-24T21:00:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
    ],
  });

const createHarness = (plan: HarnessPlan = {}) => {
  const committedState = buildBaseState();
  let transactionCalls = 0;
  let auditCalls = 0;

  const readContext = {
    meetingsRepository: createMemoryStudyMeetingsRepository({
      state: committedState,
      nowProvider: () => new Date(NOW),
    }),
    groupsRepository: createMemoryStudyMeetingGroupsRepository({
      state: committedState,
    }),
    auditRepository: createMemoryStudyMeetingsAuditRepository(committedState),
  };

  const transactionRunner: StudyMeetingsTransactionRunner = {
    async run(callback) {
      transactionCalls += 1;
      const workingState = cloneState(committedState);
      const baseRepository = createMemoryStudyMeetingsRepository({
        state: workingState,
        nowProvider: () => new Date(NOW),
      });
      const meetingsRepository: StudyMeetingsRepository = {
        ...baseRepository,
        async create(input) {
          if (plan.failCreateWith) {
            throw plan.failCreateWith;
          }

          return baseRepository.create(input);
        },
        async update(input) {
          if (plan.failUpdateWith) {
            throw plan.failUpdateWith;
          }

          if (plan.cancelBeforeUpdate) {
            const targetMeeting = workingState.meetings.find(
              (meeting) => meeting.id === input.meetingId && meeting.groupId === input.groupId,
            );

            if (targetMeeting) {
              targetMeeting.canceledAt = plan.cancelBeforeUpdate.canceledAt;
              targetMeeting.cancellationReason = plan.cancelBeforeUpdate.cancellationReason;
              targetMeeting.updatedAt = plan.cancelBeforeUpdate.canceledAt;
            }
          }

          return baseRepository.update(input);
        },
        async cancel(input) {
          if (plan.failCancelWith) {
            throw plan.failCancelWith;
          }

          if (plan.overrideCancelResult !== undefined) {
            return plan.overrideCancelResult;
          }

          return baseRepository.cancel(input);
        },
      };
      const auditRepository = {
        async create(entry: StudyMeetingAuditLogEntry) {
          auditCalls += 1;

          if (plan.failAuditWith) {
            throw plan.failAuditWith;
          }

          workingState.auditLogs.unshift({ ...entry });
        },
      };

      const result = await callback({
        meetingsRepository,
        groupsRepository: createMemoryStudyMeetingGroupsRepository({
          state: workingState,
        }),
        auditRepository,
      });

      committedState.groups.splice(
        0,
        committedState.groups.length,
        ...workingState.groups.map((group) => ({ ...group })),
      );
      committedState.meetings.splice(
        0,
        committedState.meetings.length,
        ...workingState.meetings.map((meeting) => ({ ...meeting })),
      );
      committedState.auditLogs.splice(
        0,
        committedState.auditLogs.length,
        ...workingState.auditLogs.map((entry) => ({ ...entry })),
      );

      return result;
    },
  };

  const dependencies: StudyMeetingsAdminServiceDependencies = {
    readContext,
    transactionRunner,
    nowProvider: () => new Date(NOW),
    memoryState: committedState,
  };

  return {
    service: createStudyMeetingsAdminService(dependencies),
    state: committedState,
    getTransactionCalls: () => transactionCalls,
    getAuditCalls: () => auditCalls,
  };
};

const expectAppError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toMatchObject({ code });
};

describe("study meetings service", () => {
  it("exige login e acesso admin", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.listMeetings(undefined, {
        groupId: "emmanuel",
        page: 1,
        pageSize: 10,
        sortOrder: "asc",
        includeCanceled: false,
      }),
      "AUTH_REQUIRED",
    );
    await expectAppError(
      harness.service.listMeetings(teacherUser, {
        groupId: "emmanuel",
        page: 1,
        pageSize: 10,
        sortOrder: "asc",
        includeCanceled: false,
      }),
      "FORBIDDEN",
    );
  });

  it("lista encontros do grupo, respeita filtros e nao usa transacao nem auditoria", async () => {
    const harness = createHarness();

    const result = await harness.service.listMeetings(adminUser, {
      groupId: "emmanuel",
      page: 1,
      pageSize: 10,
      sortOrder: "asc",
      includeCanceled: false,
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "meeting-ended",
      "meeting-progress",
      "meeting-future",
    ]);
    expect(harness.getTransactionCalls()).toBe(0);
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("permite listagem e consulta em grupo inativo, mas rejeita grupo inexistente", async () => {
    const harness = createHarness();

    await expect(
      harness.service.listMeetings(adminUser, {
        groupId: "grupo-inativo",
        page: 1,
        pageSize: 10,
        sortOrder: "asc",
        includeCanceled: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        total: 1,
      }),
    );
    await expect(
      harness.service.getMeeting(adminUser, {
        groupId: "grupo-inativo",
        meetingId: "meeting-inactive-group",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "meeting-inactive-group",
      }),
    );
    await expectAppError(
      harness.service.getMeeting(adminUser, {
        groupId: "grupo-inexistente",
        meetingId: "meeting-future",
      }),
      "STUDY_GROUP_NOT_FOUND",
    );
  });

  it("rejeita filtros invalidos na listagem", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.listMeetings(adminUser, {
        groupId: "emmanuel",
        page: 0,
        pageSize: 10,
        sortOrder: "asc",
        includeCanceled: false,
      }),
      "INVALID_STUDY_MEETING_LIST_INPUT",
    );
  });

  it("consulta encontro do grupo correto sem auditoria", async () => {
    const harness = createHarness();

    const result = await harness.service.getMeeting(adminUser, {
      groupId: "emmanuel",
      meetingId: "meeting-future",
    });

    expect(result.id).toBe("meeting-future");
    expect(harness.state.auditLogs).toHaveLength(0);
    expect(harness.getTransactionCalls()).toBe(0);
  });

  it("nao retorna encontro de outro grupo", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.getMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-other-group",
      }),
      "STUDY_MEETING_NOT_FOUND",
    );
  });

  it("cria encontro valido em grupo ativo, normaliza texto e audita sem expor dados sensiveis", async () => {
    const harness = createHarness();

    const result = await harness.service.createMeeting(adminUser, {
      groupId: "  emmanuel  ",
      title: "  Novo encontro da semana  ",
      description: "   ",
      startsAt: "2026-07-22T20:00:00.000Z",
      endsAt: "2026-07-22T21:30:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        groupId: "emmanuel",
        title: "Novo encontro da semana",
        description: null,
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:30:00.000Z",
        canceledAt: null,
      }),
    );
    expect(harness.state.meetings.find((meeting) => meeting.id === result.id)).toEqual(result);
    expect(harness.state.auditLogs[0]).toEqual(
      expect.objectContaining({
        action: "Encontro criado por admin",
        entity: `StudyMeeting ${result.id}`,
      }),
    );
    const auditPayload = JSON.stringify(harness.state.auditLogs[0]);
    expect(auditPayload).not.toContain("meetUrl");
    expect(auditPayload).not.toContain("https://meet.google.com");
  });

  it("rejeita criacao com titulo vazio, intervalo invalido, inicio igual a now, passado, grupo inexistente e grupo inativo", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "   ",
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
      "INVALID_STUDY_MEETING_INPUT",
    );
    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "Intervalo inválido",
        startsAt: "2026-07-22T21:00:00.000Z",
        endsAt: "2026-07-22T20:00:00.000Z",
      }),
      "INVALID_STUDY_MEETING_INPUT",
    );
    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "Igual a now",
        startsAt: NOW.toISOString(),
        endsAt: "2026-07-20T13:00:00.000Z",
      }),
      "STUDY_MEETING_STARTS_IN_PAST",
    );
    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "No passado",
        startsAt: "2026-07-19T20:00:00.000Z",
        endsAt: "2026-07-19T21:00:00.000Z",
      }),
      "STUDY_MEETING_STARTS_IN_PAST",
    );
    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "grupo-inexistente",
        title: "Grupo",
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
      "STUDY_GROUP_NOT_FOUND",
    );
    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "grupo-inativo",
        title: "Grupo inativo",
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
      "STUDY_GROUP_INACTIVE",
    );
  });

  it("aceita limites exatos e rejeita limite + 1 para título, descrição, motivo e identificador", async () => {
    const harness = createHarness();

    await expect(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "T".repeat(STUDY_MEETING_TITLE_MAX_LENGTH),
        description: "D".repeat(STUDY_MEETING_DESCRIPTION_MAX_LENGTH),
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: "T".repeat(STUDY_MEETING_TITLE_MAX_LENGTH),
        description: "D".repeat(STUDY_MEETING_DESCRIPTION_MAX_LENGTH),
      }),
    );

    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "T".repeat(STUDY_MEETING_TITLE_MAX_LENGTH + 1),
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
      "INVALID_STUDY_MEETING_INPUT",
    );
    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "Descrição longa",
        description: "D".repeat(STUDY_MEETING_DESCRIPTION_MAX_LENGTH + 1),
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
      "INVALID_STUDY_MEETING_INPUT",
    );
    await expectAppError(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        cancellationReason: "M".repeat(STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH + 1),
      }),
      "INVALID_STUDY_MEETING_CANCEL_INPUT",
    );
    await expectAppError(
      harness.service.getMeeting(adminUser, {
        groupId: "x".repeat(STUDY_MEETING_ID_MAX_LENGTH + 1),
        meetingId: "meeting-future",
      }),
      "INVALID_STUDY_MEETING_INPUT",
    );
    await expect(
      harness.service.listMeetings(adminUser, {
        groupId: "x".repeat(STUDY_MEETING_ID_MAX_LENGTH),
        page: 1,
        pageSize: 10,
        sortOrder: "asc",
        includeCanceled: true,
      }),
    ).rejects.toMatchObject({
      code: "STUDY_GROUP_NOT_FOUND",
    });
  });

  it("chama o relógio do service uma única vez por operação de escrita", async () => {
    let serviceNowCalls = 0;
    const state = buildBaseState();
    const repositoryNowProvider = () => new Date(NOW);
    const serviceNowProvider = () => {
      serviceNowCalls += 1;
      return new Date(NOW);
    };
    const deps: StudyMeetingsAdminServiceDependencies = {
      readContext: {
        meetingsRepository: createMemoryStudyMeetingsRepository({
          state,
          nowProvider: repositoryNowProvider,
        }),
        groupsRepository: createMemoryStudyMeetingGroupsRepository({ state }),
        auditRepository: createMemoryStudyMeetingsAuditRepository(state),
      },
      transactionRunner: createMemoryStudyMeetingsTransactionRunner(state, {
        nowProvider: repositoryNowProvider,
      }),
      nowProvider: serviceNowProvider,
      memoryState: state,
    };
    const service = createStudyMeetingsAdminService(deps);

    await service.createMeeting(adminUser, {
      groupId: "emmanuel",
      title: "Controle de relógio",
      startsAt: "2026-07-22T20:00:00.000Z",
      endsAt: "2026-07-22T21:00:00.000Z",
    });
    await service.updateMeeting(adminUser, {
      groupId: "emmanuel",
      meetingId: "meeting-future",
      title: "Controle atualizado",
    });
    await service.cancelMeeting(adminUser, {
      groupId: "emmanuel",
      meetingId: "meeting-progress",
      cancellationReason: "Pausa breve",
    });

    expect(serviceNowCalls).toBe(3);
  });

  it("atualiza titulo, descrição, datas e registra apenas campos alterados", async () => {
    const harness = createHarness();

    const result = await harness.service.updateMeeting(adminUser, {
      groupId: "emmanuel",
      meetingId: "meeting-future",
      title: "  Encontro revisado  ",
      description: "   ",
      startsAt: "2026-07-21T20:30:00.000Z",
      endsAt: "2026-07-21T21:30:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        title: "Encontro revisado",
        description: null,
        startsAt: "2026-07-21T20:30:00.000Z",
        endsAt: "2026-07-21T21:30:00.000Z",
      }),
    );
    expect(harness.state.auditLogs[0]?.note).toContain("title");
    expect(harness.state.auditLogs[0]?.note).toContain("description");
    expect(harness.state.auditLogs[0]?.note).toContain("startsAt");
    expect(harness.state.auditLogs[0]?.note).toContain("endsAt");
  });

  it("valida atualização parcial contra valores atuais", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        startsAt: "2026-07-21T22:00:00.000Z",
      }),
      "INVALID_STUDY_MEETING_INPUT",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        endsAt: "2026-07-21T19:00:00.000Z",
      }),
      "INVALID_STUDY_MEETING_INPUT",
    );
    await expect(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        description: undefined,
        title: "Título com descrição preservada",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: "Título com descrição preservada",
        description: "Descricao futura",
      }),
    );
    await expect(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        description: null,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        description: null,
      }),
    );
  });

  it("rejeita body sem alteração, encontro inexistente, outro grupo, grupo inativo, cancelado, iniciado e novo início no passado", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
      }),
      "INVALID_STUDY_MEETING_UPDATE_INPUT",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        title: "Encontro futuro",
      }),
      "STUDY_MEETING_NO_CHANGES",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-missing",
        title: "Novo título",
      }),
      "STUDY_MEETING_NOT_FOUND",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-other-group",
        title: "Novo título",
      }),
      "STUDY_MEETING_NOT_FOUND",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "grupo-inativo",
        meetingId: "meeting-inactive-group",
        title: "Novo título",
      }),
      "STUDY_GROUP_INACTIVE",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-canceled",
        title: "Novo título",
      }),
      "STUDY_MEETING_ALREADY_CANCELED",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-progress",
        title: "Novo título",
      }),
      "STUDY_MEETING_ALREADY_STARTED",
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        startsAt: "2026-07-20T11:59:00.000Z",
        endsAt: "2026-07-20T13:30:00.000Z",
      }),
      "STUDY_MEETING_STARTS_IN_PAST",
    );
  });

  it("aceita fronteiras temporais exatas de criação e atualização com diferença mínima de 1 ms", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "Igual ao agora",
        startsAt: NOW.toISOString(),
        endsAt: "2026-07-20T12:00:00.001Z",
      }),
      "STUDY_MEETING_STARTS_IN_PAST",
    );
    await expect(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "Um milissegundo no futuro",
        startsAt: "2026-07-20T12:00:00.001Z",
        endsAt: "2026-07-20T12:00:00.002Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        startsAt: "2026-07-20T12:00:00.001Z",
        endsAt: "2026-07-20T12:00:00.002Z",
      }),
    );
    await expectAppError(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        startsAt: NOW.toISOString(),
        endsAt: "2026-07-20T12:00:00.001Z",
      }),
      "STUDY_MEETING_STARTS_IN_PAST",
    );
    await expect(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        startsAt: "2026-07-20T12:00:00.001Z",
        endsAt: "2026-07-20T12:00:00.002Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        startsAt: "2026-07-20T12:00:00.001Z",
        endsAt: "2026-07-20T12:00:00.002Z",
      }),
    );
  });

  it("rejeita atualização quando o encontro é cancelado concorrentemente antes da persistência", async () => {
    const harness = createHarness({
      cancelBeforeUpdate: {
        canceledAt: "2026-07-20T12:00:00.500Z",
        cancellationReason: "Cancelamento concorrente",
      },
    });

    await expect(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        title: "Tentativa concorrente",
      }),
    ).rejects.toMatchObject({
      code: "STUDY_MEETING_ALREADY_CANCELED",
    });
    expect(harness.state.meetings.find((meeting) => meeting.id === "meeting-future")).toEqual(
      expect.objectContaining({
        canceledAt: null,
        cancellationReason: null,
        title: "Encontro futuro",
      }),
    );
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("cancela encontro futuro e em andamento, usa o now exato e preserva o registro", async () => {
    const futureHarness = createHarness();

    const futureResult = await futureHarness.service.cancelMeeting(adminUser, {
      groupId: "emmanuel",
      meetingId: "meeting-future",
      cancellationReason: "  Reagendamento da aula  ",
    });

    expect(futureResult.canceledAt).toBe(NOW.toISOString());
    expect(futureResult.cancellationReason).toBe("Reagendamento da aula");
    expect(futureHarness.state.meetings.find((meeting) => meeting.id === "meeting-future")).toEqual(
      expect.objectContaining({
        canceledAt: NOW.toISOString(),
        cancellationReason: "Reagendamento da aula",
      }),
    );
    expect(futureHarness.state.auditLogs[0]?.note).not.toContain("Reagendamento da aula");

    const progressHarness = createHarness();
    await expect(
      progressHarness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-progress",
        cancellationReason: "Interrupção temporária",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        canceledAt: NOW.toISOString(),
      }),
    );
  });

  it("permite cancelar encontro de grupo inativo", async () => {
    const harness = createHarness();

    await expect(
      harness.service.cancelMeeting(adminUser, {
        groupId: "grupo-inativo",
        meetingId: "meeting-inactive-group",
        cancellationReason: "Grupo suspenso",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        groupId: "grupo-inativo",
        canceledAt: NOW.toISOString(),
      }),
    );
  });

  it("rejeita cancelamento sem motivo, de encontro inexistente, de outro grupo, encerrado e já cancelado", async () => {
    const harness = createHarness();

    await expectAppError(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        cancellationReason: "   ",
      }),
      "INVALID_STUDY_MEETING_CANCEL_INPUT",
    );
    await expectAppError(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-missing",
        cancellationReason: "Motivo",
      }),
      "STUDY_MEETING_NOT_FOUND",
    );
    await expectAppError(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-other-group",
        cancellationReason: "Motivo",
      }),
      "STUDY_MEETING_NOT_FOUND",
    );
    await expectAppError(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-ended",
        cancellationReason: "Motivo",
      }),
      "STUDY_MEETING_ALREADY_ENDED",
    );
    await expectAppError(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-canceled",
        cancellationReason: "Motivo",
      }),
      "STUDY_MEETING_ALREADY_CANCELED",
    );
    await expect(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        cancellationReason: "M".repeat(STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        cancellationReason: "M".repeat(STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH),
      }),
    );
  });

  it("preserva data e motivo do primeiro cancelamento quando uma segunda tentativa acontece", async () => {
    const harness = createHarness();

    await harness.service.cancelMeeting(adminUser, {
      groupId: "emmanuel",
      meetingId: "meeting-future",
      cancellationReason: "Primeiro motivo",
    });

    await expectAppError(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        cancellationReason: "Segundo motivo",
      }),
      "STUDY_MEETING_ALREADY_CANCELED",
    );

    expect(harness.state.meetings.find((meeting) => meeting.id === "meeting-future")).toEqual(
      expect.objectContaining({
        canceledAt: NOW.toISOString(),
        cancellationReason: "Primeiro motivo",
      }),
    );
  });
});
