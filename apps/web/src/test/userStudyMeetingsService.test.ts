import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const meetingItem = {
  id: "meeting-001",
  title: "Estudo do Evangelho",
  description: null,
  startsAt: "2026-07-15T20:00:00.000-03:00",
  endsAt: "2026-07-15T21:00:00.000-03:00",
  status: "scheduled",
  meetUrl: "https://meet.google.com/abc-defg-hij",
};

const responseEnvelope = (data: unknown = {
  group: { id: "group-001", name: "Emmanuel", status: "active" },
  items: [meetingItem],
}) => ({
  success: true,
  message: "Encontros do grupo listados com sucesso.",
  data,
  meta: { limit: 3 },
});

const expectInvalidResponse = async (data: unknown) => {
  const { listUserStudyMeetings } = await loadServiceModule();
  vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(responseEnvelope(data))));

  await expect(listUserStudyMeetings()).rejects.toMatchObject({
    kind: "api",
    message: "Resposta inválida do servidor para encontros do grupo.",
  });
};

const loadServiceModule = async (mode: "local" | "demo" = "local") => {
  vi.resetModules();
  vi.doMock("../config/appMode", () => ({
    appConfig: {
      appMode: mode,
      apiUrl: mode === "local" ? "http://localhost:3333" : null,
      isGithubPages: mode === "demo",
      canShowRealMeetLink: false,
      canUseAdminFeatures: mode === "local",
      canUseTeacherFeatures: mode === "local",
      canUseStudentPrivateArea: mode === "local",
    },
  }));

  return import("../services/userStudyMeetingsService");
};

describe("userStudyMeetingsService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("consulta os próximos encontros do usuário autenticado com limite padrão", async () => {
    const { listUserStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(responseEnvelope())));

    await listUserStudyMeetings();

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/me/study-meetings/upcoming?limit=3",
      expect.any(Object),
    );
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).not.toContain("groupId");
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).not.toContain("groupSlug");
  });

  it("encaminha o token autenticado", async () => {
    const { listUserStudyMeetings } = await loadServiceModule();
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "jwt-local");
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: "student-001",
        fullName: "Aluno Demonstrativo",
        email: "aluno.demo@example.com",
        role: "student",
        status: "active",
        mustChangePassword: false,
        permissions: [],
      }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(responseEnvelope())));

    await listUserStudyMeetings({ limit: 2 });

    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-local",
        }),
      }),
    );
  });

  it("faz o parsing do envelope válido sem trocar StudyMeeting.id por lessonId", async () => {
    const { listUserStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(responseEnvelope())));

    await expect(listUserStudyMeetings()).resolves.toEqual({
      group: { id: "group-001", name: "Emmanuel", status: "active" },
      items: [meetingItem],
      limit: 3,
      source: "api",
      notice: null,
    });
  });

  it("aceita grupo nulo, grupo inativo, lista vazia e meetUrl nulo", async () => {
    const { listUserStudyMeetings } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          createJsonResponse(responseEnvelope({ group: null, items: [] })),
        )
        .mockResolvedValueOnce(
          createJsonResponse(
            responseEnvelope({
              group: { id: "group-001", name: "Emmanuel", status: "inactive" },
              items: [],
            }),
          ),
        )
        .mockResolvedValueOnce(
          createJsonResponse(
            responseEnvelope({
              group: { id: "group-001", name: "Emmanuel", status: "active" },
              items: [{ ...meetingItem, meetUrl: null }],
            }),
          ),
        ),
    );

    await expect(listUserStudyMeetings()).resolves.toMatchObject({
      group: null,
      items: [],
    });
    await expect(listUserStudyMeetings()).resolves.toMatchObject({
      group: { status: "inactive" },
      items: [],
    });
    await expect(listUserStudyMeetings()).resolves.toMatchObject({
      items: [expect.objectContaining({ meetUrl: null })],
    });
  });

  it("rejeita respostas inválidas", async () => {
    await expectInvalidResponse({ group: null, items: [{ ...meetingItem, status: "done" }] });
  });

  it("rejeita grupo, encontro, datas e ordem temporal inválidos", async () => {
    await expectInvalidResponse({
      group: { id: "group-001", name: "Emmanuel", status: "archived" },
      items: [],
    });
    await expectInvalidResponse({
      group: { id: "group-001", name: "Emmanuel", status: "active" },
      items: [{ ...meetingItem, startsAt: "data-invalida" }],
    });
    await expectInvalidResponse({
      group: { id: "group-001", name: "Emmanuel", status: "active" },
      items: [{ ...meetingItem, endsAt: "data-invalida" }],
    });
    await expectInvalidResponse({
      group: { id: "group-001", name: "Emmanuel", status: "active" },
      items: [{ ...meetingItem, endsAt: meetingItem.startsAt }],
    });
    await expectInvalidResponse({
      group: { id: "group-001", name: "Emmanuel", status: "active" },
      items: [{ ...meetingItem, meetUrl: 123 }],
    });
    await expectInvalidResponse({
      group: { id: "group-001", name: "Emmanuel", status: "active" },
      items: "nao-e-array",
    });
  });

  it("preserva 401 e 403 retornados pela API", async () => {
    const { listUserStudyMeetings } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          createJsonResponse(
            {
              success: false,
              error: {
                code: "AUTH_REQUIRED",
                message: "Autenticação necessária.",
              },
            },
            false,
          ),
        )
        .mockResolvedValueOnce(
          createJsonResponse(
            {
              success: false,
              error: {
                code: "FORBIDDEN",
                message: "Acesso negado.",
              },
            },
            false,
          ),
        ),
    );

    await expect(listUserStudyMeetings()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      message: "Autenticação necessária.",
    });
    await expect(listUserStudyMeetings()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Acesso negado.",
    });
  });

  it("usa mock demonstrativo seguro sem link real", async () => {
    const { listUserStudyMeetings } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    const result = await listUserStudyMeetings();

    expect(result.source).toBe("mock");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((meeting) => meeting.meetUrl === null)).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("propaga erro de rede sem usar mock", async () => {
    const { listUserStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));

    await expect(listUserStudyMeetings()).rejects.toMatchObject({
      kind: "network",
      message: "Nao foi possivel conectar ao backend local agora.",
    });
  });
});
