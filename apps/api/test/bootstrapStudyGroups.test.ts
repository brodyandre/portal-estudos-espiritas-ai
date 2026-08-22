import { describe, expect, it } from "vitest";
import { GroupStatus, KnowledgeBookStatus, UserRole } from "@prisma/client";

import {
  bootstrapStudyGroups,
  STUDY_GROUPS_BOOTSTRAP_EXIT_CODES,
  type StudyGroupsBootstrapPrismaClient,
} from "../scripts/bootstrap-study-groups";

type CanonicalGroupSlug = "emmanuel" | "a-caminho-da-luz";

interface FakeBook {
  id: string;
  slug: CanonicalGroupSlug;
  title: string;
  status: KnowledgeBookStatus;
}

interface FakeGroup {
  id: CanonicalGroupSlug;
  name: string;
  status: GroupStatus;
  knowledgeBookId: string | null;
  bookTitle: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  participantCount: number | null;
  meetUrl: string | null;
  description: string | null;
}

interface FakeUser {
  id: string;
  role: UserRole;
  groupSlug: CanonicalGroupSlug | null;
}

interface FakeState {
  books: FakeBook[];
  groups: FakeGroup[];
  users: FakeUser[];
  teacherStudyGroups: Array<{ userId: string; groupId: CanonicalGroupSlug }>;
}

const canonicalBooks = (): FakeBook[] => [
  {
    id: "book-emmanuel",
    slug: "emmanuel",
    title: "Emmanuel",
    status: KnowledgeBookStatus.ACTIVE,
  },
  {
    id: "book-a-caminho-da-luz",
    slug: "a-caminho-da-luz",
    title: "A Caminho da Luz",
    status: KnowledgeBookStatus.ACTIVE,
  },
];

const cloneState = (state: FakeState): FakeState => ({
  books: state.books.map((book) => ({ ...book })),
  groups: state.groups.map((group) => ({ ...group })),
  users: state.users.map((user) => ({ ...user })),
  teacherStudyGroups: state.teacherStudyGroups.map((membership) => ({ ...membership })),
});

const createGroup = (
  overrides: Partial<FakeGroup> & Pick<FakeGroup, "id" | "name" | "knowledgeBookId" | "bookTitle">,
): FakeGroup => ({
  status: GroupStatus.ACTIVE,
  meetingDay: "segunda-feira",
  meetingTime: "20h",
  participantCount: 25,
  meetUrl: "https://meet.google.com/operational",
  description: "Operacional",
  ...overrides,
});

const createFakePrisma = (initialState: Partial<FakeState>): StudyGroupsBootstrapPrismaClient & { state: FakeState } => {
  const client = {
    state: {
      books: initialState.books ?? canonicalBooks(),
      groups: initialState.groups ?? [],
      users: initialState.users ?? [],
      teacherStudyGroups: initialState.teacherStudyGroups ?? [],
    },

    async $transaction<T>(callback: (transaction: never) => Promise<T>): Promise<T> {
      const draft = cloneState(client.state);
      const transaction = {
        knowledgeBook: {
          async findMany() {
            return draft.books.map((book) => ({ ...book }));
          },
        },
        studyGroup: {
          async findMany() {
            return draft.groups.map((group) => ({
              id: group.id,
              name: group.name,
              bookTitle: group.bookTitle,
              status: group.status,
              knowledgeBookId: group.knowledgeBookId,
            }));
          },
          async create(args: { data: FakeGroup }) {
            draft.groups.push({ ...args.data });
            return { id: args.data.id };
          },
          async update(args: {
            where: { id: CanonicalGroupSlug };
            data: { knowledgeBookId: string; bookTitle?: string };
          }) {
            const group = draft.groups.find((item) => item.id === args.where.id);

            if (!group) {
              throw new Error("GROUP_NOT_FOUND");
            }

            group.knowledgeBookId = args.data.knowledgeBookId;

            if (args.data.bookTitle !== undefined) {
              group.bookTitle = args.data.bookTitle;
            }

            return { id: group.id };
          },
        },
        user: {
          async findMany() {
            return draft.users
              .filter(
                (user) =>
                  user.role === UserRole.TEACHER &&
                  (user.groupSlug === "emmanuel" || user.groupSlug === "a-caminho-da-luz"),
              )
              .map((user) => ({ id: user.id, groupSlug: user.groupSlug }));
          },
        },
        teacherStudyGroup: {
          async createMany(args: {
            data: Array<{ userId: string; groupId: CanonicalGroupSlug }>;
            skipDuplicates: true;
          }) {
            let count = 0;

            for (const membership of args.data) {
              const exists = draft.teacherStudyGroups.some(
                (item) => item.userId === membership.userId && item.groupId === membership.groupId,
              );

              if (!exists) {
                draft.teacherStudyGroups.push({ ...membership });
                count += 1;
              }
            }

            return { count };
          },
        },
      };

      const result = await callback(transaction as never);
      client.state = draft;
      return result;
    },

    async $disconnect() {
      return undefined;
    },
  };

  return client as StudyGroupsBootstrapPrismaClient & { state: FakeState };
};

describe("bootstrapStudyGroups", () => {
  it("cria somente os dois grupos canonicos vinculados aos KnowledgeBooks ativos", async () => {
    const prisma = createFakePrisma({});

    const result = await bootstrapStudyGroups(prisma);

    expect(result).toMatchObject({
      status: "created",
      exitCode: STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.success,
      createdGroups: 2,
    });
    expect(prisma.state.groups).toEqual([
      expect.objectContaining({
        id: "emmanuel",
        name: "Emmanuel",
        status: GroupStatus.ACTIVE,
        knowledgeBookId: "book-emmanuel",
        bookTitle: "Emmanuel",
        meetingDay: null,
        meetingTime: null,
        participantCount: null,
        meetUrl: null,
        description: null,
      }),
      expect.objectContaining({
        id: "a-caminho-da-luz",
        name: "A Caminho da Luz",
        status: GroupStatus.ACTIVE,
        knowledgeBookId: "book-a-caminho-da-luz",
        bookTitle: "A Caminho da Luz",
      }),
    ]);
  });

  it("e idempotente e nao duplica grupos nem memberships", async () => {
    const prisma = createFakePrisma({
      users: [
        { id: "teacher-1", role: UserRole.TEACHER, groupSlug: "emmanuel" },
        { id: "teacher-2", role: UserRole.TEACHER, groupSlug: "a-caminho-da-luz" },
      ],
    });

    await bootstrapStudyGroups(prisma);
    const rerun = await bootstrapStudyGroups(prisma);

    expect(rerun.status).toBe("already_initialized");
    expect(prisma.state.groups).toHaveLength(2);
    expect(prisma.state.teacherStudyGroups).toEqual([
      { userId: "teacher-1", groupId: "emmanuel" },
      { userId: "teacher-2", groupId: "a-caminho-da-luz" },
    ]);
  });

  it("nao sobrescreve campos operacionais nem status de grupo existente", async () => {
    const prisma = createFakePrisma({
      groups: [
        createGroup({
          id: "emmanuel",
          name: "Emmanuel",
          status: GroupStatus.INACTIVE,
          knowledgeBookId: "book-emmanuel",
          bookTitle: "Emmanuel",
        }),
        createGroup({
          id: "a-caminho-da-luz",
          name: "A Caminho da Luz",
          knowledgeBookId: "book-a-caminho-da-luz",
          bookTitle: "A Caminho da Luz",
        }),
      ],
    });

    const result = await bootstrapStudyGroups(prisma);

    expect(result.status).toBe("already_initialized");
    expect(prisma.state.groups[0]).toMatchObject({
      status: GroupStatus.INACTIVE,
      meetingDay: "segunda-feira",
      meetingTime: "20h",
      participantCount: 25,
      meetUrl: "https://meet.google.com/operational",
      description: "Operacional",
    });
  });

  it("vincula com seguranca grupo existente sem knowledgeBookId", async () => {
    const prisma = createFakePrisma({
      groups: [
        createGroup({
          id: "emmanuel",
          name: "Emmanuel",
          knowledgeBookId: null,
          bookTitle: "Emmanuel",
        }),
        createGroup({
          id: "a-caminho-da-luz",
          name: "A Caminho da Luz",
          knowledgeBookId: "book-a-caminho-da-luz",
          bookTitle: "A Caminho da Luz",
        }),
      ],
    });

    const result = await bootstrapStudyGroups(prisma);

    expect(result).toMatchObject({ status: "linked", linkedGroups: 1 });
    expect(prisma.state.groups.find((group) => group.id === "emmanuel")?.knowledgeBookId).toBe(
      "book-emmanuel",
    );
  });

  it.each([
    {
      name: "Emmanuel ausente",
      books: canonicalBooks().filter((book) => book.slug !== "emmanuel"),
      status: "missing_knowledge_book",
    },
    {
      name: "A Caminho da Luz ausente",
      books: canonicalBooks().filter((book) => book.slug !== "a-caminho-da-luz"),
      status: "missing_knowledge_book",
    },
    {
      name: "KnowledgeBook inativo",
      books: canonicalBooks().map((book) =>
        book.slug === "emmanuel" ? { ...book, status: KnowledgeBookStatus.INACTIVE } : book,
      ),
      status: "inactive_knowledge_book",
    },
  ])("falha sem escrita quando $name", async ({ books, status }) => {
    const prisma = createFakePrisma({ books });

    const result = await bootstrapStudyGroups(prisma);

    expect(result).toMatchObject({
      status,
      exitCode: STUDY_GROUPS_BOOTSTRAP_EXIT_CODES.conflict,
      createdGroups: 0,
    });
    expect(prisma.state.groups).toEqual([]);
    expect(prisma.state.teacherStudyGroups).toEqual([]);
  });

  it.each([
    createGroup({
      id: "emmanuel",
      name: "Grupo errado",
      knowledgeBookId: "book-emmanuel",
      bookTitle: "Emmanuel",
    }),
    createGroup({
      id: "emmanuel",
      name: "Emmanuel",
      knowledgeBookId: "book-a-caminho-da-luz",
      bookTitle: "Emmanuel",
    }),
    createGroup({
      id: "emmanuel",
      name: "Emmanuel",
      knowledgeBookId: "book-emmanuel",
      bookTitle: "Outro livro",
    }),
  ])("falha em conflito de grupo existente sem corrigir silenciosamente", async (conflictingGroup) => {
    const prisma = createFakePrisma({
      groups: [
        conflictingGroup,
        createGroup({
          id: "a-caminho-da-luz",
          name: "A Caminho da Luz",
          knowledgeBookId: "book-a-caminho-da-luz",
          bookTitle: "A Caminho da Luz",
        }),
      ],
      users: [{ id: "teacher-1", role: UserRole.TEACHER, groupSlug: "emmanuel" }],
    });

    const result = await bootstrapStudyGroups(prisma);

    expect(result.status).toBe("study_group_conflict");
    expect(prisma.state.groups[0]).toEqual(conflictingGroup);
    expect(prisma.state.teacherStudyGroups).toEqual([]);
  });

  it("faz backfill apenas de professores legados e ignora estudantes", async () => {
    const prisma = createFakePrisma({
      users: [
        { id: "teacher-1", role: UserRole.TEACHER, groupSlug: "emmanuel" },
        { id: "student-1", role: UserRole.STUDENT, groupSlug: "emmanuel" },
        { id: "teacher-other", role: UserRole.TEACHER, groupSlug: null },
      ],
      teacherStudyGroups: [{ userId: "teacher-1", groupId: "emmanuel" }],
    });

    const result = await bootstrapStudyGroups(prisma);

    expect(result.backfilledTeacherGroups).toBe(0);
    expect(prisma.state.teacherStudyGroups).toEqual([
      { userId: "teacher-1", groupId: "emmanuel" },
    ]);
    expect(prisma.state.teacherStudyGroups).not.toContainEqual({
      userId: "student-1",
      groupId: "emmanuel",
    });
  });
});
