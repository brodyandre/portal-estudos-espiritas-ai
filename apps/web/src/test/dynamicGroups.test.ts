import { afterEach, describe, expect, it, vi } from "vitest";

import { listKnowledgeFilesByGroup, getPublicKnowledgeGroupId } from "../services/knowledgeService";
import { getStudyBySlug, listStudies } from "../services/studiesService";
import type { UserBookAccessGroup } from "../types/bookAccess";
import type { StudyGroup } from "../types/studyGroup";
import {
  buildAuthorizedStudyGroups,
  getDefaultStudyTheme,
  getGroupCardId,
} from "../utils/bookAccess";

const emmanuelAccess: UserBookAccessGroup = {
  id: "emmanuel",
  name: "Emmanuel",
  knowledgeBook: { id: "book-emmanuel", slug: "emmanuel", title: "Emmanuel" },
};

const caminhoAccess: UserBookAccessGroup = {
  id: "a-caminho-da-luz",
  name: "A Caminho da Luz",
  knowledgeBook: {
    id: "book-a-caminho-da-luz",
    slug: "a-caminho-da-luz",
    title: "A Caminho da Luz",
  },
};

const obrasAccess: UserBookAccessGroup = {
  id: "obras-postumas",
  name: "Grupo Obras Póstumas",
  knowledgeBook: {
    id: "book-obras-postumas",
    slug: "obras-postumas",
    title: "Obras Póstumas",
  },
};

const buildStudy = (slug: string, overrides: Partial<StudyGroup> = {}): StudyGroup => ({
  slug,
  name: `Study ${slug}`,
  meetingDay: "Quarta-feira",
  meetingTime: "20:00",
  participantCount: 10,
  meetUrl: null,
  bookTitle: `Book ${slug}`,
  description: `Descrição ${slug}`,
  nextLesson: {
    id: `lesson-${slug}`,
    title: `Aula ${slug}`,
    theme: `Tema ${slug}`,
    scheduledAt: "2026-07-15T20:00:00.000-03:00",
    scheduledLabel: "Quarta-feira, 15 de julho de 2026, 20h",
    status: "proxima",
    teacherNote: `Nota ${slug}`,
  },
  ...overrides,
});

const apiStudiesEnvelope = {
  success: true,
  message: "Grupos listados com sucesso.",
  data: [
    {
      id: "obras-postumas",
      name: "Grupo Obras Póstumas",
      meetingDay: "quarta-feira",
      meetingTime: "20:00",
      participantCount: 12,
      bookTitle: "Obras Póstumas",
      meetUrl: null,
      description: "Descrição operacional.",
      nextLesson: {
        id: "lesson-obras",
        title: "Aula Obras Póstumas",
        theme: "Tema Obras",
        scheduledAt: "2026-07-15T20:00:00.000-03:00",
        meetUrl: null,
        status: "scheduled",
        teacherNote: "Nota Obras.",
      },
    },
  ],
};

const emptyKnowledgeEnvelope = {
  success: true,
  message: "Arquivos listados com sucesso.",
  data: [],
};

describe("dynamic study groups", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("buildAuthorizedStudyGroups usa BookAccess como authority e studies apenas como enrichment", () => {
    const authorized = buildAuthorizedStudyGroups(
      [emmanuelAccess, caminhoAccess, obrasAccess],
      [
        buildStudy("emmanuel"),
        buildStudy("a-caminho-da-luz"),
        buildStudy("obras-postumas"),
        buildStudy("grupo-extra"),
      ],
    );

    expect(authorized.map((group) => group.slug)).toEqual([
      "emmanuel",
      "a-caminho-da-luz",
      "obras-postumas",
    ]);
    expect(authorized.find((group) => group.slug === "obras-postumas")).toMatchObject({
      name: "Grupo Obras Póstumas",
      bookTitle: "Obras Póstumas",
      meetingTime: "20:00",
    });
    expect(authorized.some((group) => group.slug === "grupo-extra")).toBe(false);
  });

  it("buildAuthorizedStudyGroups preserva terceiro grupo mesmo sem enrichment de studies", () => {
    const [authorized] = buildAuthorizedStudyGroups([obrasAccess], []);

    expect(authorized).toEqual({
      slug: "obras-postumas",
      name: "Grupo Obras Póstumas",
      meetingDay: null,
      meetingTime: null,
      participantCount: null,
      meetUrl: null,
      bookTitle: "Obras Póstumas",
      description: null,
      nextLesson: null,
    });
  });

  it("helpers usam fallback canônico e ids DOM determinísticos", () => {
    expect(getDefaultStudyTheme(buildStudy("obras-postumas"))).toBe("Tema obras-postumas");
    expect(
      getDefaultStudyTheme(
        buildStudy("obras-postumas", {
          bookTitle: "Obras Póstumas",
          nextLesson: null,
        }),
      ),
    ).toBe("Obras Póstumas");
    expect(getGroupCardId("grupo", "obras-postumas")).toBe("grupo-obras-postumas");
    expect(getGroupCardId("grupo", "<Obras Póstumas>")).toBe("grupo-obras-postumas");
  });

  it("studiesService aceita StudyGroupId string vindo da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => apiStudiesEnvelope,
      })),
    );

    const result = await listStudies();

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      slug: "obras-postumas",
      name: "Grupo Obras Póstumas",
      bookTitle: "Obras Póstumas",
    });
  });

  it("getStudyBySlug não inventa fallback demo para id desconhecido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const result = await getStudyBySlug("obras-postumas");

    expect(result.data).toBeNull();
    expect(result.source).toBe("mock");
  });

  it("Knowledge capability não coerçe grupo desconhecido nem chama endpoint inventado", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(getPublicKnowledgeGroupId("obras-postumas")).toBeNull();
    const result = await listKnowledgeFilesByGroup("obras-postumas");

    expect(result).toEqual({
      data: [],
      source: "api",
      notice: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Knowledge capability mantém os endpoints públicos dos grupos atuais", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      json: async () => emptyKnowledgeEnvelope,
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(getPublicKnowledgeGroupId("emmanuel")).toBe("emmanuel");
    expect(getPublicKnowledgeGroupId("a-caminho-da-luz")).toBe("a_caminho_da_luz");
    await listKnowledgeFilesByGroup("emmanuel");
    await listKnowledgeFilesByGroup("a-caminho-da-luz");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      "http://localhost:3333/api/knowledge/emmanuel/files",
      "http://localhost:3333/api/knowledge/a_caminho_da_luz/files",
    ]);
  });
});
