import { afterEach, describe, expect, it, vi } from "vitest";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const groups = [
  { name: "Emmanuel", slug: "emmanuel", status: "active" },
  { name: "Obras Póstumas", slug: "obras-postumas", status: "active" },
];

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

  return import("../services/adminTeachersService");
};

describe("admin teachers service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    window.localStorage.clear();
  });

  it("cadastra professor sem enviar role, senha, token ou status", async () => {
    const { createAdminTeacher } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          data: {
            user: {
              id: "teacher-001",
              fullName: "Profa. Clara",
              role: "teacher",
              status: "active",
              accountActivated: false,
            },
            groups,
          },
        }),
      ),
    );

    await expect(
      createAdminTeacher({
        fullName: "Profa. Clara",
        email: "clara@example.com",
        groupIds: ["emmanuel", "obras-postumas"],
      }),
    ).resolves.toEqual({
      user: {
        id: "teacher-001",
        fullName: "Profa. Clara",
        role: "teacher",
        status: "active",
        accountActivated: false,
      },
      groups,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/teachers",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      fullName: "Profa. Clara",
      email: "clara@example.com",
      groupIds: ["emmanuel", "obras-postumas"],
    });
  });

  it("consulta e atualiza grupos pedagógicos no contrato explícito", async () => {
    const {
      getAdminUserPedagogicalGroups,
      updateAdminUserPedagogicalGroups,
    } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          data: {
            user: {
              id: "teacher-001",
              groups,
            },
          },
        }),
      ),
    );

    await expect(getAdminUserPedagogicalGroups("teacher-001")).resolves.toEqual({
      user: { id: "teacher-001", groups },
    });
    await expect(
      updateAdminUserPedagogicalGroups("teacher-001", {
        groupIds: ["emmanuel"],
      }),
    ).resolves.toEqual({
      user: { id: "teacher-001", groups },
    });

    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3333/api/admin/users/teacher-001/pedagogical-groups",
      expect.any(Object),
    );
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3333/api/admin/users/teacher-001/pedagogical-groups",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ groupIds: ["emmanuel"] }),
      }),
    );
  });

  it("envia convite por userId sem expor URL ou token no retorno mapeado", async () => {
    const { sendAdminTeacherInvitation } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          data: {
            user: {
              id: "teacher-001",
              fullName: "Profa. Clara",
              email: "clara@example.com",
            },
            invitation: {
              expiresAt: "2026-07-20T10:00:00.000Z",
              deliveryStatus: "sent",
              invitationType: "admin_reinvite",
              token: "secret-token",
              url: "https://example.com/secret",
            },
          },
        }),
      ),
    );

    await expect(sendAdminTeacherInvitation("teacher-001")).resolves.toEqual({
      user: {
        id: "teacher-001",
        fullName: "Profa. Clara",
        email: "clara@example.com",
      },
      invitation: {
        expiresAt: "2026-07-20T10:00:00.000Z",
        deliveryStatus: "sent",
        invitationType: "admin_reinvite",
      },
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users/teacher-001/send-invitation",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
  });

  it("bloqueia mutações no modo demo sem chamada de rede", async () => {
    const { createAdminTeacher, sendAdminTeacherInvitation } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      createAdminTeacher({
        fullName: "Profa. Clara",
        email: "clara@example.com",
        groupIds: ["emmanuel"],
      }),
    ).rejects.toMatchObject({ code: "ADMIN_TEACHERS_UNAVAILABLE_IN_DEMO" });
    await expect(sendAdminTeacherInvitation("teacher-001")).rejects.toMatchObject({
      code: "ADMIN_TEACHERS_UNAVAILABLE_IN_DEMO",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
