import {
  GroupStatus as PrismaGroupStatus,
  type PrismaClient,
  type StudyGroup as PrismaStudyGroup,
  type StudyMeeting as PrismaStudyMeeting,
  type User as PrismaUser,
} from "@prisma/client";

import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import { studyGroups } from "../../data/studies";
import type {
  UserStudyMeetingGroupRecord,
  UserStudyMeetingRecord,
  UserStudyMeetingUserGroupRecord,
} from "./study-meetings.types";

export interface UserStudyMeetingsRepository {
  findUserGroupByUserId(userId: string): Promise<UserStudyMeetingUserGroupRecord | null>;
  findGroupById(groupId: string): Promise<UserStudyMeetingGroupRecord | null>;
  listCurrentAndFutureMeetings(input: {
    groupId: string;
    now: Date;
    limit: number;
  }): Promise<UserStudyMeetingRecord[]>;
}

export interface MemoryUserStudyMeetingUser {
  id: string;
  groupName: string | null;
  groupSlug: string | null;
}

export interface MemoryUserStudyMeetingGroup {
  id: string;
  name: string;
  status: "active" | "inactive";
  meetUrl: string;
}

export interface MemoryUserStudyMeeting {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  canceledAt: string | null;
}

export interface MemoryUserStudyMeetingsState {
  users: MemoryUserStudyMeetingUser[];
  groups: MemoryUserStudyMeetingGroup[];
  meetings: MemoryUserStudyMeeting[];
}

type UserStudyMeetingsPersistenceClient = Pick<
  PrismaClient,
  "user" | "studyGroup" | "studyMeeting"
>;

const defaultMemoryGroups: MemoryUserStudyMeetingGroup[] = studyGroups.map((group) => ({
  id: group.id,
  name: group.name,
  status: "active",
  meetUrl: group.meetUrl,
}));

const defaultMemoryUsers: MemoryUserStudyMeetingUser[] = [
  {
    id: "user-aluno-demo",
    groupName: "Emmanuel",
    groupSlug: "emmanuel",
  },
  {
    id: "user-professor-demo",
    groupName: "Emmanuel",
    groupSlug: "emmanuel",
  },
  {
    id: "user-admin-demo",
    groupName: null,
    groupSlug: null,
  },
];

const cloneUser = (
  user: MemoryUserStudyMeetingUser,
): MemoryUserStudyMeetingUser => ({ ...user });

const cloneGroup = (
  group: MemoryUserStudyMeetingGroup,
): MemoryUserStudyMeetingGroup => ({ ...group });

const cloneMeeting = (
  meeting: MemoryUserStudyMeeting,
): MemoryUserStudyMeeting => ({ ...meeting });

export const createMemoryUserStudyMeetingsState = (
  options: Partial<MemoryUserStudyMeetingsState> = {},
): MemoryUserStudyMeetingsState => ({
  users: (options.users ?? defaultMemoryUsers).map(cloneUser),
  groups: (options.groups ?? defaultMemoryGroups).map(cloneGroup),
  meetings: (options.meetings ?? []).map(cloneMeeting),
});

const mapPrismaGroupStatus = (
  status: PrismaGroupStatus,
): UserStudyMeetingGroupRecord["status"] =>
  status === PrismaGroupStatus.ACTIVE ? "active" : "inactive";

const mapPrismaUserGroup = (
  user: Pick<PrismaUser, "groupName" | "groupSlug">,
): UserStudyMeetingUserGroupRecord => ({
  groupName: user.groupName ?? null,
  groupSlug: user.groupSlug ?? null,
});

const mapPrismaGroup = (
  group: Pick<PrismaStudyGroup, "id" | "name" | "status" | "meetUrl">,
): UserStudyMeetingGroupRecord => ({
  id: group.id,
  name: group.name,
  status: mapPrismaGroupStatus(group.status),
  meetUrl: group.meetUrl,
});

const mapPrismaMeeting = (
  meeting: Pick<
    PrismaStudyMeeting,
    "id" | "groupId" | "title" | "description" | "startsAt" | "endsAt"
  >,
): UserStudyMeetingRecord => ({
  id: meeting.id,
  groupId: meeting.groupId,
  title: meeting.title,
  description: meeting.description ?? null,
  startsAt: meeting.startsAt.toISOString(),
  endsAt: meeting.endsAt.toISOString(),
});

export const createMemoryUserStudyMeetingsRepository = (
  state: MemoryUserStudyMeetingsState = createMemoryUserStudyMeetingsState(),
): UserStudyMeetingsRepository => {
  return {
    async findUserGroupByUserId(userId) {
      const user = state.users.find((item) => item.id === userId);
      return user
        ? {
            groupName: user.groupName,
            groupSlug: user.groupSlug,
          }
        : null;
    },

    async findGroupById(groupId) {
      const group = state.groups.find((item) => item.id === groupId);
      return group ? cloneGroup(group) : null;
    },

    async listCurrentAndFutureMeetings(input) {
      const nowTime = input.now.getTime();

      return state.meetings
        .filter((meeting) => {
          if (meeting.groupId !== input.groupId) {
            return false;
          }

          if (meeting.canceledAt !== null) {
            return false;
          }

          return new Date(meeting.endsAt).getTime() > nowTime;
        })
        .sort((first, second) => {
          const startsAtComparison =
            new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime();

          if (startsAtComparison !== 0) {
            return startsAtComparison;
          }

          return first.id.localeCompare(second.id);
        })
        .slice(0, input.limit)
        .map((meeting) => ({
          id: meeting.id,
          groupId: meeting.groupId,
          title: meeting.title,
          description: meeting.description,
          startsAt: meeting.startsAt,
          endsAt: meeting.endsAt,
        }));
    },
  };
};

export const createPrismaUserStudyMeetingsRepository = (
  prisma: UserStudyMeetingsPersistenceClient = getPrismaClient(),
): UserStudyMeetingsRepository => {
  return {
    async findUserGroupByUserId(userId) {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          groupName: true,
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
          meetUrl: true,
        },
      });

      return group ? mapPrismaGroup(group) : null;
    },

    async listCurrentAndFutureMeetings(input) {
      const meetings = await prisma.studyMeeting.findMany({
        where: {
          groupId: input.groupId,
          canceledAt: null,
          endsAt: {
            gt: input.now,
          },
        },
        orderBy: [
          {
            startsAt: "asc",
          },
          {
            id: "asc",
          },
        ],
        take: input.limit,
        select: {
          id: true,
          groupId: true,
          title: true,
          description: true,
          startsAt: true,
          endsAt: true,
        },
      });

      return meetings.map(mapPrismaMeeting);
    },
  };
};

export const createUserStudyMeetingsRepository = () => {
  if (env.nodeEnv === "test" || !env.databaseUrl) {
    return createMemoryUserStudyMeetingsRepository();
  }

  return createPrismaUserStudyMeetingsRepository();
};
