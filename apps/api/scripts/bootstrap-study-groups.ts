import { config } from "dotenv";
import { resolve } from "node:path";

import {
  GroupStatus,
  KnowledgeBookStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";

const MAX_TRANSACTION_ATTEMPTS = 3;

export const STUDY_GROUPS_BOOTSTRAP_EXIT_CODES = {
  success: 0,
  validation: 1,
  conflict: 2,
  database: 3,
} as const;

type StudyGroupsBootstrapExitCode =
  (typeof STUDY_GROUPS_BOOTSTRAP_EXIT_CODES)[keyof typeof STUDY_GROUPS_BOOTSTRAP_EXIT_CODES];

type StudyGroupsBootstrapLogEvent =
  | "study_groups_bootstrap_started"
  | "study_groups_bootstrap_created"
  | "study_groups_bootstrap_already_initialized"
  | "study_groups_bootstrap_conflict"
  | "study_groups_bootstrap_failed";

type StudyGroupsBootstrapLogger = (
  event: StudyGroupsBootstrapLogEvent,
  details?: Record<string, unknown>,
) => void;

type CanonicalGroupSlug = "emmanuel" | "a-caminho-da-luz";

interface CanonicalStudyGroupDefinition {
  id: CanonicalGroupSlug;
  name: string;
  knowledgeBookSlug: CanonicalGroupSlug;
}

const CANONICAL_STUDY_GROUPS: CanonicalStudyGroupDefinition[] = [
  {
    id: "emmanuel",
    name: "Emmanuel",
    knowledgeBookSlug: "emmanuel",
  },
  {
    id: "a-caminho-da-luz",
    name: "A Caminho da Luz",
    knowledgeBookSlug: "a-caminho-da-luz",
  },
];

export type StudyGroupsBootstrapStatus =
  | "created"
  | "already_initialized"
  | "linked"
  | "missing_knowledge_book"
  | "inactive_knowledge_book"
  | "study_group_conflict";

export interface StudyGroupsBootstrapResult {
  status: StudyGroupsBootstrapStatus;
  exitCode: StudyGroupsBootstrapExitCode;
  createdGroups: number;
  linkedGroups: number;
  backfilledTeacherGroups: number;
  attempts: number;
  groups: CanonicalGroupSlug[];
  reason?: string;
}

interface BootstrapKnowledgeBookRecord {
  id: string;
  slug: string;
  title: string;
  status: KnowledgeBookStatus;
}

interface BootstrapStudyGroupRecord {
  id: string;
  name: string;
  bookTitle: string | null;
  status: GroupStatus;
  knowledgeBookId: string | null;
}

interface BootstrapUserRecord {
  id: string;
  groupSlug: string | null;
}

interface BootstrapTransactionClient {
  knowledgeBook: {
    findMany(args: {
      where: { slug: { in: CanonicalGroupSlug[] } };
      select: { id: true; slug: true; title: true; status: true };
    }): Promise<BootstrapKnowledgeBookRecord[]>;
  };
  studyGroup: {
    findMany(args: {
      where: { id: { in: CanonicalGroupSlug[] } };
      select: {
        id: true;
        name: true;
        bookTitle: true;
        status: true;
        knowledgeBookId: true;
      };
    }): Promise<BootstrapStudyGroupRecord[]>;
    create(args: {
      data: {
        id: CanonicalGroupSlug;
        name: string;
        status: GroupStatus;
        knowledgeBookId: string;
        bookTitle: string;
        meetingDay: null;
        meetingTime: null;
        participantCount: null;
        meetUrl: null;
        description: null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: CanonicalGroupSlug };
      data: { knowledgeBookId: string; bookTitle?: string };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  user: {
    findMany(args: {
      where: {
        role: UserRole;
        groupSlug: { in: CanonicalGroupSlug[] };
      };
      select: { id: true; groupSlug: true };
    }): Promise<BootstrapUserRecord[]>;
  };
  teacherStudyGroup: {
    createMany(args: {
      data: Array<{ userId: string; groupId: CanonicalGroupSlug }>;
      skipDuplicates: true;
    }): Promise<{ count: number }>;
  };
}

export interface StudyGroupsBootstrapPrismaClient {
  $transaction<T>(
    action: (transaction: BootstrapTransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
  $disconnect(): Promise<void>;
}

interface RunStudyGroupsBootstrapOptions {
  env?: NodeJS.ProcessEnv;
  logger?: StudyGroupsBootstrapLogger;
  createPrismaClient?: () => StudyGroupsBootstrapPrismaClient;
}

class StudyGroupsBootstrapValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "StudyGroupsBootstrapValidationError";
  }
}

class StudyGroupsBootstrapConflictError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "StudyGroupsBootstrapConflictError";
  }
}

const isBlank = (value: string) => value.trim().length === 0;

const validateDatabaseUrl = (databaseUrl: string | undefined) => {
  if (!databaseUrl || isBlank(databaseUrl)) {
    throw new StudyGroupsBootstrapValidationError("DATABASE_URL_REQUIRED");
  }

  try {
    const parsedUrl = new URL(databaseUrl);

    if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
      throw new StudyGroupsBootstrapValidationError("DATABASE_URL_INVALID");
    }
  } catch (error) {
    if (error instanceof StudyGroupsBootstrapValidationError) {
      throw error;
    }

    throw new StudyGroupsBootstrapValidationError("DATABASE_URL_INVALID");
  }
};

const isKnownPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const writeStudyGroupsBootstrapLog: StudyGroupsBootstrapLogger = (
  event,
  details = {},
) => {
  const output = JSON.stringify({
    scope: "study-groups-bootstrap",
    event,
    ...details,
  });

  if (event === "study_groups_bootstrap_failed" || event === "study_groups_bootstrap_conflict") {
    console.error(output);
    return;
  }

  console.info(output);
};

const getBookBySlug = (
  books: BootstrapKnowledgeBookRecord[],
  slug: CanonicalGroupSlug,
) => books.find((book) => book.slug === slug);

const getGroupById = (
  groups: BootstrapStudyGroupRecord[],
  id: CanonicalGroupSlug,
) => groups.find((group) => group.id === id);

const assertKnowledgeBooksReady = (books: BootstrapKnowledgeBookRecord[]) => {
  for (const definition of CANONICAL_STUDY_GROUPS) {
    const book = getBookBySlug(books, definition.knowledgeBookSlug);

    if (!book) {
      throw new StudyGroupsBootstrapConflictError(
        `MISSING_KNOWLEDGE_BOOK_${definition.knowledgeBookSlug}`,
      );
    }

    if (book.status !== KnowledgeBookStatus.ACTIVE) {
      throw new StudyGroupsBootstrapConflictError(
        `INACTIVE_KNOWLEDGE_BOOK_${definition.knowledgeBookSlug}`,
      );
    }
  }
};

const assertExistingGroupCompatible = (
  group: BootstrapStudyGroupRecord,
  definition: CanonicalStudyGroupDefinition,
  book: BootstrapKnowledgeBookRecord,
) => {
  if (group.name !== definition.name) {
    throw new StudyGroupsBootstrapConflictError(`STUDY_GROUP_NAME_CONFLICT_${definition.id}`);
  }

  if (group.knowledgeBookId && group.knowledgeBookId !== book.id) {
    throw new StudyGroupsBootstrapConflictError(`STUDY_GROUP_BOOK_CONFLICT_${definition.id}`);
  }

  if (group.bookTitle && group.bookTitle !== book.title) {
    throw new StudyGroupsBootstrapConflictError(`STUDY_GROUP_BOOK_TITLE_CONFLICT_${definition.id}`);
  }
};

const backfillTeacherStudyGroups = async (
  transaction: BootstrapTransactionClient,
): Promise<number> => {
  const groupIds = CANONICAL_STUDY_GROUPS.map((group) => group.id);
  const teachers = await transaction.user.findMany({
    where: {
      role: UserRole.TEACHER,
      groupSlug: { in: groupIds },
    },
    select: {
      id: true,
      groupSlug: true,
    },
  });
  const memberships = teachers
    .filter((teacher): teacher is { id: string; groupSlug: CanonicalGroupSlug } =>
      groupIds.includes(teacher.groupSlug as CanonicalGroupSlug),
    )
    .map((teacher) => ({
      userId: teacher.id,
      groupId: teacher.groupSlug,
    }));

  if (memberships.length === 0) {
    return 0;
  }

  const result = await transaction.teacherStudyGroup.createMany({
    data: memberships,
    skipDuplicates: true,
  });

  return result.count;
};

export const bootstrapStudyGroups = async (
  prisma: StudyGroupsBootstrapPrismaClient,
): Promise<StudyGroupsBootstrapResult> => {
  const groupIds = CANONICAL_STUDY_GROUPS.map((group) => group.id);

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (transaction) => {
          const books = await transaction.knowledgeBook.findMany({
            where: {
              slug: { in: groupIds },
            },
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
            },
          });

          assertKnowledgeBooksReady(books);

          const existingGroups = await transaction.studyGroup.findMany({
            where: {
              id: { in: groupIds },
            },
            select: {
              id: true,
              name: true,
              bookTitle: true,
              status: true,
              knowledgeBookId: true,
            },
          });
          let createdGroups = 0;
          let linkedGroups = 0;

          for (const definition of CANONICAL_STUDY_GROUPS) {
            const book = getBookBySlug(books, definition.knowledgeBookSlug);

            if (!book) {
              throw new StudyGroupsBootstrapConflictError(
                `MISSING_KNOWLEDGE_BOOK_${definition.knowledgeBookSlug}`,
              );
            }

            const existingGroup = getGroupById(existingGroups, definition.id);

            if (!existingGroup) {
              await transaction.studyGroup.create({
                data: {
                  id: definition.id,
                  name: definition.name,
                  status: GroupStatus.ACTIVE,
                  knowledgeBookId: book.id,
                  bookTitle: book.title,
                  meetingDay: null,
                  meetingTime: null,
                  participantCount: null,
                  meetUrl: null,
                  description: null,
                },
                select: { id: true },
              });
              createdGroups += 1;
              continue;
            }

            assertExistingGroupCompatible(existingGroup, definition, book);

            if (!existingGroup.knowledgeBookId || !existingGroup.bookTitle) {
              await transaction.studyGroup.update({
                where: {
                  id: definition.id,
                },
                data: {
                  knowledgeBookId: book.id,
                  ...(existingGroup.bookTitle ? {} : { bookTitle: book.title }),
                },
                select: { id: true },
              });
              linkedGroups += 1;
            }
          }

          const backfilledTeacherGroups = await backfillTeacherStudyGroups(transaction);

          return {
            createdGroups,
            linkedGroups,
            backfilledTeacherGroups,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const status =
        result.createdGroups > 0
          ? "created"
          : result.linkedGroups > 0 || result.backfilledTeacherGroups > 0
            ? "linked"
            : "already_initialized";

      return {
        status,
        exitCode: STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.success,
        createdGroups: result.createdGroups,
        linkedGroups: result.linkedGroups,
        backfilledTeacherGroups: result.backfilledTeacherGroups,
        attempts: attempt,
        groups: groupIds,
      };
    } catch (error) {
      if (isKnownPrismaError(error, "P2034") && attempt < MAX_TRANSACTION_ATTEMPTS) {
        continue;
      }

      if (error instanceof StudyGroupsBootstrapConflictError) {
        return {
          status: error.code.startsWith("MISSING_KNOWLEDGE_BOOK_")
            ? "missing_knowledge_book"
            : error.code.startsWith("INACTIVE_KNOWLEDGE_BOOK_")
              ? "inactive_knowledge_book"
              : "study_group_conflict",
          exitCode: STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.conflict,
          createdGroups: 0,
          linkedGroups: 0,
          backfilledTeacherGroups: 0,
          attempts: attempt,
          groups: groupIds,
          reason: error.code,
        };
      }

      throw error;
    }
  }

  throw new Error("STUDY_GROUPS_BOOTSTRAP_RETRY_EXHAUSTED");
};

export const runStudyGroupsBootstrap = async ({
  env = process.env,
  logger = writeStudyGroupsBootstrapLog,
  createPrismaClient = () => new PrismaClient(),
}: RunStudyGroupsBootstrapOptions = {}) => {
  let prisma: StudyGroupsBootstrapPrismaClient | undefined;
  let exitCode: StudyGroupsBootstrapExitCode = STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.database;

  try {
    validateDatabaseUrl(env.DATABASE_URL);

    logger("study_groups_bootstrap_started", {
      groups: CANONICAL_STUDY_GROUPS.map((group) => group.id),
    });

    prisma = createPrismaClient();
    const result = await bootstrapStudyGroups(prisma);

    if (result.status === "created" || result.status === "linked") {
      logger("study_groups_bootstrap_created", {
        status: result.status,
        groups: result.groups,
        createdGroups: result.createdGroups,
        linkedGroups: result.linkedGroups,
        backfilledTeacherGroups: result.backfilledTeacherGroups,
        attempts: result.attempts,
      });
    } else if (result.status === "already_initialized") {
      logger("study_groups_bootstrap_already_initialized", {
        groups: result.groups,
        backfilledTeacherGroups: result.backfilledTeacherGroups,
        attempts: result.attempts,
      });
    } else {
      logger("study_groups_bootstrap_conflict", {
        status: result.status,
        reason: result.reason,
        groups: result.groups,
        attempts: result.attempts,
      });
    }

    exitCode = result.exitCode;
  } catch (error) {
    if (error instanceof StudyGroupsBootstrapValidationError) {
      logger("study_groups_bootstrap_failed", { reason: error.code });
      exitCode = STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.validation;
    } else {
      const reason =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "DATABASE_OPERATION_FAILED";
      logger("study_groups_bootstrap_failed", { reason });
      exitCode = STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.database;
    }
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {
        logger("study_groups_bootstrap_failed", {
          reason: "DATABASE_DISCONNECT_FAILED",
        });
        exitCode = STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.database;
      }
    }
  }

  return exitCode;
};

const main = async () => {
  config({ path: resolve(__dirname, "../../../.env"), quiet: true });
  const exitCode = await runStudyGroupsBootstrap();
  process.exitCode = exitCode;
};

if (require.main === module) {
  void main();
}
