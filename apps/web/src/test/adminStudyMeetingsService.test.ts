import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const meetingItem = {
  id: "meeting-001",
  groupId: "emmanuel",
  title: "Aula semanal",
  description: "Estudo da semana",
  startsAt: "2026-07-15T20:00:00.000Z",
  endsAt: "2026-07-15T21:00:00.000Z",
  canceledAt: null,
  cancellationReason: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

const listEnvelope = (items: unknown[] = [meetingItem], meta: unknown = {
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: 1,
}) => ({
  success: true,
  message: "Encontros listados com sucesso.",
  data: {
    items,
  },
  meta,
});

const meetingEnvelope = (meeting: unknown = meetingItem) => ({
  success: true,
  message: "Encontro consultado com sucesso.",
  data: meeting,
});

const fetchMock = () => vi.mocked(fetch);

const loadServiceModule = async (
  mode: "local" | "demo" = "local",
  options: { canUseAdminFeatures?: boolean } = {},
) => {
  vi.resetModules();
  vi.doMock("../config/appMode", () => ({
    appConfig: {
      appMode: mode,
      apiUrl: mode === "local" ? "http://localhost:3333" : null,
      isGithubPages: mode === "demo",
      canShowRealMeetLink: false,
      canUseAdminFeatures: options.canUseAdminFeatures ?? mode === "local",
      canUseTeacherFeatures: mode === "local",
      canUseStudentPrivateArea: mode === "local",
    },
  }));

  return import("../services/adminStudyMeetingsService");
};

describe("adminStudyMeetingsService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("listagem sem filtros gera URL sem query", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminStudyMeetings("emmanuel");

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/groups/emmanuel/meetings",
      expect.any(Object),
    );
  });

  it("serializa apenas parâmetros definidos da listagem", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminStudyMeetings("grupo especial/1", {
      page: 2,
      pageSize: 25,
      sortOrder: "desc",
      includeCanceled: true,
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/groups/grupo%20especial%2F1/meetings?page=2&pageSize=25&sortOrder=desc&includeCanceled=true",
      expect.any(Object),
    );
  });

  it("não muta o objeto de parâmetros", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));
    const params = {
      page: 2,
      sortOrder: "asc" as const,
      includeCanceled: false,
    };

    await listAdminStudyMeetings("emmanuel", params);

    expect(params).toEqual({
      page: 2,
      sortOrder: "asc",
      includeCanceled: false,
    });
  });

  it("encaminha o token administrativo pelo cliente HTTP existente", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "jwt-local");
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: "admin-001",
        fullName: "Admin Demonstrativo",
        email: "admin.demo@example.com",
        role: "admin",
        status: "active",
        mustChangePassword: false,
        permissions: [],
      }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminStudyMeetings("emmanuel");

    expect(fetchMock().mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-local",
        }),
      }),
    );
  });

  it("retorna items e meta da listagem válida", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await expect(listAdminStudyMeetings("emmanuel")).resolves.toEqual({
      items: [meetingItem],
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("consulta encontro por grupo e id codificados", async () => {
    const { getAdminStudyMeeting } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(meetingEnvelope())));

    await expect(getAdminStudyMeeting("grupo/1", "meeting 001")).resolves.toEqual(meetingItem);
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/groups/grupo%2F1/meetings/meeting%20001",
      expect.any(Object),
    );
  });

  it("criação, atualização e cancelamento usam método, URL e body corretos", async () => {
    const {
      cancelAdminStudyMeeting,
      createAdminStudyMeeting,
      updateAdminStudyMeeting,
    } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(meetingEnvelope())));

    await createAdminStudyMeeting("emmanuel", {
      title: "Nova aula",
      description: null,
      startsAt: "2026-07-15T20:00:00.000Z",
      endsAt: "2026-07-15T21:00:00.000Z",
    });
    await updateAdminStudyMeeting("emmanuel", "meeting-001", {
      title: "Aula atualizada",
    });
    await cancelAdminStudyMeeting("emmanuel", "meeting-001", {
      cancellationReason: "Recesso do grupo",
    });

    expect(fetchMock().mock.calls[0]).toEqual([
      "http://localhost:3333/api/admin/groups/emmanuel/meetings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Nova aula",
          description: null,
          startsAt: "2026-07-15T20:00:00.000Z",
          endsAt: "2026-07-15T21:00:00.000Z",
        }),
      }),
    ]);
    expect(fetchMock().mock.calls[1]).toEqual([
      "http://localhost:3333/api/admin/groups/emmanuel/meetings/meeting-001",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          title: "Aula atualizada",
        }),
      }),
    ]);
    expect(fetchMock().mock.calls[2]).toEqual([
      "http://localhost:3333/api/admin/groups/emmanuel/meetings/meeting-001/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          cancellationReason: "Recesso do grupo",
        }),
      }),
    ]);
  });

  it.each([
    ["listagem sem data", { success: true, message: "ok" }],
    ["listagem sem items", { success: true, message: "ok", data: {}, meta: {} }],
    ["listagem com items inválido", { success: true, message: "ok", data: { items: {} }, meta: {} }],
    ["listagem sem meta", { success: true, message: "ok", data: { items: [] } }],
  ])("não aceita envelope inválido: %s", async (_caseName, payload) => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(payload)));

    await expect(listAdminStudyMeetings("emmanuel")).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para encontros administrativos.",
    });
  });

  it.each([
    ["id vazio", { ...meetingItem, id: "" }],
    ["description inválida", { ...meetingItem, description: 42 }],
    ["canceledAt inválido", { ...meetingItem, canceledAt: 42 }],
    ["createdAt ausente", { ...meetingItem, createdAt: undefined }],
  ])("não aceita item inválido: %s", async (_caseName, item) => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope([item]))));

    await expect(listAdminStudyMeetings("emmanuel")).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para encontros administrativos.",
    });
  });

  it.each([
    ["page inválida", { page: 0, pageSize: 10, total: 0, totalPages: 0 }],
    ["pageSize inválido", { page: 1, pageSize: 0, total: 0, totalPages: 0 }],
    ["total inválido", { page: 1, pageSize: 10, total: -1, totalPages: 0 }],
    ["totalPages inválido", { page: 1, pageSize: 10, total: 0, totalPages: -1 }],
  ])("não aceita meta inválida: %s", async (_caseName, meta) => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope([], meta))));

    await expect(listAdminStudyMeetings("emmanuel")).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para encontros administrativos.",
    });
  });

  it.each([
    "AUTH_REQUIRED",
    "FORBIDDEN",
    "INVALID_STUDY_MEETING_INPUT",
    "STUDY_GROUP_NOT_FOUND",
    "STUDY_MEETING_NOT_FOUND",
    "STUDY_MEETING_ALREADY_STARTED",
    "ADMIN_STUDY_MEETING_RATE_LIMITED",
  ])("preserva erro da API: %s", async (code) => {
    const { createAdminStudyMeeting } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          {
            success: false,
            error: {
              code,
              message: "Não foi possível concluir a solicitação.",
              details:
                code === "ADMIN_STUDY_MEETING_RATE_LIMITED"
                  ? { retryAfterSeconds: 120 }
                  : undefined,
            },
          },
          false,
        ),
      ),
    );

    await expect(
      createAdminStudyMeeting("emmanuel", {
        title: "Aula",
        startsAt: "2026-07-15T20:00:00.000Z",
        endsAt: "2026-07-15T21:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      kind: "api",
      code,
      retryAfterSeconds:
        code === "ADMIN_STUDY_MEETING_RATE_LIMITED" ? 120 : undefined,
    });
  });

  it("falha de rede continua erro explícito", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));

    await expect(listAdminStudyMeetings("emmanuel")).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("modo demo lista dados demonstrativos sem chamar fetch", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    const result = await listAdminStudyMeetings("emmanuel", {
      includeCanceled: true,
      sortOrder: "asc",
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((item) => item.canceledAt !== null)).toBe(true);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("modo demo inclui encontro futuro, encerrado e cancelado", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    const result = await listAdminStudyMeetings("emmanuel", {
      includeCanceled: true,
      sortOrder: "asc",
    });

    expect(result.items.some((item) => item.startsAt.startsWith("2099-"))).toBe(true);
    expect(result.items.some((item) => item.id === "meeting-emmanuel-ended-001")).toBe(true);
    expect(result.items.some((item) => item.canceledAt !== null)).toBe(true);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("modo demo mantém mutações somente leitura", async () => {
    const { cancelAdminStudyMeeting } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      cancelAdminStudyMeeting("emmanuel", "meeting-emmanuel-001", {
        cancellationReason: "Recesso",
      }),
    ).rejects.toMatchObject({
      kind: "api",
      code: "ADMIN_STUDY_MEETING_UNAVAILABLE_IN_DEMO",
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("modo local com admin features desligado continua usando API explícita", async () => {
    const { listAdminStudyMeetings } = await loadServiceModule("local", {
      canUseAdminFeatures: false,
    });
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminStudyMeetings("emmanuel");

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/groups/emmanuel/meetings",
      expect.any(Object),
    );
  });
});
