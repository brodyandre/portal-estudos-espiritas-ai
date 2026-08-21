import { afterEach, describe, expect, it, vi } from "vitest";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

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
      canUseDemoFallback: mode === "demo",
    },
  }));

  return import("../services/adminUserTeacherGroupsService");
};

describe("admin user teacher groups service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    window.localStorage.clear();
  });

  it("envia PUT com groupIds e mapeia resposta", async () => {
    const { updateAdminUserTeacherGroups } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          message: "ok",
          data: {
            user: {
              id: "teacher-001",
              groups: [
                { name: "Emmanuel", slug: "emmanuel", status: "active" },
                { name: "A Caminho da Luz", slug: "a-caminho-da-luz", status: "active" },
              ],
            },
          },
        }),
      ),
    );

    await expect(
      updateAdminUserTeacherGroups("teacher-001", {
        groupIds: ["emmanuel", "a-caminho-da-luz"],
      }),
    ).resolves.toEqual({
      user: {
        id: "teacher-001",
        groups: [
          { name: "Emmanuel", slug: "emmanuel", status: "active" },
          { name: "A Caminho da Luz", slug: "a-caminho-da-luz", status: "active" },
        ],
      },
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users/teacher-001/groups",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ groupIds: ["emmanuel", "a-caminho-da-luz"] }),
      }),
    );
  });

  it("bloqueia modo demo sem chamada de rede", async () => {
    const { updateAdminUserTeacherGroups } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      updateAdminUserTeacherGroups("teacher-001", { groupIds: ["emmanuel"] }),
    ).rejects.toMatchObject({
      code: "ADMIN_USER_TEACHER_GROUPS_UNAVAILABLE_IN_DEMO",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejeita envelope inválido", async () => {
    const { updateAdminUserTeacherGroups } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          data: {
            user: {
              id: "teacher-001",
              groups: [{ name: "Emmanuel", slug: "emmanuel", status: "unknown" }],
            },
          },
        }),
      ),
    );

    await expect(
      updateAdminUserTeacherGroups("teacher-001", { groupIds: ["emmanuel"] }),
    ).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para vínculos do professor.",
    });
  });
});
