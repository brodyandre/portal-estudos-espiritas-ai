import {
  GroupStatus as PrismaGroupStatus,
  Prisma,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
  type PrismaClient,
} from "@prisma/client";

import { env } from "../../../config/env";
import { getPrismaClient } from "../../../database/prisma";
import type { UserRole } from "../../../auth/types";
import { studyGroups } from "../../../data/studies";
import type { AdminUserTeacherGroupSummary } from "./types";

export interface AdminUserTeacherGroupsUpdateInput {
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  targetUserId: string;
  groupIds: string[];
}

export type AdminUserTeacherGroupsRepositoryResult =
  | {
      status: "found";
      userId: string;
      groups: AdminUserTeacherGroupSummary[];
    }
  | { status: "actor_not_authorized" }
  | { status: "not_found" }
  | { status: "target_not_teacher" };

export type AdminUserTeacherGroupsUpdateResult =
  | {
      status: "updated" | "unchanged";
      userId: string;
      groups: AdminUserTeacherGroupSummary[];
      addedGroupIds: string[];
      removedGroupIds: string[];
    }
  | { status: "actor_not_authorized" }
  | { status: "not_found" }
  | { status: "target_not_teacher" }
  | { status: "group_not_found"; groupId: string }
  | { status: "group_inactive"; groupId: string }
  | { status: "conflict" };

export interface AdminUserTeacherGroupsRepository {
  listByUserId(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminUserTeacherGroupsRepositoryResult>;
  replaceForUser(
    input: AdminUserTeacherGroupsUpdateInput,
  ): Promise<AdminUserTeacherGroupsUpdateResult>;
}

type MemoryUser = {
  id: string;
  role: UserRole;
  status: "active" | "inactive" | "pending" | "rejected";
  accountActivatedAt: string | null;
};

type MemoryGroup = AdminUserTeacherGroupSummary;
type MemoryMembership = { userId: string; groupId: string };
type MemoryAuditEntry = {
  actorName: string;
  actorRole: UserRole;
  action: string;
  entity: string;
  note: string;
};

type PrismaTeacherGroupsClient = Pick<
  PrismaClient,
  "user" | "studyGroup" | "teacherStudyGroup" | "auditLog" | "$transaction"
>;

const ADMIN_USER_TEACHER_GROUPS_UPDATE_MAX_RETRIES = 3;

let memoryUsers: MemoryUser[] = [
  {
    id: "user-admin-demo",
    role: "admin",
    status: "active",
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "user-professor-demo",
    role: "teacher",
    status: "active",
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
  },
  {
    id: "user-aluno-demo",
    role: "student",
    status: "active",
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
  },
];

let memoryGroups: MemoryGroup[] = studyGroups.map((group) => ({
  name: group.name,
  slug: group.id,
  status: "active",
}));

let memoryMemberships: MemoryMembership[] = [
  { userId: "user-professor-demo", groupId: "emmanuel" },
];

let memoryAuditEntries: MemoryAuditEntry[] = [];

const prismaRoleToRole: Record<PrismaUserRole, UserRole> = {
  ADMIN: "admin",
  STUDENT: "student",
  TEACHER: "teacher",
  VISITOR: "visitor",
};

const roleToPrismaRole: Record<UserRole, PrismaUserRole> = {
  admin: PrismaUserRole.ADMIN,
  student: PrismaUserRole.STUDENT,
  teacher: PrismaUserRole.TEACHER,
  visitor: PrismaUserRole.VISITOR,
};

const prismaGroupStatusToStatus: Record<PrismaGroupStatus, AdminUserTeacherGroupSummary["status"]> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

const isActiveAdmin = (user: {
  role: UserRole | PrismaUserRole;
  status: string;
  accountActivatedAt?: Date | string | null;
}) => {
  const role = typeof user.role === "string" && user.role in prismaRoleToRole
    ? prismaRoleToRole[user.role as PrismaUserRole]
    : user.role;
  const status = user.status === PrismaUserStatus.ACTIVE ? "active" : user.status;

  return role === "admin" && status === "active" && Boolean(user.accountActivatedAt);
};

const sortGroups = (groups: AdminUserTeacherGroupSummary[]) =>
  [...groups].sort((first, second) => first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }));

const listMemoryGroupsForUser = (userId: string) =>
  sortGroups(
    memoryMemberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => memoryGroups.find((group) => group.slug === membership.groupId))
      .filter((group): group is MemoryGroup => Boolean(group))
      .map((group) => ({ ...group })),
  );

const uniqueSortedIds = (ids: string[]) => [...new Set(ids)].sort();

const hasSameSet = (left: string[], right: string[]) => {
  const normalizedLeft = uniqueSortedIds(left);
  const normalizedRight = uniqueSortedIds(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
};

export const createMemoryAdminUserTeacherGroupsRepository = (
  options: {
    users?: MemoryUser[];
    groups?: MemoryGroup[];
    memberships?: MemoryMembership[];
  } = {},
): AdminUserTeacherGroupsRepository => {
  memoryUsers = (options.users ?? memoryUsers).map((user) => ({ ...user }));
  memoryGroups = (options.groups ?? memoryGroups).map((group) => ({ ...group }));
  memoryMemberships = (options.memberships ?? memoryMemberships).map((membership) => ({ ...membership }));

  return {
    async listByUserId(actorUserId, targetUserId) {
      const actor = memoryUsers.find((user) => user.id === actorUserId);

      if (!actor || !isActiveAdmin(actor)) {
        return { status: "actor_not_authorized" };
      }

      const target = memoryUsers.find((user) => user.id === targetUserId);

      if (!target) {
        return { status: "not_found" };
      }

      if (target.role !== "teacher") {
        return { status: "target_not_teacher" };
      }

      return {
        status: "found",
        userId: target.id,
        groups: listMemoryGroupsForUser(target.id),
      };
    },

    async replaceForUser(input) {
      const actor = memoryUsers.find((user) => user.id === input.actorUserId);

      if (!actor || !isActiveAdmin(actor)) {
        return { status: "actor_not_authorized" };
      }

      const target = memoryUsers.find((user) => user.id === input.targetUserId);

      if (!target) {
        return { status: "not_found" };
      }

      if (target.role !== "teacher") {
        return { status: "target_not_teacher" };
      }

      for (const groupId of input.groupIds) {
        const group = memoryGroups.find((item) => item.slug === groupId);

        if (!group) {
          return { status: "group_not_found", groupId };
        }

        if (group.status !== "active") {
          return { status: "group_inactive", groupId };
        }
      }

      const previousGroupIds = memoryMemberships
        .filter((membership) => membership.userId === target.id)
        .map((membership) => membership.groupId);
      const nextGroupIds = uniqueSortedIds(input.groupIds);
      const addedGroupIds = nextGroupIds.filter((groupId) => !previousGroupIds.includes(groupId));
      const removedGroupIds = previousGroupIds.filter((groupId) => !nextGroupIds.includes(groupId));

      if (hasSameSet(previousGroupIds, nextGroupIds)) {
        return {
          status: "unchanged",
          userId: target.id,
          groups: listMemoryGroupsForUser(target.id),
          addedGroupIds: [],
          removedGroupIds: [],
        };
      }

      memoryMemberships = [
        ...memoryMemberships.filter((membership) => membership.userId !== target.id),
        ...nextGroupIds.map((groupId) => ({ userId: target.id, groupId })),
      ];
      memoryAuditEntries.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Grupos de professor alterados por admin",
        entity: `User ${target.id}`,
        note: `Grupos adicionados: ${addedGroupIds.join(", ") || "nenhum"}. Grupos removidos: ${removedGroupIds.join(", ") || "nenhum"}.`,
      });

      return {
        status: "updated",
        userId: target.id,
        groups: listMemoryGroupsForUser(target.id),
        addedGroupIds,
        removedGroupIds,
      };
    },
  };
};

export const createPrismaAdminUserTeacherGroupsRepository = (
  prisma: PrismaTeacherGroupsClient = getPrismaClient(),
): AdminUserTeacherGroupsRepository => {
  const listGroupsForUser = async (
    runner: Pick<PrismaTeacherGroupsClient, "teacherStudyGroup">,
    userId: string,
  ) => {
    const memberships = await runner.teacherStudyGroup.findMany({
      where: { userId },
      orderBy: [{ group: { name: "asc" } }, { groupId: "asc" }],
      select: {
        group: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return memberships.map((membership) => ({
      name: membership.group.name,
      slug: membership.group.id,
      status: prismaGroupStatusToStatus[membership.group.status],
    }));
  };

  return {
    async listByUserId(actorUserId, targetUserId) {
      const [actor, target] = await prisma.$transaction([
        prisma.user.findUnique({
          where: { id: actorUserId },
          select: { id: true, role: true, status: true, accountActivatedAt: true },
        }),
        prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, role: true },
        }),
      ]);

      if (!actor || !isActiveAdmin(actor)) {
        return { status: "actor_not_authorized" };
      }

      if (!target) {
        return { status: "not_found" };
      }

      if (prismaRoleToRole[target.role] !== "teacher") {
        return { status: "target_not_teacher" };
      }

      return {
        status: "found",
        userId: target.id,
        groups: await listGroupsForUser(prisma, target.id),
      };
    },

    async replaceForUser(input) {
      const nextGroupIds = uniqueSortedIds(input.groupIds);

      for (let attempt = 1; attempt <= ADMIN_USER_TEACHER_GROUPS_UPDATE_MAX_RETRIES; attempt += 1) {
        try {
          return await prisma.$transaction(
            async (transaction) => {
              const actor = await transaction.user.findUnique({
                where: { id: input.actorUserId },
                select: { id: true, role: true, status: true, accountActivatedAt: true },
              });

              if (!actor || !isActiveAdmin(actor)) {
                return { status: "actor_not_authorized" } as const;
              }

              const target = await transaction.user.findUnique({
                where: { id: input.targetUserId },
                select: { id: true, role: true },
              });

              if (!target) {
                return { status: "not_found" } as const;
              }

              if (prismaRoleToRole[target.role] !== "teacher") {
                return { status: "target_not_teacher" } as const;
              }

              const groups = await transaction.studyGroup.findMany({
                where: { id: { in: nextGroupIds } },
                select: { id: true, status: true },
              });
              const groupsById = new Map(groups.map((group) => [group.id, group]));

              for (const groupId of nextGroupIds) {
                const group = groupsById.get(groupId);

                if (!group) {
                  return { status: "group_not_found", groupId } as const;
                }

                if (group.status !== PrismaGroupStatus.ACTIVE) {
                  return { status: "group_inactive", groupId } as const;
                }
              }

              const previousMemberships = await transaction.teacherStudyGroup.findMany({
                where: { userId: target.id },
                select: { groupId: true },
              });
              const previousGroupIds = previousMemberships.map((membership) => membership.groupId);
              const addedGroupIds = nextGroupIds.filter((groupId) => !previousGroupIds.includes(groupId));
              const removedGroupIds = previousGroupIds.filter((groupId) => !nextGroupIds.includes(groupId));

              if (hasSameSet(previousGroupIds, nextGroupIds)) {
                return {
                  status: "unchanged",
                  userId: target.id,
                  groups: await listGroupsForUser(transaction, target.id),
                  addedGroupIds: [],
                  removedGroupIds: [],
                } as const;
              }

              if (removedGroupIds.length > 0) {
                await transaction.teacherStudyGroup.deleteMany({
                  where: {
                    userId: target.id,
                    groupId: { in: removedGroupIds },
                  },
                });
              }

              if (addedGroupIds.length > 0) {
                await transaction.teacherStudyGroup.createMany({
                  data: addedGroupIds.map((groupId) => ({
                    userId: target.id,
                    groupId,
                  })),
                  skipDuplicates: true,
                });
              }

              await transaction.auditLog.create({
                data: {
                  actorName: input.actorName,
                  actorRole: roleToPrismaRole[input.actorRole],
                  action: "Grupos de professor alterados por admin",
                  entity: `User ${target.id}`,
                  note: `Grupos adicionados: ${addedGroupIds.join(", ") || "nenhum"}. Grupos removidos: ${removedGroupIds.join(", ") || "nenhum"}.`,
                },
              });

              return {
                status: "updated",
                userId: target.id,
                groups: await listGroupsForUser(transaction, target.id),
                addedGroupIds,
                removedGroupIds,
              } as const;
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );
        } catch (error) {
          const canRetry =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2034" &&
            attempt < ADMIN_USER_TEACHER_GROUPS_UPDATE_MAX_RETRIES;

          if (!canRetry) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2034"
            ) {
              return { status: "conflict" };
            }

            throw error;
          }
        }
      }

      return { status: "conflict" };
    },
  };
};

export const createAdminUserTeacherGroupsRepository = () => {
  if (env.nodeEnv === "test" || !env.databaseUrl) {
    return createMemoryAdminUserTeacherGroupsRepository();
  }

  return createPrismaAdminUserTeacherGroupsRepository();
};

export const setMemoryAdminTeacherGroupsForTesting = (
  options: {
    users?: MemoryUser[];
    groups?: MemoryGroup[];
    memberships?: MemoryMembership[];
  },
) => {
  memoryUsers = (options.users ?? memoryUsers).map((user) => ({ ...user }));
  memoryGroups = (options.groups ?? memoryGroups).map((group) => ({ ...group }));
  memoryMemberships = (options.memberships ?? memoryMemberships).map((membership) => ({ ...membership }));
};

export const getMemoryAdminTeacherGroupAuditEntries = () =>
  memoryAuditEntries.map((entry) => ({ ...entry }));
