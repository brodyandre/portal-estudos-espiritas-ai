import {
  Prisma,
  UserRole as PrismaUserRole,
  type PrismaClient,
  type StudyGroup as PrismaStudyGroup,
  type StudyMeeting as PrismaStudyMeeting,
} from "@prisma/client";

import type { UserRole } from "../../auth/types";
import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import { studyGroups } from "../../data/studies";
import {
  DEFAULT_STUDY_MEETINGS_PAGE,
  DEFAULT_STUDY_MEETINGS_PAGE_SIZE,
  InvalidStudyMeetingListInputError,
  InvalidStudyMeetingTimeRangeError,
  MAX_STUDY_MEETINGS_PAGE_SIZE,
  StudyMeetingGroupNotFoundError,
  type CancelStudyMeetingInput,
  type CreateStudyMeetingInput,
  type StudyMeetingDateInput,
  type StudyMeetingListInput,
  type StudyMeetingListResult,
  type StudyMeetingRecord,
  type StudyMeetingSortOrder,
  type UpdateStudyMeetingInput,
} from "./study-meetings.types";

export interface StudyMeetingsRepository {
  create(input: CreateStudyMeetingInput): Promise<StudyMeetingRecord>;
  findById(id: string): Promise<StudyMeetingRecord | null>;
  findByIdAndGroupId(id: string, groupId: string): Promise<StudyMeetingRecord | null>;
  listByGroupId(input: StudyMeetingListInput): Promise<StudyMeetingListResult>;
  update(input: UpdateStudyMeetingInput): Promise<StudyMeetingRecord | null>;
  cancel(input: CancelStudyMeetingInput): Promise<StudyMeetingRecord | null>;
}

export interface StudyMeetingGroupRecord {
  id: string;
  name: string;
  status: "active" | "inactive";
}

export interface StudyMeetingGroupsRepository {
  findById(id: string): Promise<StudyMeetingGroupRecord | null>;
}

export interface StudyMeetingAuditLogEntry {
  actorName: string;
  actorRole: UserRole;
  action: string;
  entity: string;
  note: string;
}

export interface StudyMeetingAuditRepository {
  create(entry: StudyMeetingAuditLogEntry): Promise<void>;
}

export interface StudyMeetingsTransactionalContext {
  meetingsRepository: StudyMeetingsRepository;
  groupsRepository: StudyMeetingGroupsRepository;
  auditRepository: StudyMeetingAuditRepository;
}

export interface StudyMeetingsTransactionRunner {
  run<T>(callback: (context: StudyMeetingsTransactionalContext) => Promise<T>): Promise<T>;
}

export interface MemoryStudyMeetingGroup {
  id: string;
  name: string;
  status: "active" | "inactive";
}

export interface MemoryStudyMeetingsState {
  groups: MemoryStudyMeetingGroup[];
  meetings: StudyMeetingRecord[];
  auditLogs: StudyMeetingAuditLogEntry[];
}

type StudyMeetingsPersistenceClient = Pick<PrismaClient, "studyGroup" | "studyMeeting">;
type StudyMeetingsAuditPersistenceClient = Pick<PrismaClient, "auditLog">;
type StudyMeetingsTransactionPersistenceClient = Pick<
  PrismaClient,
  "studyGroup" | "studyMeeting" | "auditLog"
>;

type CreateMemoryStudyMeetingsRepositoryOptions = {
  state?: MemoryStudyMeetingsState;
  groups?: MemoryStudyMeetingGroup[];
  meetings?: StudyMeetingRecord[];
  nowProvider?: () => Date;
  idProvider?: () => string;
};

const DEFAULT_MEMORY_GROUPS: MemoryStudyMeetingGroup[] = studyGroups.map((group) => ({
  id: group.id,
  name: group.name,
  status: "active",
}));

const cloneGroup = (group: MemoryStudyMeetingGroup): MemoryStudyMeetingGroup => ({ ...group });
const cloneRecord = (record: StudyMeetingRecord): StudyMeetingRecord => ({ ...record });
const cloneAuditLogEntry = (entry: StudyMeetingAuditLogEntry): StudyMeetingAuditLogEntry => ({ ...entry });

const normalizeTitle = (title: string) => {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new TypeError("Study meeting title must be a non-empty string.");
  }

  return trimmedTitle;
};

const normalizeOptionalText = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
};

const parseDateInput = (value: StudyMeetingDateInput, fieldName: string) => {
  const parsedDate = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new TypeError(`Study meeting ${fieldName} must be a valid date.`);
  }

  return parsedDate;
};

const assertValidTimeRange = (startsAt: StudyMeetingDateInput, endsAt: StudyMeetingDateInput) => {
  const parsedStartsAt = parseDateInput(startsAt, "startsAt");
  const parsedEndsAt = parseDateInput(endsAt, "endsAt");

  if (parsedStartsAt.getTime() >= parsedEndsAt.getTime()) {
    throw new InvalidStudyMeetingTimeRangeError();
  }

  return {
    startsAt: parsedStartsAt,
    endsAt: parsedEndsAt,
  };
};

const mapPrismaStudyMeeting = (meeting: PrismaStudyMeeting): StudyMeetingRecord => ({
  id: meeting.id,
  groupId: meeting.groupId,
  title: meeting.title,
  description: meeting.description ?? null,
  startsAt: meeting.startsAt.toISOString(),
  endsAt: meeting.endsAt.toISOString(),
  canceledAt: meeting.canceledAt ? meeting.canceledAt.toISOString() : null,
  cancellationReason: meeting.cancellationReason ?? null,
  createdAt: meeting.createdAt.toISOString(),
  updatedAt: meeting.updatedAt.toISOString(),
});

const mapPrismaStudyGroup = (group: Pick<PrismaStudyGroup, "id" | "name" | "status">): StudyMeetingGroupRecord => ({
  id: group.id,
  name: group.name,
  status: group.status === "ACTIVE" ? "active" : "inactive",
});

const toPrismaUserRole = (role: UserRole): PrismaUserRole => {
  switch (role) {
    case "admin":
      return PrismaUserRole.ADMIN;
    case "student":
      return PrismaUserRole.STUDENT;
    case "teacher":
      return PrismaUserRole.TEACHER;
    case "visitor":
      return PrismaUserRole.VISITOR;
  }
};

const assertValidListInput = (input: StudyMeetingListInput) => {
  if (!Number.isInteger(input.page) || input.page < 1) {
    throw new InvalidStudyMeetingListInputError(
      "Study meeting page must be greater than or equal to 1.",
    );
  }

  if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > MAX_STUDY_MEETINGS_PAGE_SIZE) {
    throw new InvalidStudyMeetingListInputError(
      `Study meeting pageSize must be between 1 and ${MAX_STUDY_MEETINGS_PAGE_SIZE}.`,
    );
  }

  if (input.sortOrder !== "asc" && input.sortOrder !== "desc") {
    throw new InvalidStudyMeetingListInputError("Study meeting sortOrder must be asc or desc.");
  }
};

const buildTotalPages = (total: number, pageSize: number) => Math.ceil(total / pageSize);

const buildMemoryGroupsMap = (groups: MemoryStudyMeetingGroup[]) => {
  return new Map(groups.map((group) => [group.id, cloneGroup(group)]));
};

const cloneMemoryStudyMeetingsState = (state: MemoryStudyMeetingsState): MemoryStudyMeetingsState => ({
  groups: state.groups.map(cloneGroup),
  meetings: state.meetings.map(cloneRecord),
  auditLogs: state.auditLogs.map(cloneAuditLogEntry),
});

export const createMemoryStudyMeetingsState = (
  options: Pick<CreateMemoryStudyMeetingsRepositoryOptions, "groups" | "meetings"> = {},
): MemoryStudyMeetingsState => ({
  groups: (options.groups ?? DEFAULT_MEMORY_GROUPS).map(cloneGroup),
  meetings: (options.meetings ?? []).map(cloneRecord),
  auditLogs: [],
});

const sortMeetingRecords = (records: StudyMeetingRecord[], sortOrder: StudyMeetingSortOrder) => {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...records].sort((first, second) => {
    const startsAtComparison =
      (new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()) * direction;

    if (startsAtComparison !== 0) {
      return startsAtComparison;
    }

    return first.id.localeCompare(second.id);
  });
};

const buildMemoryMeeting = (input: {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}): StudyMeetingRecord => ({
  id: input.id,
  groupId: input.groupId,
  title: input.title,
  description: input.description,
  startsAt: input.startsAt.toISOString(),
  endsAt: input.endsAt.toISOString(),
  canceledAt: null,
  cancellationReason: null,
  createdAt: input.createdAt.toISOString(),
  updatedAt: input.createdAt.toISOString(),
});

const assertMemoryGroupExists = (groupsById: Map<string, MemoryStudyMeetingGroup>, groupId: string) => {
  if (!groupsById.has(groupId)) {
    throw new StudyMeetingGroupNotFoundError(groupId);
  }
};

export const createMemoryStudyMeetingsRepository = (
  options: CreateMemoryStudyMeetingsRepositoryOptions = {},
): StudyMeetingsRepository => {
  const nowProvider = options.nowProvider ?? (() => new Date(Date.now()));
  const idProvider = options.idProvider ?? (() => `study-meeting-${Date.now()}`);
  const state = options.state ?? createMemoryStudyMeetingsState(options);
  const groupsById = buildMemoryGroupsMap(state.groups);
  const meetingStore = state.meetings;

  return {
    async create(input) {
      assertMemoryGroupExists(groupsById, input.groupId);

      const title = normalizeTitle(input.title);
      const description = normalizeOptionalText(input.description);
      const { startsAt, endsAt } = assertValidTimeRange(input.startsAt, input.endsAt);
      const createdAt = nowProvider();
      const meeting = buildMemoryMeeting({
        id: idProvider(),
        groupId: input.groupId,
        title,
        description,
        startsAt,
        endsAt,
        createdAt,
      });

      meetingStore.push(meeting);
      return cloneRecord(meeting);
    },

    async findById(id) {
      const foundMeeting = meetingStore.find((meeting) => meeting.id === id);
      return foundMeeting ? cloneRecord(foundMeeting) : null;
    },

    async findByIdAndGroupId(id, groupId) {
      const foundMeeting = meetingStore.find(
        (meeting) => meeting.id === id && meeting.groupId === groupId,
      );

      return foundMeeting ? cloneRecord(foundMeeting) : null;
    },

    async listByGroupId(input) {
      assertValidListInput(input);

      const filteredMeetings = meetingStore.filter((meeting) => {
        if (meeting.groupId !== input.groupId) {
          return false;
        }

        if (!input.includeCanceled && meeting.canceledAt) {
          return false;
        }

        return true;
      });

      const sortedMeetings = sortMeetingRecords(filteredMeetings, input.sortOrder);
      const total = sortedMeetings.length;
      const offset = (input.page - 1) * input.pageSize;
      const items = sortedMeetings.slice(offset, offset + input.pageSize).map(cloneRecord);

      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: buildTotalPages(total, input.pageSize),
      };
    },

    async update(input) {
      const currentMeeting = meetingStore.find(
        (meeting) => meeting.id === input.meetingId && meeting.groupId === input.groupId,
      );

      if (!currentMeeting) {
        return null;
      }

      if (currentMeeting.canceledAt) {
        return cloneRecord(currentMeeting);
      }

      const nextTitle = input.title === undefined ? currentMeeting.title : normalizeTitle(input.title);
      const nextDescription =
        input.description === undefined
          ? currentMeeting.description
          : normalizeOptionalText(input.description);
      const { startsAt, endsAt } = assertValidTimeRange(
        input.startsAt ?? currentMeeting.startsAt,
        input.endsAt ?? currentMeeting.endsAt,
      );

      currentMeeting.title = nextTitle;
      currentMeeting.description = nextDescription;
      currentMeeting.startsAt = startsAt.toISOString();
      currentMeeting.endsAt = endsAt.toISOString();
      currentMeeting.updatedAt = nowProvider().toISOString();

      return cloneRecord(currentMeeting);
    },

    async cancel(input) {
      const currentMeeting = meetingStore.find(
        (meeting) => meeting.id === input.meetingId && meeting.groupId === input.groupId,
      );

      if (!currentMeeting) {
        return null;
      }

      if (currentMeeting.canceledAt) {
        return cloneRecord(currentMeeting);
      }

      currentMeeting.canceledAt = parseDateInput(input.canceledAt, "canceledAt").toISOString();
      currentMeeting.cancellationReason = normalizeOptionalText(input.cancellationReason);
      currentMeeting.updatedAt = nowProvider().toISOString();

      return cloneRecord(currentMeeting);
    },
  };
};

const assertStudyGroupExistsWithPrisma = async (
  prisma: StudyMeetingsPersistenceClient,
  groupId: string,
) => {
  const group = await prisma.studyGroup.findUnique({
    where: {
      id: groupId,
    },
    select: {
      id: true,
    },
  });

  if (!group) {
    throw new StudyMeetingGroupNotFoundError(groupId);
  }
};

export const createMemoryStudyMeetingGroupsRepository = (
  options: Pick<CreateMemoryStudyMeetingsRepositoryOptions, "state" | "groups"> = {},
): StudyMeetingGroupsRepository => {
  const state = options.state ?? createMemoryStudyMeetingsState(options);

  return {
    async findById(id) {
      const group = state.groups.find((item) => item.id === id);
      return group ? cloneGroup(group) : null;
    },
  };
};

export const createPrismaStudyMeetingGroupsRepository = (
  prisma: StudyMeetingsPersistenceClient = getPrismaClient(),
): StudyMeetingGroupsRepository => {
  return {
    async findById(id) {
      const group = await prisma.studyGroup.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      });

      return group ? mapPrismaStudyGroup(group) : null;
    },
  };
};

export const createMemoryStudyMeetingsAuditRepository = (
  state: MemoryStudyMeetingsState,
): StudyMeetingAuditRepository => {
  return {
    async create(entry) {
      state.auditLogs.unshift(cloneAuditLogEntry(entry));
    },
  };
};

export const createPrismaStudyMeetingsAuditRepository = (
  prisma: StudyMeetingsAuditPersistenceClient = getPrismaClient(),
): StudyMeetingAuditRepository => {
  return {
    async create(entry) {
      await prisma.auditLog.create({
        data: {
          actorName: entry.actorName,
          actorRole: toPrismaUserRole(entry.actorRole),
          action: entry.action,
          entity: entry.entity,
          note: entry.note,
        },
      });
    },
  };
};

export const createPrismaStudyMeetingsRepository = (
  prisma: StudyMeetingsPersistenceClient = getPrismaClient(),
): StudyMeetingsRepository => {
  return {
    async create(input) {
      await assertStudyGroupExistsWithPrisma(prisma, input.groupId);

      const title = normalizeTitle(input.title);
      const description = normalizeOptionalText(input.description);
      const { startsAt, endsAt } = assertValidTimeRange(input.startsAt, input.endsAt);
      const createdMeeting = await prisma.studyMeeting.create({
        data: {
          groupId: input.groupId,
          title,
          description,
          startsAt,
          endsAt,
        },
      });

      return mapPrismaStudyMeeting(createdMeeting);
    },

    async findById(id) {
      const meeting = await prisma.studyMeeting.findUnique({
        where: {
          id,
        },
      });

      return meeting ? mapPrismaStudyMeeting(meeting) : null;
    },

    async findByIdAndGroupId(id, groupId) {
      const meeting = await prisma.studyMeeting.findFirst({
        where: {
          id,
          groupId,
        },
      });

      return meeting ? mapPrismaStudyMeeting(meeting) : null;
    },

    async listByGroupId(input) {
      assertValidListInput(input);

      const where = {
        groupId: input.groupId,
        ...(input.includeCanceled ? {} : { canceledAt: null }),
      };
      const orderBy = [{ startsAt: input.sortOrder }, { id: "asc" as const }];
      const [total, meetings] = await Promise.all([
        prisma.studyMeeting.count({ where }),
        prisma.studyMeeting.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ]);

      return {
        items: meetings.map(mapPrismaStudyMeeting),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: buildTotalPages(total, input.pageSize),
      };
    },

    async update(input) {
      const currentMeeting = await prisma.studyMeeting.findFirst({
        where: {
          id: input.meetingId,
          groupId: input.groupId,
        },
      });

      if (!currentMeeting) {
        return null;
      }

      const nextTitle = input.title === undefined ? currentMeeting.title : normalizeTitle(input.title);
      const nextDescription =
        input.description === undefined
          ? currentMeeting.description
          : normalizeOptionalText(input.description);
      const { startsAt, endsAt } = assertValidTimeRange(
        input.startsAt ?? currentMeeting.startsAt,
        input.endsAt ?? currentMeeting.endsAt,
      );

      const updateResult = await prisma.studyMeeting.updateMany({
        where: {
          id: currentMeeting.id,
          groupId: input.groupId,
          canceledAt: null,
        },
        data: {
          title: nextTitle,
          description: nextDescription,
          startsAt,
          endsAt,
        },
      });

      if (updateResult.count !== 1) {
        const latestMeeting = await prisma.studyMeeting.findFirst({
          where: {
            id: currentMeeting.id,
            groupId: input.groupId,
          },
        });

        return latestMeeting ? mapPrismaStudyMeeting(latestMeeting) : null;
      }

      const updatedMeeting = await prisma.studyMeeting.findUnique({
        where: {
          id: currentMeeting.id,
        },
      });

      if (!updatedMeeting) {
        return null;
      }

      return mapPrismaStudyMeeting(updatedMeeting);
    },

    async cancel(input) {
      const currentMeeting = await prisma.studyMeeting.findFirst({
        where: {
          id: input.meetingId,
          groupId: input.groupId,
        },
      });

      if (!currentMeeting) {
        return null;
      }

      if (currentMeeting.canceledAt) {
        return mapPrismaStudyMeeting(currentMeeting);
      }

      const canceledAt = parseDateInput(input.canceledAt, "canceledAt");
      const cancelResult = await prisma.studyMeeting.updateMany({
        where: {
          id: currentMeeting.id,
          canceledAt: null,
        },
        data: {
          canceledAt,
          cancellationReason: normalizeOptionalText(input.cancellationReason),
        },
      });

      if (cancelResult.count !== 1) {
        const latestMeeting = await prisma.studyMeeting.findFirst({
          where: {
            id: currentMeeting.id,
            groupId: input.groupId,
          },
        });

        return latestMeeting ? mapPrismaStudyMeeting(latestMeeting) : null;
      }

      const canceledMeeting = await prisma.studyMeeting.findUnique({
        where: {
          id: currentMeeting.id,
        },
      });

      if (!canceledMeeting) {
        return null;
      }

      return mapPrismaStudyMeeting(canceledMeeting);
    },
  };
};

const STUDY_MEETINGS_TRANSACTION_MAX_RETRIES = 3;

export class StudyMeetingsTransactionConflictError extends Error {
  constructor(message = "Não foi possível concluir a operação concorrente dos encontros agora.") {
    super(message);
    this.name = "StudyMeetingsTransactionConflictError";
  }
}

export const createPrismaStudyMeetingsTransactionRunner = (
  prisma: Pick<PrismaClient, "$transaction"> = getPrismaClient(),
): StudyMeetingsTransactionRunner => {
  return {
    async run<T>(callback: (context: StudyMeetingsTransactionalContext) => Promise<T>) {
      for (let attempt = 1; attempt <= STUDY_MEETINGS_TRANSACTION_MAX_RETRIES; attempt += 1) {
        try {
          return await prisma.$transaction(
            async (transaction) => {
              return callback({
                meetingsRepository: createPrismaStudyMeetingsRepository(transaction),
                groupsRepository: createPrismaStudyMeetingGroupsRepository(transaction),
                auditRepository: createPrismaStudyMeetingsAuditRepository(transaction),
              });
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );
        } catch (error) {
          const canRetry =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2034" &&
            attempt < STUDY_MEETINGS_TRANSACTION_MAX_RETRIES;

          if (!canRetry) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2034"
            ) {
              throw new StudyMeetingsTransactionConflictError();
            }

            throw error;
          }
        }
      }

      throw new StudyMeetingsTransactionConflictError();
    },
  };
};

export const createMemoryStudyMeetingsTransactionRunner = (
  state: MemoryStudyMeetingsState,
  options: Pick<CreateMemoryStudyMeetingsRepositoryOptions, "nowProvider" | "idProvider"> = {},
): StudyMeetingsTransactionRunner => {
  return {
    async run<T>(callback: (context: StudyMeetingsTransactionalContext) => Promise<T>) {
      const workingState = cloneMemoryStudyMeetingsState(state);
      const context: StudyMeetingsTransactionalContext = {
        meetingsRepository: createMemoryStudyMeetingsRepository({
          state: workingState,
          nowProvider: options.nowProvider,
          idProvider: options.idProvider,
        }),
        groupsRepository: createMemoryStudyMeetingGroupsRepository({
          state: workingState,
        }),
        auditRepository: createMemoryStudyMeetingsAuditRepository(workingState),
      };

      const result = await callback(context);
      state.groups.splice(0, state.groups.length, ...workingState.groups.map(cloneGroup));
      state.meetings.splice(0, state.meetings.length, ...workingState.meetings.map(cloneRecord));
      state.auditLogs.splice(
        0,
        state.auditLogs.length,
        ...workingState.auditLogs.map(cloneAuditLogEntry),
      );
      return result;
    },
  };
};

export const getMemoryStudyMeetingsAuditLogs = (state: MemoryStudyMeetingsState) => {
  return state.auditLogs.map(cloneAuditLogEntry);
};

export const createStudyMeetingsRepository = (): StudyMeetingsRepository => {
  if (env.nodeEnv === "test") {
    return createMemoryStudyMeetingsRepository({
      groups: DEFAULT_MEMORY_GROUPS,
      meetings: [],
    });
  }

  return env.databaseUrl
    ? createPrismaStudyMeetingsRepository()
    : createMemoryStudyMeetingsRepository({
        groups: DEFAULT_MEMORY_GROUPS,
        meetings: [],
      });
};

export {
  DEFAULT_MEMORY_GROUPS,
  assertValidListInput,
  assertValidTimeRange,
  normalizeOptionalText,
  normalizeTitle,
};

export const buildDefaultStudyMeetingListInput = (
  groupId: string,
  overrides: Partial<Omit<StudyMeetingListInput, "groupId">> = {},
): StudyMeetingListInput => ({
  groupId,
  page: overrides.page ?? DEFAULT_STUDY_MEETINGS_PAGE,
  pageSize: overrides.pageSize ?? DEFAULT_STUDY_MEETINGS_PAGE_SIZE,
  sortOrder: overrides.sortOrder ?? "asc",
  includeCanceled: overrides.includeCanceled ?? false,
});
