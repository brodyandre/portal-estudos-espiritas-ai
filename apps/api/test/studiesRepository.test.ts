import { describe, expect, it } from "vitest";

import { AppError } from "../src/lib/app-error";
import { listStudies } from "../src/modules/studies/studies.service";
import {
  createPrismaStudiesRepository,
  StudyGroupCatalogUnavailableError,
  type StudiesRepository,
} from "../src/modules/studies/studies.repository";

const futureDate = new Date("2026-09-01T20:00:00.000Z");

const createFakePrisma = (groups: unknown[]) => ({
  studyGroup: {
    async findMany() {
      return groups;
    },
    async findFirst() {
      return groups[0] ?? null;
    },
  },
});

describe("createPrismaStudiesRepository", () => {
  it("deriva bookTitle de KnowledgeBook e retorna proxima aula do StudyMeeting futuro", async () => {
    const repository = createPrismaStudiesRepository(
      createFakePrisma([
        {
          id: "emmanuel",
          name: "Emmanuel",
          meetingDay: null,
          meetingTime: null,
          participantCount: null,
          meetUrl: null,
          description: null,
          knowledgeBook: { title: "Emmanuel governado" },
          meetings: [
            {
              id: "meeting-1",
              title: "Aula futura",
              description: "Tema futuro",
              startsAt: futureDate,
            },
          ],
        },
      ]) as never,
      () => new Date("2026-08-22T12:00:00.000Z"),
    );

    const groups = await repository.list();

    expect(groups).toEqual([
      expect.objectContaining({
        id: "emmanuel",
        bookTitle: "Emmanuel governado",
        meetingDay: null,
        participantCount: null,
        meetUrl: null,
        description: null,
        nextLesson: expect.objectContaining({
          id: "meeting-1",
          groupId: "emmanuel",
          title: "Aula futura",
          theme: "Tema futuro",
          scheduledAt: futureDate.toISOString(),
          meetUrl: null,
        }),
      }),
    ]);
  });

  it("retorna nextLesson nulo quando nao ha StudyMeeting futuro", async () => {
    const repository = createPrismaStudiesRepository(
      createFakePrisma([
        {
          id: "a-caminho-da-luz",
          name: "A Caminho da Luz",
          meetingDay: null,
          meetingTime: null,
          participantCount: null,
          meetUrl: null,
          description: null,
          knowledgeBook: { title: "A Caminho da Luz" },
          meetings: [],
        },
      ]) as never,
    );

    await expect(repository.findBySlug("a-caminho-da-luz")).resolves.toMatchObject({
      id: "a-caminho-da-luz",
      nextLesson: null,
    });
  });

  it("falha fechado quando StudyGroup ativo nao tem KnowledgeBook vinculado", async () => {
    const repository = createPrismaStudiesRepository(
      createFakePrisma([
        {
          id: "emmanuel",
          name: "Emmanuel",
          meetingDay: null,
          meetingTime: null,
          participantCount: null,
          meetUrl: null,
          description: null,
          knowledgeBook: null,
          meetings: [],
        },
      ]) as never,
    );

    await expect(repository.list()).rejects.toMatchObject({
      name: "StudyGroupCatalogUnavailableError",
      reason: "STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK",
    });
  });
});

describe("listStudies", () => {
  it("converte falha governada em AppError 503 sem fallback estatico silencioso", async () => {
    const repository: StudiesRepository = {
      async list() {
        throw new StudyGroupCatalogUnavailableError("STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK");
      },
      async findBySlug() {
        return null;
      },
    };

    await expect(listStudies(repository)).rejects.toEqual(
      new AppError({
        statusCode: 503,
        code: "STUDY_GROUP_CATALOG_UNAVAILABLE",
        message: "Catalogo de grupos de estudo indisponivel.",
        details: { reason: "STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK" },
      }),
    );
  });
});
