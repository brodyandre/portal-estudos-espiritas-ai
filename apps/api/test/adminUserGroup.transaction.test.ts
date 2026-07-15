import {
  GroupStatus as PrismaGroupStatus,
  Prisma,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  type AdminUserGroupUpdateInput,
  updateAdminUserGroupWithPrisma,
} from "../src/modules/auth/auth.repository";

type HarnessUser = {
  id: string;
  role: PrismaUserRole;
  status: PrismaUserStatus;
  accountActivatedAt: Date | null;
  groupName: string | null;
  groupSlug: string | null;
};

type HarnessGroup = {
  id: string;
  name: string;
  status: PrismaGroupStatus;
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
  groups: HarnessGroup[];
  auditLogs: HarnessAuditLog[];
};

type AttemptPlan = {
  userUpdateManyCountOverride?: number;
  auditLogCreateError?: Error;
  throwAfterCallback?: unknown;
};

const cloneDate = (value: Date | null) => (value ? new Date(value) : null);

const cloneState = (state: HarnessState): HarnessState => ({
  users: state.users.map((user) => ({ ...user, accountActivatedAt: cloneDate(user.accountActivatedAt) })),
  groups: state.groups.map((group) => ({ ...group })),
  auditLogs: state.auditLogs.map((entry) => ({ ...entry })),
});

const createPrismaKnownError = (code: string) =>
  Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    name: "PrismaClientKnownRequestError",
    code,
    clientVersion: "test",
  }) as Prisma.PrismaClientKnownRequestError;

class FakeAdminUserGroupPrisma {
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
        findUnique: async (args: { where: { id: string } }) => {
          return workingState.users.find((user) => user.id === args.where.id) ?? null;
        },
        updateMany: async (args: {
          where: {
            id: string;
            groupName: string | null;
            groupSlug: string | null;
          };
          data: {
            groupName: string | null;
            groupSlug: string | null;
          };
        }) => {
          if (plan.userUpdateManyCountOverride !== undefined) {
            return { count: plan.userUpdateManyCountOverride };
          }

          const user = workingState.users.find(
            (item) =>
              item.id === args.where.id &&
              item.groupName === args.where.groupName &&
              item.groupSlug === args.where.groupSlug,
          );

          if (!user) {
            return { count: 0 };
          }

          user.groupName = args.data.groupName;
          user.groupSlug = args.data.groupSlug;
          return { count: 1 };
        },
      },
      studyGroup: {
        findUnique: async (args: { where: { id: string } }) => {
          return workingState.groups.find((group) => group.id === args.where.id) ?? null;
        },
      },
      auditLog: {
        create: async (args: { data: HarnessAuditLog }) => {
          if (plan.auditLogCreateError) {
            throw plan.auditLogCreateError;
          }

          workingState.auditLogs.unshift({ ...args.data });
        },
      },
    };

    const result = await callback(transaction);

    if (plan.throwAfterCallback) {
      throw plan.throwAfterCallback;
    }

    this.state = workingState;
    return result;
  }
}

const buildState = (): HarnessState => ({
  users: [
    {
      id: "admin-actor",
      role: PrismaUserRole.ADMIN,
      status: PrismaUserStatus.ACTIVE,
      accountActivatedAt: new Date("2026-07-14T10:00:00.000Z"),
      groupName: null,
      groupSlug: null,
    },
    {
      id: "student-target",
      role: PrismaUserRole.STUDENT,
      status: PrismaUserStatus.ACTIVE,
      accountActivatedAt: new Date("2026-07-14T10:00:00.000Z"),
      groupName: null,
      groupSlug: null,
    },
  ],
  groups: [
    {
      id: "emmanuel",
      name: "Emmanuel",
      status: PrismaGroupStatus.ACTIVE,
    },
    {
      id: "grupo-inativo",
      name: "Grupo Inativo",
      status: PrismaGroupStatus.INACTIVE,
    },
  ],
  auditLogs: [],
});

const buildInput = (
  targetUserId = "student-target",
  nextGroupSlug: string | null = "emmanuel",
): AdminUserGroupUpdateInput => ({
  actorUserId: "admin-actor",
  actorName: "Admin",
  actorRole: "admin",
  targetUserId,
  nextGroupSlug,
});

const expectSerializableTransactions = (runner: FakeAdminUserGroupPrisma, expectedAttempts: number) => {
  expect(runner.transactionOptions).toHaveLength(expectedAttempts);
  expect(
    runner.transactionOptions.every(
      (option) => option.isolationLevel === Prisma.TransactionIsolationLevel.Serializable,
    ),
  ).toBe(true);
};

describe("admin user group transactions", () => {
  it("atualiza grupo e auditoria na mesma transacao serializable", async () => {
    const runner = new FakeAdminUserGroupPrisma(buildState());

    const result = await updateAdminUserGroupWithPrisma(runner, buildInput());

    expect(result).toEqual({
      status: "updated",
      userId: "student-target",
      previousGroupName: null,
      previousGroupSlug: null,
      groupName: "Emmanuel",
      groupSlug: "emmanuel",
    });
    expectSerializableTransactions(runner, 1);
    expect(runner.state.users.find((user) => user.id === "student-target")).toEqual(
      expect.objectContaining({
        groupName: "Emmanuel",
        groupSlug: "emmanuel",
        status: PrismaUserStatus.ACTIVE,
      }),
    );
    expect(runner.state.auditLogs).toHaveLength(1);
    expect(runner.state.auditLogs[0]).toEqual(
      expect.objectContaining({
        action: "Grupo de usuário alterado por admin",
        entity: "User student-target",
      }),
    );
  });

  it("faz retry apos P2034 e persiste apenas tentativa vencedora", async () => {
    const runner = new FakeAdminUserGroupPrisma(buildState(), [
      { throwAfterCallback: createPrismaKnownError("P2034") },
      {},
    ]);

    const result = await updateAdminUserGroupWithPrisma(runner, buildInput());

    expect(result.status).toBe("updated");
    expectSerializableTransactions(runner, 2);
    expect(runner.state.users.find((user) => user.id === "student-target")?.groupSlug).toBe(
      "emmanuel",
    );
    expect(runner.state.auditLogs).toHaveLength(1);
  });

  it("converte P2034 em conflito apos esgotar retries", async () => {
    const runner = new FakeAdminUserGroupPrisma(buildState(), [
      { throwAfterCallback: createPrismaKnownError("P2034") },
      { throwAfterCallback: createPrismaKnownError("P2034") },
      { throwAfterCallback: createPrismaKnownError("P2034") },
    ]);

    const result = await updateAdminUserGroupWithPrisma(runner, buildInput());

    expect(result).toEqual({ status: "conflict" });
    expectSerializableTransactions(runner, 3);
    expect(runner.state.users.find((user) => user.id === "student-target")?.groupSlug).toBeNull();
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("retorna conflito quando update condicional nao afeta linhas", async () => {
    const runner = new FakeAdminUserGroupPrisma(buildState(), [
      { userUpdateManyCountOverride: 0 },
    ]);

    const result = await updateAdminUserGroupWithPrisma(runner, buildInput());

    expect(result).toEqual({ status: "conflict" });
    expect(runner.state.users.find((user) => user.id === "student-target")?.groupSlug).toBeNull();
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("faz rollback quando auditoria falha", async () => {
    const runner = new FakeAdminUserGroupPrisma(buildState(), [
      { auditLogCreateError: new Error("falha ao gravar auditoria") },
    ]);

    await expect(updateAdminUserGroupWithPrisma(runner, buildInput())).rejects.toThrow(
      "falha ao gravar auditoria",
    );

    expectSerializableTransactions(runner, 1);
    expect(runner.state.users.find((user) => user.id === "student-target")?.groupSlug).toBeNull();
    expect(runner.state.auditLogs).toHaveLength(0);
  });

  it("retorna erros de dominio para ator, usuario, grupo inexistente, inativo e estados iguais", async () => {
    const actorState = buildState();
    const actor = actorState.users.find((user) => user.id === "admin-actor");
    if (actor) {
      actor.role = PrismaUserRole.STUDENT;
    }
    await expect(updateAdminUserGroupWithPrisma(new FakeAdminUserGroupPrisma(actorState), buildInput()))
      .resolves.toEqual({ status: "actor_not_authorized" });

    await expect(
      updateAdminUserGroupWithPrisma(new FakeAdminUserGroupPrisma(buildState()), buildInput("missing")),
    ).resolves.toEqual({ status: "not_found" });

    await expect(
      updateAdminUserGroupWithPrisma(
        new FakeAdminUserGroupPrisma(buildState()),
        buildInput("student-target", "missing-group"),
      ),
    ).resolves.toEqual({ status: "group_not_found" });

    await expect(
      updateAdminUserGroupWithPrisma(
        new FakeAdminUserGroupPrisma(buildState()),
        buildInput("student-target", "grupo-inativo"),
      ),
    ).resolves.toEqual({ status: "group_inactive" });

    const alreadySetState = buildState();
    const alreadySetTarget = alreadySetState.users.find((user) => user.id === "student-target");
    if (alreadySetTarget) {
      alreadySetTarget.groupName = "Emmanuel";
      alreadySetTarget.groupSlug = "emmanuel";
    }
    await expect(
      updateAdminUserGroupWithPrisma(new FakeAdminUserGroupPrisma(alreadySetState), buildInput()),
    ).resolves.toEqual({ status: "already_set" });

    await expect(
      updateAdminUserGroupWithPrisma(
        new FakeAdminUserGroupPrisma(buildState()),
        buildInput("student-target", null),
      ),
    ).resolves.toEqual({ status: "already_empty" });
  });
});
