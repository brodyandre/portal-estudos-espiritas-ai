import { afterEach, describe, expect, it, vi } from "vitest";

describe("adminUserStatusService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("envia PATCH com payload de status e mapeia resposta de sucesso", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: "Status do usuário atualizado com sucesso.",
        data: {
          user: {
            id: "user-001",
            status: "inactive",
          },
          revokedSessions: 2,
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("../config/appMode", () => ({
      appConfig: {
        appMode: "local",
        apiUrl: "http://localhost:3333",
        isGithubPages: false,
      },
    }));

    const { updateAdminUserStatus } = await import("../services/adminUserStatusService");

    await expect(updateAdminUserStatus("user-001", "inactive")).resolves.toEqual({
      user: {
        id: "user-001",
        status: "inactive",
      },
      revokedSessions: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users/user-001/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "inactive" }),
      }),
    );
  });

  it("GitHub Pages não dispara mutação nem simula sucesso", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("../config/appMode", () => ({
      appConfig: {
        appMode: "demo",
        apiUrl: null,
        isGithubPages: true,
      },
    }));

    const { updateAdminUserStatus } = await import("../services/adminUserStatusService");

    await expect(updateAdminUserStatus("user-001", "inactive")).rejects.toMatchObject({
      code: "ADMIN_USER_STATUS_UNAVAILABLE_IN_DEMO",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
