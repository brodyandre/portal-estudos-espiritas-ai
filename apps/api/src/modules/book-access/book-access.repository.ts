import {
  GroupStatus as PrismaGroupStatus,
  KnowledgeBookStatus as PrismaKnowledgeBookStatus,
  type PrismaClient,
  type StudyGroup as PrismaStudyGroup,
  type User as PrismaUser,
} from "@prisma/client";

import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import type {
  BookAccessGroupRecord,
  BookAccessGroupStatus,
  BookAccessKnowledgeBookStatus,
  BookAccessUserGroupRecord,
} from "./book-access.types";

export interface BookAccessRepository {
  findUserGroupByUserId(userId: string): Promise<BookAccessUserGroupRecord | null>;
  findGroupById(groupId: string): Promise<BookAccessGroupRecord | null>;
  listPedagogicalGroupsByUserId(userId: string): Promise<BookAccessGroupRecord[]>;
}

export type MemoryBookAccessGroup = BookAccessGroupRecord;

export interface MemoryBookAccessState {
  users: Array<{ id: string; groupSlug: string | null }>;
  groups: MemoryBookAccessGroup[];
  teacherGroupMemberships: Array<{ userId: string; groupId: string }>;
}

type BookAccessPersistenceClient = Pick<
  PrismaClient,
  "user" | "studyGroup" | "teacherStudyGroup"
>;

type PrismaBookAccessGroup = Pick<PrismaStudyGroup, "id" | "name" | "status"> & {
  knowledgeBook: {
    id: string;
    slug: string;
    title: string;
    status: PrismaKnowledgeBookStatus;
  } | null;
};

const cloneGroup = (group: MemoryBookAccessGroup): MemoryBookAccessGroup => ({
  ...group,
  knowledgeBook: group.knowledgeBook ? { ...group.knowledgeBook } : null,
});

const createDefaultMemoryBookAccessState = (): MemoryBookAccessState => ({
  users: [
    { id: "user-aluno-demo", groupSlug: "emmanuel" },
    { id: "user-professor-demo", groupSlug: "emmanuel" },
    { id: "user-admin-demo", groupSlug: null },
  ],
  groups: [
    {
      id: "emmanuel",
      name: "Emmanuel",
      status: "active",
      knowledgeBook: {
        id: "book-emmanuel",
        slug: "emmanuel",
        title: "Emmanuel",
        status: "active",
      },
    },
    {
      id: "a-caminho-da-luz",
      name: "A Caminho da Luz",
      status: "active",
      knowledgeBook: {
        id: "book-a-caminho-da-luz",
        slug: "a-caminho-da-luz",
        title: "A Caminho da Luz",
        status: "active",
      },
    },
  ],
  teacherGroupMemberships: [{ userId: "user-professor-demo", groupId: "emmanuel" }],
});

export const createMemoryBookAccessState = (
  options: Partial<MemoryBookAccessState> = {},
): MemoryBookAccessState => {
  const defaults = createDefaultMemoryBookAccessState();

  return {
    users: (options.users ?? defaults.users).map((user) => ({ ...user })),
    groups: (options.groups ?? defaults.groups).map(cloneGroup),
    teacherGroupMemberships: (
      options.teacherGroupMemberships ?? defaults.teacherGroupMemberships
    ).map((membership) => ({ ...membership })),
  };
};

const mapPrismaGroupStatus = (status: PrismaGroupStatus): BookAccessGroupStatus =>
  status === PrismaGroupStatus.ACTIVE ? "active" : "inactive";

const mapPrismaKnowledgeBookStatus = (
  status: PrismaKnowledgeBookStatus,
): BookAccessKnowledgeBookStatus =>
  status === PrismaKnowledgeBookStatus.ACTIVE ? "active" : "archived";

const mapPrismaUserGroup = (
  user: Pick<PrismaUser, "groupSlug">,
): BookAccessUserGroupRecord => ({
  groupSlug: user.groupSlug ?? null,
});

const mapPrismaGroup = (group: PrismaBookAccessGroup): BookAccessGroupRecord => ({
  id: group.id,
  name: group.name,
  status: mapPrismaGroupStatus(group.status),
  knowledgeBook: group.knowledgeBook
    ? {
        id: group.knowledgeBook.id,
        slug: group.knowledgeBook.slug,
        title: group.knowledgeBook.title,
        status: mapPrismaKnowledgeBookStatus(group.knowledgeBook.status),
      }
    : null,
});

export const createMemoryBookAccessRepository = (
  state: MemoryBookAccessState = createMemoryBookAccessState(),
): BookAccessRepository => {
  return {
    async findUserGroupByUserId(userId) {
      const user = state.users.find((item) => item.id === userId);
      return user ? { groupSlug: user.groupSlug } : null;
    },

    async findGroupById(groupId) {
      const group = state.groups.find((item) => item.id === groupId);
      return group ? cloneGroup(group) : null;
    },

    async listPedagogicalGroupsByUserId(userId) {
      const membershipGroupIds = state.teacherGroupMemberships
        .filter((membership) => membership.userId === userId)
        .map((membership) => membership.groupId);

      return state.groups
        .filter((group) => membershipGroupIds.includes(group.id))
        .sort((first, second) => {
          const nameComparison = first.name.localeCompare(second.name, "pt-BR", {
            sensitivity: "base",
          });

          return nameComparison !== 0 ? nameComparison : first.id.localeCompare(second.id);
        })
        .map(cloneGroup);
    },
  };
};

export const createPrismaBookAccessRepository = (
  prisma: BookAccessPersistenceClient = getPrismaClient(),
): BookAccessRepository => {
  return {
    async findUserGroupByUserId(userId) {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          groupSlug: true,
        },
      });

      return user ? mapPrismaUserGroup(user) : null;
    },

    async findGroupById(groupId) {
      const group = await prisma.studyGroup.findUnique({
        where: {
          id: groupId,
        },
        select: {
          id: true,
          name: true,
          status: true,
          knowledgeBook: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
            },
          },
        },
      });

      return group ? mapPrismaGroup(group) : null;
    },

    async listPedagogicalGroupsByUserId(userId) {
      const memberships = await prisma.teacherStudyGroup.findMany({
        where: {
          userId,
        },
        orderBy: [
          {
            group: {
              name: "asc",
            },
          },
          {
            groupId: "asc",
          },
        ],
        select: {
          group: {
            select: {
              id: true,
              name: true,
              status: true,
              knowledgeBook: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      return memberships.map((membership) => mapPrismaGroup(membership.group));
    },
  };
};

export const createBookAccessRepository = () => {
  if (env.nodeEnv === "test" || !env.databaseUrl) {
    return createMemoryBookAccessRepository();
  }

  return createPrismaBookAccessRepository();
};
