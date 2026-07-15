import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { AuthUser } from "../src/modules/auth/auth.types";
import {
  StudyMeetingsTransactionConflictError,
  createMemoryStudyMeetingGroupsRepository,
  createMemoryStudyMeetingsRepository,
  createMemoryStudyMeetingsState,
  createPrismaStudyMeetingsTransactionRunner,
  type MemoryStudyMeetingsState,
  type StudyMeetingAuditLogEntry,
  type StudyMeetingsRepository,
  type StudyMeetingsTransactionRunner,
} from "../src/modules/study-meetings/study-meetings.repository";
import {
  createStudyMeetingsAdminService,
  type StudyMeetingsAdminServiceDependencies,
} from "../src/modules/study-meetings/study-meetings.service";
import type { StudyMeetingRecord } from "../src/modules/study-meetings/study-meetings.types";

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

type TransactionPlan = {
  failCreateWith?: Error;
  failUpdateWith?: Error;
  failCancelWith?: Error;
  failAuditWith?: Error;
  overrideCancelResult?: StudyMeetingRecord | null;
  throwAfterCallback?: unknown;
};

const cloneState = (state: MemoryStudyMeetingsState): MemoryStudyMeetingsState => ({
  groups: state.groups.map((group) => ({ ...group })),
  meetings: state.meetings.map((meeting) => ({ ...meeting })),
  auditLogs: state.auditLogs.map((entry) => ({ ...entry })),
});

const buildBaseState = () =>
  createMemoryStudyMeetingsState({
    groups: [{ id: "emmanuel", name: "Emmanuel", status: "active" }],
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
    ],
  });

const createTransactionHarness = (plan: TransactionPlan = {}) => {
  const committedState = buildBaseState();
  let auditCalls = 0;

  const readContext = {
    meetingsRepository: createMemoryStudyMeetingsRepository({
      state: committedState,
      nowProvider: () => new Date(NOW),
    }),
    groupsRepository: createMemoryStudyMeetingGroupsRepository({
      state: committedState,
    }),
    auditRepository: {
      async create(entry: StudyMeetingAuditLogEntry) {
        committedState.auditLogs.unshift({ ...entry });
      },
    },
  };

  const transactionRunner: StudyMeetingsTransactionRunner = {
    async run(callback) {
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
      const result = await callback({
        meetingsRepository,
        groupsRepository: createMemoryStudyMeetingGroupsRepository({
          state: workingState,
        }),
        auditRepository: {
          async create(entry: StudyMeetingAuditLogEntry) {
            auditCalls += 1;

            if (plan.failAuditWith) {
              throw plan.failAuditWith;
            }

            workingState.auditLogs.unshift({ ...entry });
          },
        },
      });

      if (plan.throwAfterCallback) {
        throw plan.throwAfterCallback;
      }

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

  const service = createStudyMeetingsAdminService({
    readContext,
    transactionRunner,
    nowProvider: () => new Date(NOW),
    memoryState: committedState,
  } satisfies StudyMeetingsAdminServiceDependencies);

  return {
    service,
    state: committedState,
    getAuditCalls: () => auditCalls,
  };
};

const createPrismaKnownError = (code: string) =>
  Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    name: "PrismaClientKnownRequestError",
    code,
    clientVersion: "test",
  }) as Prisma.PrismaClientKnownRequestError;

type PrismaRunnerPlan = {
  throwAfterCallback?: unknown;
};

class FakeStudyMeetingsTransactionPrisma {
  private readonly plans: PrismaRunnerPlan[];
  private attemptIndex = 0;
  readonly transactionOptions: Array<{
    isolationLevel: Prisma.TransactionIsolationLevel;
  }> = [];
  readonly state = {
    groups: [{ id: "emmanuel", name: "Emmanuel", status: "ACTIVE" as const }],
    meetings: [] as Array<{
      id: string;
      groupId: string;
      title: string;
      description: string | null;
      startsAt: Date;
      endsAt: Date;
      canceledAt: Date | null;
      cancellationReason: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
    auditLogs: [] as Array<{
      actorName: string;
      actorRole: Prisma.UserRole;
      action: string;
      entity: string;
      note: string;
    }>,
  };

  constructor(plans: PrismaRunnerPlan[] = []) {
    this.plans = plans;
  }

  async $transaction<T>(
    callback: (transaction: unknown) => Promise<T>,
    options: {
      isolationLevel: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    this.transactionOptions.push(options);
    const plan = this.plans[this.attemptIndex] ?? {};
    this.attemptIndex += 1;
    const workingState = {
      groups: this.state.groups.map((group) => ({ ...group })),
      meetings: this.state.meetings.map((meeting) => ({
        ...meeting,
        startsAt: new Date(meeting.startsAt),
        endsAt: new Date(meeting.endsAt),
        canceledAt: meeting.canceledAt ? new Date(meeting.canceledAt) : null,
        createdAt: new Date(meeting.createdAt),
        updatedAt: new Date(meeting.updatedAt),
      })),
      auditLogs: this.state.auditLogs.map((entry) => ({ ...entry })),
    };
    let sequence = workingState.meetings.length + 1;

    const transaction = {
      studyGroup: {
        findUnique: async (args: { where: { id: string } }) => {
          return workingState.groups.find((group) => group.id === args.where.id) ?? null;
        },
      },
      studyMeeting: {
        create: async (args: {
          data: {
            groupId: string;
            title: string;
            description: string | null;
            startsAt: Date;
            endsAt: Date;
          };
        }) => {
          const createdAt = new Date("2026-07-20T12:00:00.000Z");
          const row = {
            id: `meeting-${sequence++}`,
            groupId: args.data.groupId,
            title: args.data.title,
            description: args.data.description,
            startsAt: new Date(args.data.startsAt),
            endsAt: new Date(args.data.endsAt),
            canceledAt: null,
            cancellationReason: null,
            createdAt,
            updatedAt: new Date(createdAt),
          };

          workingState.meetings.push(row);
          return { ...row };
        },
      },
      auditLog: {
        create: async (args: {
          data: {
            actorName: string;
            actorRole: Prisma.UserRole;
            action: string;
            entity: string;
            note: string;
          };
        }) => {
          workingState.auditLogs.unshift({ ...args.data });
        },
      },
    };

    const result = await callback(transaction);

    if (plan.throwAfterCallback) {
      throw plan.throwAfterCallback;
    }

    this.state.groups = workingState.groups;
    this.state.meetings = workingState.meetings;
    this.state.auditLogs = workingState.auditLogs;
    return result;
  }
}

describe("study meetings transactions", () => {
  it("confirma criação e auditoria na mesma operação", async () => {
    const harness = createTransactionHarness();

    const result = await harness.service.createMeeting(adminUser, {
      groupId: "emmanuel",
      title: "Novo encontro",
      startsAt: "2026-07-22T20:00:00.000Z",
      endsAt: "2026-07-22T21:00:00.000Z",
    });

    expect(harness.state.meetings.find((meeting) => meeting.id === result.id)).toEqual(result);
    expect(harness.state.auditLogs).toHaveLength(1);
    expect(harness.state.auditLogs[0]?.entity).toBe(`StudyMeeting ${result.id}`);
  });

  it("faz rollback da criação quando a auditoria falha", async () => {
    const harness = createTransactionHarness({
      failAuditWith: new Error("falha na auditoria"),
    });
    const totalBefore = harness.state.meetings.length;

    await expect(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "Novo encontro",
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
    ).rejects.toThrow("falha na auditoria");

    expect(harness.state.meetings).toHaveLength(totalBefore);
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("não grava auditoria quando a persistência da criação falha", async () => {
    const harness = createTransactionHarness({
      failCreateWith: new Error("falha na persistência"),
    });

    await expect(
      harness.service.createMeeting(adminUser, {
        groupId: "emmanuel",
        title: "Novo encontro",
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      }),
    ).rejects.toThrow("falha na persistência");

    expect(harness.getAuditCalls()).toBe(0);
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("faz rollback da atualização quando a auditoria falha", async () => {
    const harness = createTransactionHarness({
      failAuditWith: new Error("falha na auditoria"),
    });
    const previousTitle = harness.state.meetings[0]?.title;

    await expect(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        title: "Título revisado",
      }),
    ).rejects.toThrow("falha na auditoria");

    expect(harness.state.meetings[0]?.title).toBe(previousTitle);
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("não grava auditoria quando a persistência da atualização falha", async () => {
    const harness = createTransactionHarness({
      failUpdateWith: new Error("falha na persistência"),
    });

    await expect(
      harness.service.updateMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        title: "Título revisado",
      }),
    ).rejects.toThrow("falha na persistência");

    expect(harness.getAuditCalls()).toBe(0);
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("faz rollback do cancelamento quando a auditoria falha", async () => {
    const harness = createTransactionHarness({
      failAuditWith: new Error("falha na auditoria"),
    });

    await expect(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        cancellationReason: "Motivo",
      }),
    ).rejects.toThrow("falha na auditoria");

    expect(harness.state.meetings[0]?.canceledAt).toBeNull();
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("não grava auditoria quando a persistência do cancelamento falha", async () => {
    const harness = createTransactionHarness({
      failCancelWith: new Error("falha na persistência"),
    });

    await expect(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        cancellationReason: "Motivo",
      }),
    ).rejects.toThrow("falha na persistência");

    expect(harness.getAuditCalls()).toBe(0);
    expect(harness.state.auditLogs).toHaveLength(0);
  });

  it("converte conflito concorrente do runner em AppError previsível", async () => {
    const harness = createTransactionHarness({
      throwAfterCallback: new StudyMeetingsTransactionConflictError(),
    });

    await expect(harness.service.updateMeeting(adminUser, {
      groupId: "emmanuel",
      meetingId: "meeting-future",
      title: "Título revisado",
    })).rejects.toMatchObject({
      code: "STUDY_MEETING_CONFLICT",
    });
  });

  it("faz retry após P2034, usa serializable e persiste apenas mutação e auditoria vencedoras", async () => {
    const prisma = new FakeStudyMeetingsTransactionPrisma([
      { throwAfterCallback: createPrismaKnownError("P2034") },
      {},
    ]);
    const runner = createPrismaStudyMeetingsTransactionRunner(prisma);

    const result = await runner.run(async (context) => {
      const meeting = await context.meetingsRepository.create({
        groupId: "emmanuel",
        title: "Encontro com retry",
        description: null,
        startsAt: "2026-07-22T20:00:00.000Z",
        endsAt: "2026-07-22T21:00:00.000Z",
      });

      await context.auditRepository.create({
        actorName: "Admin",
        actorRole: "admin",
        action: "Encontro criado por admin",
        entity: `StudyMeeting ${meeting.id}`,
        note: "Tentativa vencedora.",
      });

      return meeting;
    });

    expect(result.id).toBe("meeting-1");
    expect(prisma.transactionOptions).toHaveLength(2);
    expect(
      prisma.transactionOptions.every(
        (option) => option.isolationLevel === Prisma.TransactionIsolationLevel.Serializable,
      ),
    ).toBe(true);
    expect(prisma.state.meetings).toHaveLength(1);
    expect(prisma.state.auditLogs).toHaveLength(1);
  });

  it("converte P2034 repetido em conflito sem duplicar mutação nem auditoria", async () => {
    const prisma = new FakeStudyMeetingsTransactionPrisma([
      { throwAfterCallback: createPrismaKnownError("P2034") },
      { throwAfterCallback: createPrismaKnownError("P2034") },
      { throwAfterCallback: createPrismaKnownError("P2034") },
    ]);
    const runner = createPrismaStudyMeetingsTransactionRunner(prisma);

    await expect(
      runner.run(async (context) => {
        const meeting = await context.meetingsRepository.create({
          groupId: "emmanuel",
          title: "Encontro com conflito",
          description: null,
          startsAt: "2026-07-22T20:00:00.000Z",
          endsAt: "2026-07-22T21:00:00.000Z",
        });

        await context.auditRepository.create({
          actorName: "Admin",
          actorRole: "admin",
          action: "Encontro criado por admin",
          entity: `StudyMeeting ${meeting.id}`,
          note: "Tentativa que conflita.",
        });
      }),
    ).rejects.toBeInstanceOf(StudyMeetingsTransactionConflictError);

    expect(prisma.transactionOptions).toHaveLength(3);
    expect(prisma.state.meetings).toHaveLength(0);
    expect(prisma.state.auditLogs).toHaveLength(0);
  });

  it("não faz retry para erro diferente de P2034", async () => {
    const prisma = new FakeStudyMeetingsTransactionPrisma([
      { throwAfterCallback: new Error("falha inesperada") },
    ]);
    const runner = createPrismaStudyMeetingsTransactionRunner(prisma);

    await expect(
      runner.run(async (context) => {
        await context.meetingsRepository.create({
          groupId: "emmanuel",
          title: "Encontro sem retry",
          description: null,
          startsAt: "2026-07-22T20:00:00.000Z",
          endsAt: "2026-07-22T21:00:00.000Z",
        });
      }),
    ).rejects.toThrow("falha inesperada");

    expect(prisma.transactionOptions).toHaveLength(1);
    expect(prisma.state.meetings).toHaveLength(0);
    expect(prisma.state.auditLogs).toHaveLength(0);
  });

  it("trata cancelamento concorrente como conflito de encontro já cancelado", async () => {
    const harness = createTransactionHarness({
      overrideCancelResult: {
        id: "meeting-future",
        groupId: "emmanuel",
        title: "Encontro futuro",
        description: "Descricao futura",
        startsAt: "2026-07-21T20:00:00.000Z",
        endsAt: "2026-07-21T21:00:00.000Z",
        canceledAt: "2026-07-20T12:05:00.000Z",
        cancellationReason: "Outro cancelamento",
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-20T12:05:00.000Z",
      },
    });

    await expect(
      harness.service.cancelMeeting(adminUser, {
        groupId: "emmanuel",
        meetingId: "meeting-future",
        cancellationReason: "Motivo local",
      }),
    ).rejects.toMatchObject({
      code: "STUDY_MEETING_ALREADY_CANCELED",
    });
  });
});
