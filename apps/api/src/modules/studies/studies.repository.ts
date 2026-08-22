import { GroupStatus, type PrismaClient } from "@prisma/client";

import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import { studyGroups, type NextLesson, type StudyGroup, type StudyGroupId } from "../../data/studies";

export class StudyGroupCatalogUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "StudyGroupCatalogUnavailableError";
  }
}

export interface StudiesRepository {
  list(): Promise<StudyGroup[]>;
  findBySlug(slug: string): Promise<StudyGroup | null>;
}

type StudiesPrismaClient = Pick<PrismaClient, "studyGroup">;

const KNOWN_STUDY_GROUP_IDS = new Set<StudyGroupId>(studyGroups.map((group) => group.id));
const CANONICAL_STUDY_GROUP_IDS = studyGroups.map((group) => group.id);

const isKnownStudyGroupId = (value: string): value is StudyGroupId => {
  return KNOWN_STUDY_GROUP_IDS.has(value as StudyGroupId);
};

const cloneNextLesson = (lesson: NextLesson | null): NextLesson | null => {
  return lesson ? { ...lesson } : null;
};

const cloneStudyGroup = (group: StudyGroup): StudyGroup => ({
  ...group,
  nextLesson: cloneNextLesson(group.nextLesson),
});

export const createMemoryStudiesRepository = (): StudiesRepository => ({
  async list() {
    return studyGroups.map(cloneStudyGroup);
  },

  async findBySlug(slug) {
    const group = studyGroups.find((study) => study.id === slug);
    return group ? cloneStudyGroup(group) : null;
  },
});

const assertKnownGroupId = (id: string): StudyGroupId => {
  if (!isKnownStudyGroupId(id)) {
    throw new StudyGroupCatalogUnavailableError("UNKNOWN_STUDY_GROUP_ID");
  }

  return id;
};

const buildNextLesson = (
  group: { id: StudyGroupId; meetUrl: string | null; meetings: Array<{
    id: string;
    title: string;
    description: string | null;
    startsAt: Date;
  }> },
): NextLesson | null => {
  const meeting = group.meetings[0];

  if (!meeting) {
    return null;
  }

  return {
    id: meeting.id,
    groupId: group.id,
    title: meeting.title,
    theme: meeting.description ?? meeting.title,
    scheduledAt: meeting.startsAt.toISOString(),
    meetUrl: group.meetUrl,
    status: "scheduled",
    teacherNote: "",
  };
};

const mapPrismaStudyGroup = (group: {
  id: string;
  name: string;
  meetingDay: string | null;
  meetingTime: string | null;
  participantCount: number | null;
  meetUrl: string | null;
  description: string | null;
  knowledgeBook: { title: string } | null;
  meetings: Array<{
    id: string;
    title: string;
    description: string | null;
    startsAt: Date;
  }>;
}): StudyGroup => {
  const id = assertKnownGroupId(group.id);

  if (!group.knowledgeBook) {
    throw new StudyGroupCatalogUnavailableError("STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK");
  }

  return {
    id,
    name: group.name,
    meetingDay: group.meetingDay,
    meetingTime: group.meetingTime,
    participantCount: group.participantCount,
    bookTitle: group.knowledgeBook.title,
    meetUrl: group.meetUrl,
    description: group.description,
    nextLesson: buildNextLesson({ id, meetUrl: group.meetUrl, meetings: group.meetings }),
  };
};

export const createPrismaStudiesRepository = (
  prisma: StudiesPrismaClient = getPrismaClient(),
  nowProvider: () => Date = () => new Date(),
): StudiesRepository => ({
  async list() {
    const groups = await prisma.studyGroup.findMany({
      where: {
        id: { in: [...KNOWN_STUDY_GROUP_IDS] },
        status: GroupStatus.ACTIVE,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        meetingDay: true,
        meetingTime: true,
        participantCount: true,
        meetUrl: true,
        description: true,
        knowledgeBook: {
          select: {
            title: true,
          },
        },
        meetings: {
          where: {
            canceledAt: null,
            startsAt: { gte: nowProvider() },
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          take: 1,
          select: {
            id: true,
            title: true,
            description: true,
            startsAt: true,
          },
        },
      },
    });

    const groupsById = new Map(groups.map((group) => [group.id, group]));

    return CANONICAL_STUDY_GROUP_IDS
      .map((groupId) => groupsById.get(groupId))
      .filter((group): group is NonNullable<typeof group> => Boolean(group))
      .map(mapPrismaStudyGroup);
  },

  async findBySlug(slug) {
    if (!isKnownStudyGroupId(slug)) {
      return null;
    }

    const group = await prisma.studyGroup.findFirst({
      where: {
        id: slug,
        status: GroupStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        meetingDay: true,
        meetingTime: true,
        participantCount: true,
        meetUrl: true,
        description: true,
        knowledgeBook: {
          select: {
            title: true,
          },
        },
        meetings: {
          where: {
            canceledAt: null,
            startsAt: { gte: nowProvider() },
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          take: 1,
          select: {
            id: true,
            title: true,
            description: true,
            startsAt: true,
          },
        },
      },
    });

    return group ? mapPrismaStudyGroup(group) : null;
  },
});

export const createDefaultStudiesRepository = (): StudiesRepository => {
  if (env.databaseUrl) {
    return createPrismaStudiesRepository();
  }

  return createMemoryStudiesRepository();
};
