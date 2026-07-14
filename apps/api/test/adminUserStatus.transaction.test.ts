import { Prisma, UserRole as PrismaUserRole, UserStatus as PrismaUserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { AdminUserStatusUpdateInput } from "../src/modules/auth/auth.repository";
import { updateAdminUserStatusWithPrisma } from "../src/modules/auth/auth.repository";

type HarnessUser = {
  id: string;
  role: PrismaUserRole;
  status: PrismaUserStatus;
  accountActivatedAt: Date | null;
};

type HarnessSession = {
  id: string;
  userId: string;
  revokedAt: Date | null;
};

type HarnessAuditLog = {
  actorName: string;
  actorRole: PrismaUserRole;
  action: string;
  entity: string;
  note: string;
};

type HarnessState = {
  users: HarnessUser[];
  sessions: HarnessSession[];
  auditLogs: HarnessAuditLog[];
};

type AttemptPlan = {
  userUpdateManyCountOverride?: number;
  authSessionUpdateManyError?: Error;
  auditLogCreateError?: Error;
  beforeCommit?: (workingState: HarnessState, committedState: HarnessState) => Promise<void> | void;
  afterCommit?: (committedState: HarnessState) => Promise<void> | void;
  throwAfterCallback?: unknown;
};

const cloneDate = (value: Date | null) => (value ? new Date(value) : null);

const cloneState = (state: HarnessState): HarnessState => ({
  users: state.users.map((user) => ({
    ...user,
    accountActivatedAt: cloneDate(user.accountActivatedAt),
  })),
  sessions: state.sessions.map((session) => ({
    ...session,
    revokedAt: cloneDate(session.revokedAt),
  })),
  auditLogs: state.auditLogs.map((entry) => ({
    ...entry,
  })),
});

const createPrismaKnownError = (code: string) =>
  Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    name: "PrismaClientKnownRequestError",
    code,
    clientVersion: "test",
  }) as Prisma.PrismaClientKnownRequestError;

class FakeAdminUserStatusPrisma {
  private readonly plans: AttemptPlan[];
  private attemptIndex = 0;
  state: HarnessState;
  readonly transactionOptions: Array<{
    isolationLevel: Prisma.TransactionIsolationLevel;
  }> = [];

  constructor(initialState: HarnessState, plans: AttemptPlan[] = []) {
    this.state = cloneState(initialState);
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

    const workingState = cloneState(this.state);
    const transaction = {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const user = workingState.users.find((entry) => entry.id === where.id);
          return user
            ? {
                ...user,
                accountActivatedAt: cloneDate(user.accountActivatedAt),
              }
            : null;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; status: PrismaUserStatus };
          data: { status: PrismaUserStatus };
        }) => {
          if (plan.userUpdateManyCountOverride !== undefined) {
            return { count: plan.userUpdateManyCountOverride };
          }

          const user = workingState.users.find(
            (entry) => entry.id === where.id && entry.status === where.status,
          );

          if (!user) {
            return { count: 0 };
          }

          user.status = data.status;
          return { count: 1 };
        },
      },
      authSession: {
        updateMany: async ({
          where,
          data,
        }: {
          where: { userId: string; revokedAt: null };
          data: { revokedAt: Date };
        }) => {
          if (plan.authSessionUpdateManyError) {
            throw plan.authSessionUpdateManyError;
          }

          let count = 0;
          for (const session of workingState.sessions) {
            if (session.userId === where.userId && session.revokedAt === where.revokedAt) {
              session.revokedAt = new Date(data.revokedAt);
              count += 1;
            }
          }

          return { count };
        },
      },
      auditLog: {
        create: async ({ data }: { data: HarnessAuditLog }) => {
          if (plan.auditLogCreateError) {
            throw plan.auditLogCreateError;
          }

          workingState.auditLogs.unshift({
            ...data,
          });

          return data;
        },
      },
    };

    const result = await callback(transaction);
    await plan.beforeCommit?.(workingState, this.state);

    if (plan.throwAfterCallback) {
      throw plan.throwAfterCallback;
    }

    this.state = workingState;
    await plan.afterCommit?.(this.state);

    return result;
  }
}

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
};

const buildStatusInput = (
  actorUserId: string,
  targetUserId: string,
  nextStatus: "active" | "inactive" = "inactive",
): AdminUserStatusUpdateInput => ({
  actorUserId,
  actorName: actorUserId,
  actorRole: "admin",
  targetUserId,
  nextStatus,
});

const buildBaseState = (): HarnessState => ({
  users: [
    {
      id: "admin-actor",
      role: PrismaUserRole.ADMIN,
      status: PrismaUserStatus.ACTIVE,
      accountActivatedAt: new Date("2026-07-14T09:00:00.000Z"),
    },
    {
      id: "student-target",
      role: PrismaUserRole.STUDENT,
      status: PrismaUserStatus.ACTIVE,
      accountActivatedAt: new Date("2026-07-14T09:05:00.000Z"),
    },
  ],
  sessions: [
    {
      id: "session-student-1",
      userId: "student-target",
      revokedAt: null,
    },
    {
      id: "session-student-2",
      userId: "student-target",
      revokedAt: null,
    },
  ],
  auditLogs: [],
});

const buildAdminRaceState = (): HarnessState => ({
  users: [
    {
      id: "admin-a",
      role: PrismaUserRole.ADMIN,
      status: PrismaUserStatus.ACTIVE,
      accountActivatedAt: new Date("2026-07-14T09:00:00.000Z"),
    },
    {
      id: "admin-b",
      role: PrismaUserRole.ADMIN,
      status: PrismaUserStatus.ACTIVE,
      accountActivatedAt: new Date("2026-07-14T09:01:00.000Z"),
    },
  ],
  sessions: [
    {
      id: "session-admin-a",
      userId: "admin-a",
      revokedAt: null,
    },
    {
      id: "session-admin-b",
      userId: "admin-b",
      revokedAt: null,
    },
  ],
  auditLogs: [],
});

const expectSerializableTransactions = (runner: FakeAdminUserStatusPrisma, expectedAttempts: number) => {
  expect(runner.transactionOptions).toHaveLength(expectedAttempts);
  expect(
    runner.transactionOptions.every(
      (option) => option.isolationLevel === Prisma.TransactionIsolationLevel.Serializable,
    ),
  ).toBe(true);
};

describe("admin user status transactions", () => {
  it("faz retry apos P2034 e persiste apenas o commit vencedor", async () => {
    const runner = new FakeAdminUserStatusPrisma(buildBaseState(), [
      {
        throwAfterCallback: createPrismaKnownError("P2034"),
      },
      {},
    ]);

    const result = await updateAdminUserStatusWithPrisma(
      runner,
      buildStatusInput("admin-actor", "student-target"),
    );

    expect(result).toEqual({
      status: "updated",
      userId: "student-target",
      previousStatus: "active",
      currentStatus: "inactive",
      revokedSessions: 2,
    });
    expectSerializableTransactions(runner, 2);
    expect(runner.state.users.find((user) => user.id === "student-target")?.status).toBe(
      PrismaUserStatus.INACTIVE,
    );
    expect(runner.state.sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
    expect(runner.state.auditLogs).toHaveLength(1);
  });

  it("converte P2034 em conflito apos esgotar as tentativas", async () => {
    const runner = new FakeAdminUserStatusPrisma(buildBaseState(), [
      { throwAfterCallback: createPrismaKnownError("P2034") },
      { throwAfterCallback: createPrismaKnownError("P2034") },
      { throwAfterCallback: createPrismaKnownError("P2034") },
    ]);

    const result = await updateAdminUserStatusWithPrisma(
      runner,
      buildStatusInput("admin-actor", "student-target"),
    );

    expect(result).toEqual({ status: "conflict" });
    expectSerializableTransactions(runner, 3);
    expect(runner.state.users.find((user) => user.id === "student-target")?.status).toBe(
      PrismaUserStatus.ACTIVE,
    );
    expect(runner.state.sessions.every((session) => session.revokedAt === null)).toBe(true);
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("nao faz retry para erro nao serializavel", async () => {
    const error = new Error("falha inesperada");
    const runner = new FakeAdminUserStatusPrisma(buildBaseState(), [
      {
        throwAfterCallback: error,
      },
    ]);

    await expect(
      updateAdminUserStatusWithPrisma(runner, buildStatusInput("admin-actor", "student-target")),
    ).rejects.toThrow("falha inesperada");

    expectSerializableTransactions(runner, 1);
    expect(runner.state.users.find((user) => user.id === "student-target")?.status).toBe(
      PrismaUserStatus.ACTIVE,
    );
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("retorna conflito quando o update condicional nao afeta nenhuma linha", async () => {
    const runner = new FakeAdminUserStatusPrisma(buildBaseState(), [
      {
        userUpdateManyCountOverride: 0,
      },
    ]);

    const result = await updateAdminUserStatusWithPrisma(
      runner,
      buildStatusInput("admin-actor", "student-target"),
    );

    expect(result).toEqual({ status: "conflict" });
    expectSerializableTransactions(runner, 1);
    expect(runner.state.users.find((user) => user.id === "student-target")?.status).toBe(
      PrismaUserStatus.ACTIVE,
    );
    expect(runner.state.sessions.every((session) => session.revokedAt === null)).toBe(true);
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("faz rollback quando a revogacao de sessoes falha", async () => {
    const runner = new FakeAdminUserStatusPrisma(buildBaseState(), [
      {
        authSessionUpdateManyError: new Error("falha ao revogar sessoes"),
      },
    ]);

    await expect(
      updateAdminUserStatusWithPrisma(runner, buildStatusInput("admin-actor", "student-target")),
    ).rejects.toThrow("falha ao revogar sessoes");

    expectSerializableTransactions(runner, 1);
    expect(runner.state.users.find((user) => user.id === "student-target")?.status).toBe(
      PrismaUserStatus.ACTIVE,
    );
    expect(runner.state.sessions.every((session) => session.revokedAt === null)).toBe(true);
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("faz rollback quando a auditoria falha apos atualizar status e sessoes", async () => {
    const runner = new FakeAdminUserStatusPrisma(buildBaseState(), [
      {
        auditLogCreateError: new Error("falha ao gravar auditoria"),
      },
    ]);

    await expect(
      updateAdminUserStatusWithPrisma(runner, buildStatusInput("admin-actor", "student-target")),
    ).rejects.toThrow("falha ao gravar auditoria");

    expectSerializableTransactions(runner, 1);
    expect(runner.state.users.find((user) => user.id === "student-target")?.status).toBe(
      PrismaUserStatus.ACTIVE,
    );
    expect(runner.state.sessions.every((session) => session.revokedAt === null)).toBe(true);
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("mantem um admin autenticavel quando dois admins tentam se inativar ao mesmo tempo", async () => {
    const firstTransactionReady = createDeferred();
    const allowFirstCommit = createDeferred();
    const firstCommitDone = createDeferred();
    const secondTransactionReady = createDeferred();

    const runner = new FakeAdminUserStatusPrisma(buildAdminRaceState(), [
      {
        beforeCommit: async () => {
          firstTransactionReady.resolve();
          await allowFirstCommit.promise;
        },
        afterCommit: async () => {
          firstCommitDone.resolve();
        },
      },
      {
        beforeCommit: async () => {
          secondTransactionReady.resolve();
          await firstCommitDone.promise;
        },
        throwAfterCallback: createPrismaKnownError("P2034"),
      },
      {},
    ]);

    const deactivateAdminBPromise = updateAdminUserStatusWithPrisma(
      runner,
      buildStatusInput("admin-a", "admin-b"),
    );
    await firstTransactionReady.promise;

    const deactivateAdminAPromise = updateAdminUserStatusWithPrisma(
      runner,
      buildStatusInput("admin-b", "admin-a"),
    );
    await secondTransactionReady.promise;

    allowFirstCommit.resolve();

    const firstResult = await deactivateAdminBPromise;
    const secondResult = await deactivateAdminAPromise;

    expect(firstResult).toEqual({
      status: "updated",
      userId: "admin-b",
      previousStatus: "active",
      currentStatus: "inactive",
      revokedSessions: 1,
    });
    expect(secondResult).toEqual({ status: "actor_not_authorized" });
    expectSerializableTransactions(runner, 3);

    expect(runner.state.users.find((user) => user.id === "admin-a")?.status).toBe(
      PrismaUserStatus.ACTIVE,
    );
    expect(runner.state.users.find((user) => user.id === "admin-b")?.status).toBe(
      PrismaUserStatus.INACTIVE,
    );
    expect(runner.state.sessions.find((session) => session.userId === "admin-a")?.revokedAt).toBeNull();
    expect(runner.state.sessions.find((session) => session.userId === "admin-b")?.revokedAt).toEqual(
      expect.any(Date),
    );
    expect(runner.state.auditLogs).toHaveLength(1);
  });
});
