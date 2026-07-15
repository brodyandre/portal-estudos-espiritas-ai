import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const groupItem = {
  name: "Emmanuel",
  slug: "emmanuel",
  status: "active",
};

const listEnvelope = (items: unknown[] = [groupItem]) => ({
  success: true,
  message: "Grupos administrativos listados com sucesso.",
  data: {
    items,
  },
});

const loadServiceModule = async (mode: "local" | "demo" = "local") => {
  vi.resetModules();
  vi.doMock("../config/appMode", () => ({
    DEMO_MODE_NOTICE:
      "Modo demonstrativo: dados reais e aprovações ficam disponíveis apenas no ambiente local autorizado.",
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

  return import("../services/adminGroupsService");
};

describe("adminGroupsService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("usa status=active por padrão", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminSelectableGroups();

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/groups?status=active",
      expect.any(Object),
    );
  });

  it("aceita status=inactive e status=all", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminSelectableGroups("inactive");
    await listAdminSelectableGroups("all");

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      "http://localhost:3333/api/admin/groups?status=inactive",
    );
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
      "http://localhost:3333/api/admin/groups?status=all",
    );
  });

  it("encaminha o token administrativo", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
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

    await listAdminSelectableGroups();

    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-local",
        }),
      }),
    );
  });

  it("faz o parsing do envelope válido", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await expect(listAdminSelectableGroups()).resolves.toEqual({
      items: [groupItem],
      source: "api",
    });
  });

  it("aceita lista vazia", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope([]))));

    await expect(listAdminSelectableGroups()).resolves.toEqual({
      items: [],
      source: "api",
    });
  });

  it("rejeita item inválido", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(listEnvelope([{ ...groupItem, slug: "" }]))),
    );

    await expect(listAdminSelectableGroups()).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para grupos administrativos.",
    });
  });

  it("rejeita status inválido", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(listEnvelope([{ ...groupItem, status: "archived" }]))),
    );

    await expect(listAdminSelectableGroups()).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para grupos administrativos.",
    });
  });

  it("rejeita envelope sem items", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          message: "ok",
          data: {},
        }),
      ),
    );

    await expect(listAdminSelectableGroups()).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para grupos administrativos.",
    });
  });

  it("preserva ServiceRequestError da API", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          {
            success: false,
            error: {
              code: "INVALID_ADMIN_GROUPS_QUERY",
              message: "Parâmetros inválidos para consultar grupos administrativos.",
            },
          },
          false,
        ),
      ),
    );

    await expect(listAdminSelectableGroups("inactive")).rejects.toMatchObject({
      kind: "api",
      code: "INVALID_ADMIN_GROUPS_QUERY",
      message: "Parâmetros inválidos para consultar grupos administrativos.",
    });
  });

  it("usa modo demo com grupos mockados", async () => {
    const { listAdminSelectableGroups } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    const result = await listAdminSelectableGroups("active");

    expect(result.source).toBe("demo");
    expect(result.items.every((item) => item.status === "active")).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
