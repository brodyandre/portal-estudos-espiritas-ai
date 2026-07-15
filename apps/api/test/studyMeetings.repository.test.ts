import { describe, expect, it } from "vitest";

import {
  DEFAULT_MEMORY_GROUPS,
  buildDefaultStudyMeetingListInput,
  createMemoryStudyMeetingsRepository,
  createPrismaStudyMeetingsRepository,
} from "../src/modules/study-meetings/study-meetings.repository";
import {
  InvalidStudyMeetingTimeRangeError,
  StudyMeetingGroupNotFoundError,
  type StudyMeetingRecord,
} from "../src/modules/study-meetings/study-meetings.types";

type PrismaMeetingRow = {
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
};

type PrismaGroupRow = {
  id: string;
};

type FakePrismaState = {
  groups: PrismaGroupRow[];
  meetings: PrismaMeetingRow[];
};

type SimulatedCancelRace = {
  canceledAt: Date;
  cancellationReason: string;
};

const cloneDate = (value: Date | null) => (value ? new Date(value) : null);

const cloneState = (state: FakePrismaState): FakePrismaState => ({
  groups: state.groups.map((group) => ({ ...group })),
  meetings: state.meetings.map((meeting) => ({
    ...meeting,
    startsAt: new Date(meeting.startsAt),
    endsAt: new Date(meeting.endsAt),
    canceledAt: cloneDate(meeting.canceledAt),
    createdAt: new Date(meeting.createdAt),
    updatedAt: new Date(meeting.updatedAt),
  })),
});

class FakeStudyMeetingsPrisma {
  readonly state: FakePrismaState;
  private readonly nowProvider: () => Date;
  private readonly idProvider: () => string;
  private readonly simulatedCancelRace?: SimulatedCancelRace;

  constructor(
    initialState: FakePrismaState,
    options: {
      nowProvider: () => Date;
      idProvider: () => string;
      simulatedCancelRace?: SimulatedCancelRace;
    },
  ) {
    this.state = cloneState(initialState);
    this.nowProvider = options.nowProvider;
    this.idProvider = options.idProvider;
    this.simulatedCancelRace = options.simulatedCancelRace;
  }

  studyGroup = {
    findUnique: async (args: { where: { id: string }; select?: { id: true } }) => {
      const group = this.state.groups.find((item) => item.id === args.where.id);
      return group ? { id: group.id } : null;
    },
  };

  studyMeeting = {
    create: async (args: {
      data: {
        groupId: string;
        title: string;
        description: string | null;
        startsAt: Date;
        endsAt: Date;
      };
    }) => {
      const createdAt = this.nowProvider();
      const createdMeeting: PrismaMeetingRow = {
        id: this.idProvider(),
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

      this.state.meetings.push(createdMeeting);
      return { ...createdMeeting };
    },

    findUnique: async (args: { where: { id: string } }) => {
      const meeting = this.state.meetings.find((item) => item.id === args.where.id);
      return meeting ? { ...meeting } : null;
    },

    findFirst: async (args: { where: { id: string; groupId: string } }) => {
      const meeting = this.state.meetings.find(
        (item) => item.id === args.where.id && item.groupId === args.where.groupId,
      );

      return meeting ? { ...meeting } : null;
    },

    count: async (args: { where: { groupId: string; canceledAt?: null } }) => {
      return this.state.meetings.filter((meeting) => {
        if (meeting.groupId !== args.where.groupId) {
          return false;
        }

        if (Object.prototype.hasOwnProperty.call(args.where, "canceledAt") && meeting.canceledAt !== null) {
          return false;
        }

        return true;
      }).length;
    },

    findMany: async (args: {
      where: { groupId: string; canceledAt?: null };
      orderBy: Array<{ startsAt: "asc" | "desc" } | { id: "asc" }>;
      skip: number;
      take: number;
    }) => {
      const direction = "startsAt" in args.orderBy[0] && args.orderBy[0].startsAt === "desc" ? -1 : 1;
      const filtered = this.state.meetings.filter((meeting) => {
        if (meeting.groupId !== args.where.groupId) {
          return false;
        }

        if (Object.prototype.hasOwnProperty.call(args.where, "canceledAt") && meeting.canceledAt !== null) {
          return false;
        }

        return true;
      });
      const sorted = [...filtered].sort((first, second) => {
        const startsAtComparison = (first.startsAt.getTime() - second.startsAt.getTime()) * direction;

        if (startsAtComparison !== 0) {
          return startsAtComparison;
        }

        return first.id.localeCompare(second.id);
      });

      return sorted.slice(args.skip, args.skip + args.take).map((meeting) => ({ ...meeting }));
    },

    update: async (args: {
      where: { id: string };
      data: Partial<{
        title: string;
        description: string | null;
        startsAt: Date;
        endsAt: Date;
        canceledAt: Date;
        cancellationReason: string | null;
      }>;
    }) => {
      const meeting = this.state.meetings.find((item) => item.id === args.where.id);

      if (!meeting) {
        throw new Error(`Meeting ${args.where.id} was not found in fake Prisma state.`);
      }

      if (args.data.title !== undefined) {
        meeting.title = args.data.title;
      }

      if (Object.prototype.hasOwnProperty.call(args.data, "description")) {
        meeting.description = args.data.description ?? null;
      }

      if (args.data.startsAt !== undefined) {
        meeting.startsAt = new Date(args.data.startsAt);
      }

      if (args.data.endsAt !== undefined) {
        meeting.endsAt = new Date(args.data.endsAt);
      }

      if (args.data.canceledAt !== undefined) {
        meeting.canceledAt = new Date(args.data.canceledAt);
      }

      if (Object.prototype.hasOwnProperty.call(args.data, "cancellationReason")) {
        meeting.cancellationReason = args.data.cancellationReason ?? null;
      }

      meeting.updatedAt = this.nowProvider();
      return { ...meeting };
    },

    updateMany: async (args: {
      where: { id: string; groupId?: string; canceledAt: null };
      data: Partial<{
        title: string;
        description: string | null;
        startsAt: Date;
        endsAt: Date;
        canceledAt: Date;
        cancellationReason: string | null;
      }>;
    }) => {
      const meeting = this.state.meetings.find(
        (item) =>
          item.id === args.where.id &&
          item.canceledAt === args.where.canceledAt &&
          (args.where.groupId === undefined || item.groupId === args.where.groupId),
      );

      if (!meeting) {
        return { count: 0 };
      }

      if (
        this.simulatedCancelRace &&
        args.data.canceledAt !== undefined &&
        Object.prototype.hasOwnProperty.call(args.data, "cancellationReason")
      ) {
        meeting.canceledAt = new Date(this.simulatedCancelRace.canceledAt);
        meeting.cancellationReason = this.simulatedCancelRace.cancellationReason;
        meeting.updatedAt = this.nowProvider();
        return { count: 0 };
      }

      if (args.data.title !== undefined) {
        meeting.title = args.data.title;
      }

      if (Object.prototype.hasOwnProperty.call(args.data, "description")) {
        meeting.description = args.data.description ?? null;
      }

      if (args.data.startsAt !== undefined) {
        meeting.startsAt = new Date(args.data.startsAt);
      }

      if (args.data.endsAt !== undefined) {
        meeting.endsAt = new Date(args.data.endsAt);
      }

      if (args.data.canceledAt !== undefined) {
        meeting.canceledAt = new Date(args.data.canceledAt);
      }

      if (Object.prototype.hasOwnProperty.call(args.data, "cancellationReason")) {
        meeting.cancellationReason = args.data.cancellationReason ?? null;
      }

      meeting.updatedAt = this.nowProvider();
      return { count: 1 };
    },
  };
}

const NOW = new Date("2026-07-16T12:00:00.000Z");
const nextNow = () => new Date(NOW);
const buildRepositoryState = (): { groups: PrismaGroupRow[]; meetings: PrismaMeetingRow[] } => ({
  groups: DEFAULT_MEMORY_GROUPS.map((group) => ({ id: group.id })),
  meetings: [
    {
      id: "meeting-a",
      groupId: "emmanuel",
      title: "Encontro A",
      description: "Descricao A",
      startsAt: new Date("2026-07-21T20:00:00.000Z"),
      endsAt: new Date("2026-07-21T21:30:00.000Z"),
      canceledAt: null,
      cancellationReason: null,
      createdAt: new Date("2026-07-10T10:00:00.000Z"),
      updatedAt: new Date("2026-07-10T10:00:00.000Z"),
    },
    {
      id: "meeting-b",
      groupId: "emmanuel",
      title: "Encontro B",
      description: null,
      startsAt: new Date("2026-07-20T20:00:00.000Z"),
      endsAt: new Date("2026-07-20T21:00:00.000Z"),
      canceledAt: new Date("2026-07-19T12:00:00.000Z"),
      cancellationReason: "Feriado local",
      createdAt: new Date("2026-07-09T10:00:00.000Z"),
      updatedAt: new Date("2026-07-19T12:00:00.000Z"),
    },
    {
      id: "meeting-c",
      groupId: "a-caminho-da-luz",
      title: "Encontro C",
      description: "Descricao C",
      startsAt: new Date("2026-07-22T20:00:00.000Z"),
      endsAt: new Date("2026-07-22T21:00:00.000Z"),
      canceledAt: null,
      cancellationReason: null,
      createdAt: new Date("2026-07-11T10:00:00.000Z"),
      updatedAt: new Date("2026-07-11T10:00:00.000Z"),
    },
  ],
});

const mapPrismaRowsToRecords = (meetings: PrismaMeetingRow[]): StudyMeetingRecord[] =>
  meetings.map((meeting) => ({
    id: meeting.id,
    groupId: meeting.groupId,
    title: meeting.title,
    description: meeting.description,
    startsAt: meeting.startsAt.toISOString(),
    endsAt: meeting.endsAt.toISOString(),
    canceledAt: meeting.canceledAt ? meeting.canceledAt.toISOString() : null,
    cancellationReason: meeting.cancellationReason,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
  }));

const createRepositoryPair = (
  options: {
    idProvider?: () => string;
    simulatedCancelRace?: SimulatedCancelRace;
  } = {},
) => {
  const baseState = buildRepositoryState();
  const idProvider = options.idProvider ?? (() => "meeting-created");
  const memoryRepository = createMemoryStudyMeetingsRepository({
    groups: DEFAULT_MEMORY_GROUPS,
    meetings: mapPrismaRowsToRecords(baseState.meetings),
    nowProvider: nextNow,
    idProvider,
  });
  const fakePrisma = new FakeStudyMeetingsPrisma(baseState, {
    nowProvider: nextNow,
    idProvider,
    simulatedCancelRace: options.simulatedCancelRace,
  });
  const prismaRepository = createPrismaStudyMeetingsRepository(fakePrisma as never);

  return {
    memoryRepository,
    prismaRepository,
  };
};

describe("study meetings repository", () => {
  it("cria encontro associado ao grupo com persistencia equivalente", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = {
      groupId: "emmanuel",
      title: "  Estudo da semana  ",
      description: "  Breve acolhimento e leitura guiada.  ",
      startsAt: "2026-07-28T20:00:00.000Z",
      endsAt: "2026-07-28T21:15:00.000Z",
    };

    const [memoryResult, prismaResult] = await Promise.all([
      memoryRepository.create(input),
      prismaRepository.create(input),
    ]);

    expect(memoryResult).toEqual(prismaResult);
    expect(memoryResult).toEqual(
      expect.objectContaining({
        id: "meeting-created",
        groupId: "emmanuel",
        title: "Estudo da semana",
        description: "Breve acolhimento e leitura guiada.",
        startsAt: "2026-07-28T20:00:00.000Z",
        endsAt: "2026-07-28T21:15:00.000Z",
        canceledAt: null,
        cancellationReason: null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      }),
    );
  });

  it("rejeita criacao com grupo inexistente", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = {
      groupId: "grupo-inexistente",
      title: "Encontro",
      description: null,
      startsAt: "2026-07-28T20:00:00.000Z",
      endsAt: "2026-07-28T21:00:00.000Z",
    };

    await expect(memoryRepository.create(input)).rejects.toBeInstanceOf(StudyMeetingGroupNotFoundError);
    await expect(prismaRepository.create(input)).rejects.toBeInstanceOf(StudyMeetingGroupNotFoundError);
  });

  it("rejeita intervalo invalido", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = {
      groupId: "emmanuel",
      title: "Encontro",
      description: null,
      startsAt: "2026-07-28T20:00:00.000Z",
      endsAt: "2026-07-28T20:00:00.000Z",
    };

    await expect(memoryRepository.create(input)).rejects.toBeInstanceOf(InvalidStudyMeetingTimeRangeError);
    await expect(prismaRepository.create(input)).rejects.toBeInstanceOf(InvalidStudyMeetingTimeRangeError);
  });

  it("encontra por id e restringe por grupo", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();

    await expect(memoryRepository.findById("meeting-a")).resolves.toEqual(
      expect.objectContaining({ id: "meeting-a", groupId: "emmanuel" }),
    );
    await expect(prismaRepository.findById("meeting-a")).resolves.toEqual(
      expect.objectContaining({ id: "meeting-a", groupId: "emmanuel" }),
    );
    await expect(memoryRepository.findByIdAndGroupId("meeting-a", "a-caminho-da-luz")).resolves.toBeNull();
    await expect(prismaRepository.findByIdAndGroupId("meeting-a", "a-caminho-da-luz")).resolves.toBeNull();
  });

  it("retorna copia defensiva no adapter em memoria", async () => {
    const { memoryRepository } = createRepositoryPair();
    const original = await memoryRepository.findById("meeting-a");

    expect(original).not.toBeNull();
    original!.title = "Titulo externo";

    const reloaded = await memoryRepository.findById("meeting-a");

    expect(reloaded?.title).toBe("Encontro A");
  });

  it("lista por grupo com ordenacao, paginacao e filtro de cancelados equivalentes", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = buildDefaultStudyMeetingListInput("emmanuel", {
      page: 1,
      pageSize: 10,
      sortOrder: "asc",
      includeCanceled: false,
    });

    const [memoryResult, prismaResult] = await Promise.all([
      memoryRepository.listByGroupId(input),
      prismaRepository.listByGroupId(input),
    ]);

    expect(memoryResult).toEqual(prismaResult);
    expect(memoryResult.items.map((item) => item.id)).toEqual(["meeting-a"]);
    expect(memoryResult.total).toBe(1);
    expect(memoryResult.totalPages).toBe(1);

    const paginatedMemory = await memoryRepository.listByGroupId(
      buildDefaultStudyMeetingListInput("emmanuel", {
        page: 1,
        pageSize: 1,
        sortOrder: "desc",
        includeCanceled: true,
      }),
    );
    const paginatedPrisma = await prismaRepository.listByGroupId(
      buildDefaultStudyMeetingListInput("emmanuel", {
        page: 1,
        pageSize: 1,
        sortOrder: "desc",
        includeCanceled: true,
      }),
    );

    expect(paginatedMemory).toEqual(paginatedPrisma);
    expect(paginatedMemory.items.map((item) => item.id)).toEqual(["meeting-a"]);
    expect(paginatedMemory.total).toBe(2);
    expect(paginatedMemory.totalPages).toBe(2);
  });

  it("usa desempate deterministico por id quando startsAt empata", async () => {
    const duplicatedStartsAt = "2026-07-23T20:00:00.000Z";
    let nextId = 0;
    const { memoryRepository, prismaRepository } = createRepositoryPair({
      idProvider: () => `meeting-created-${++nextId}`,
    });

    await memoryRepository.create({
      groupId: "emmanuel",
      title: "Titulo Z",
      description: null,
      startsAt: duplicatedStartsAt,
      endsAt: "2026-07-23T21:00:00.000Z",
    });
    await memoryRepository.create({
      groupId: "emmanuel",
      title: "Titulo Y",
      description: null,
      startsAt: duplicatedStartsAt,
      endsAt: "2026-07-23T21:30:00.000Z",
    });
    await prismaRepository.create({
      groupId: "emmanuel",
      title: "Titulo Z",
      description: null,
      startsAt: duplicatedStartsAt,
      endsAt: "2026-07-23T21:00:00.000Z",
    });
    await prismaRepository.create({
      groupId: "emmanuel",
      title: "Titulo Y",
      description: null,
      startsAt: duplicatedStartsAt,
      endsAt: "2026-07-23T21:30:00.000Z",
    });

    const memoryResult = await memoryRepository.listByGroupId(
      buildDefaultStudyMeetingListInput("emmanuel", {
        includeCanceled: true,
        sortOrder: "asc",
      }),
    );
    const prismaResult = await prismaRepository.listByGroupId(
      buildDefaultStudyMeetingListInput("emmanuel", {
        includeCanceled: true,
        sortOrder: "asc",
      }),
    );

    const memoryTiedIds = memoryResult.items
      .filter((item) => item.startsAt === duplicatedStartsAt)
      .map((item) => item.id);
    const prismaTiedIds = prismaResult.items
      .filter((item) => item.startsAt === duplicatedStartsAt)
      .map((item) => item.id);

    expect(memoryTiedIds).toEqual(["meeting-created-1", "meeting-created-2"]);
    expect(prismaTiedIds).toEqual(["meeting-created-3", "meeting-created-4"]);
  });

  it("retorna pagina sem itens com totalPages 0 quando nao ha resultados", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = buildDefaultStudyMeetingListInput("grupo-inexistente", {
      page: 2,
      pageSize: 10,
      includeCanceled: true,
    });

    await expect(memoryRepository.listByGroupId(input)).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
      totalPages: 0,
    });
    await expect(prismaRepository.listByGroupId(input)).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
      totalPages: 0,
    });
  });

  it("aceita pageSize 50 e rejeita pageSize 51", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();

    await expect(
      memoryRepository.listByGroupId(
        buildDefaultStudyMeetingListInput("emmanuel", {
          pageSize: 50,
          includeCanceled: true,
        }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        pageSize: 50,
        total: 2,
      }),
    );
    await expect(
      prismaRepository.listByGroupId(
        buildDefaultStudyMeetingListInput("emmanuel", {
          pageSize: 50,
          includeCanceled: true,
        }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        pageSize: 50,
        total: 2,
      }),
    );

    await expect(
      memoryRepository.listByGroupId(
        buildDefaultStudyMeetingListInput("emmanuel", {
          pageSize: 51,
        }),
      ),
    ).rejects.toThrow("pageSize");
    await expect(
      prismaRepository.listByGroupId(
        buildDefaultStudyMeetingListInput("emmanuel", {
          pageSize: 51,
        }),
      ),
    ).rejects.toThrow("pageSize");
  });

  it("atualiza campos permitidos sem alterar grupo ou id", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = {
      meetingId: "meeting-a",
      groupId: "emmanuel",
      title: "Titulo revisado",
      description: "Nova descricao",
      startsAt: "2026-07-21T20:30:00.000Z",
      endsAt: "2026-07-21T21:45:00.000Z",
    };

    const [memoryResult, prismaResult] = await Promise.all([
      memoryRepository.update(input),
      prismaRepository.update(input),
    ]);

    expect(memoryResult).toEqual(prismaResult);
    expect(memoryResult).toEqual(
      expect.objectContaining({
        id: "meeting-a",
        groupId: "emmanuel",
        title: "Titulo revisado",
        description: "Nova descricao",
        startsAt: "2026-07-21T20:30:00.000Z",
        endsAt: "2026-07-21T21:45:00.000Z",
        updatedAt: NOW.toISOString(),
      }),
    );

    await expect(
      memoryRepository.update({
        ...input,
        groupId: "a-caminho-da-luz",
      }),
    ).resolves.toBeNull();
    await expect(
      prismaRepository.update({
        ...input,
        groupId: "a-caminho-da-luz",
      }),
    ).resolves.toBeNull();
  });

  it("rejeita atualizacao parcial que torna o intervalo invalido", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();

    await expect(
      memoryRepository.update({
        meetingId: "meeting-a",
        groupId: "emmanuel",
        startsAt: "2026-07-21T22:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(InvalidStudyMeetingTimeRangeError);
    await expect(
      prismaRepository.update({
        meetingId: "meeting-a",
        groupId: "emmanuel",
        startsAt: "2026-07-21T22:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(InvalidStudyMeetingTimeRangeError);

    await expect(
      memoryRepository.update({
        meetingId: "meeting-a",
        groupId: "emmanuel",
        endsAt: "2026-07-21T19:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(InvalidStudyMeetingTimeRangeError);
    await expect(
      prismaRepository.update({
        meetingId: "meeting-a",
        groupId: "emmanuel",
        endsAt: "2026-07-21T19:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(InvalidStudyMeetingTimeRangeError);

    await expect(
      memoryRepository.update({
        meetingId: "meeting-a",
        groupId: "emmanuel",
        description: null,
        startsAt: "2026-07-21T18:00:00.000Z",
        endsAt: "2026-07-21T19:30:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        description: null,
        startsAt: "2026-07-21T18:00:00.000Z",
        endsAt: "2026-07-21T19:30:00.000Z",
      }),
    );
  });

  it("cancela sem apagar fisicamente e preserva comportamento no segundo cancelamento", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = {
      meetingId: "meeting-a",
      groupId: "emmanuel",
      canceledAt: "2026-07-18T12:00:00.000Z",
      cancellationReason: "Professor indisponivel",
    };

    const [memoryResult, prismaResult] = await Promise.all([
      memoryRepository.cancel(input),
      prismaRepository.cancel(input),
    ]);

    expect(memoryResult).toEqual(prismaResult);
    expect(memoryResult).toEqual(
      expect.objectContaining({
        canceledAt: "2026-07-18T12:00:00.000Z",
        cancellationReason: "Professor indisponivel",
        updatedAt: NOW.toISOString(),
      }),
    );

    const [secondMemoryCancel, secondPrismaCancel] = await Promise.all([
      memoryRepository.cancel({
        ...input,
        canceledAt: "2026-07-18T13:00:00.000Z",
        cancellationReason: "Outro motivo",
      }),
      prismaRepository.cancel({
        ...input,
        canceledAt: "2026-07-18T13:00:00.000Z",
        cancellationReason: "Outro motivo",
      }),
    ]);

    expect(secondMemoryCancel).toEqual(memoryResult);
    expect(secondPrismaCancel).toEqual(prismaResult);

    const [memoryList, prismaList] = await Promise.all([
      memoryRepository.listByGroupId(
        buildDefaultStudyMeetingListInput("emmanuel", { includeCanceled: true }),
      ),
      prismaRepository.listByGroupId(
        buildDefaultStudyMeetingListInput("emmanuel", { includeCanceled: true }),
      ),
    ]);

    expect(memoryList.items).toHaveLength(2);
    expect(prismaList.items).toHaveLength(2);
  });

  it("retorna o cancelamento já persistido quando há disputa concorrente no adapter Prisma", async () => {
    const { prismaRepository } = createRepositoryPair({
      simulatedCancelRace: {
        canceledAt: new Date("2026-07-18T12:05:00.000Z"),
        cancellationReason: "Cancelamento concorrente",
      },
    });

    await expect(
      prismaRepository.cancel({
        meetingId: "meeting-a",
        groupId: "emmanuel",
        canceledAt: "2026-07-18T12:00:00.000Z",
        cancellationReason: "Cancelamento local",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "meeting-a",
        groupId: "emmanuel",
        canceledAt: "2026-07-18T12:05:00.000Z",
        cancellationReason: "Cancelamento concorrente",
      }),
    );
  });

  it("nao cancela encontro fora do grupo", async () => {
    const { memoryRepository, prismaRepository } = createRepositoryPair();
    const input = {
      meetingId: "meeting-a",
      groupId: "a-caminho-da-luz",
      canceledAt: "2026-07-18T12:00:00.000Z",
      cancellationReason: "Motivo externo",
    };

    await expect(memoryRepository.cancel(input)).resolves.toBeNull();
    await expect(prismaRepository.cancel(input)).resolves.toBeNull();
  });
});
