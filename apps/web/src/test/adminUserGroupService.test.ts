import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";

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
    },
  }));

  return import("../services/adminUserGroupService");
};

describe("adminUserGroupService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("envia PATCH com groupSlug string e mapeia resposta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        success: true,
        message: "Grupo do usuário atualizado com sucesso.",
        data: {
          user: {
            id: "user-001",
            group: {
              name: "Emmanuel",
              slug: "emmanuel",
            },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
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

    const { updateAdminUserGroup } = await loadServiceModule();

    await expect(updateAdminUserGroup("user-001", { groupSlug: "emmanuel" })).resolves.toEqual({
      user: {
        id: "user-001",
        group: {
          name: "Emmanuel",
          slug: "emmanuel",
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users/user-001/group",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ groupSlug: "emmanuel" }),
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-local",
        }),
      }),
    );
  });

  it("aceita remoção com groupSlug null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          success: true,
          message: "Grupo do usuário atualizado com sucesso.",
          data: {
            user: {
              id: "user-001",
              group: null,
            },
          },
        }),
      ),
    );

    const { updateAdminUserGroup } = await loadServiceModule();

    await expect(updateAdminUserGroup("user-001", { groupSlug: null })).resolves.toEqual({
      user: {
        id: "user-001",
        group: null,
      },
    });
  });

  it("codifica corretamente o userId na URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        success: true,
        message: "Grupo do usuário atualizado com sucesso.",
        data: {
          user: { id: "user/001", group: null },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { updateAdminUserGroup } = await loadServiceModule();
    await updateAdminUserGroup("user/001", { groupSlug: null });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users/user%2F001/group",
      expect.any(Object),
    );
  });

  it("rejeita grupo parcial inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          success: true,
          message: "Grupo do usuário atualizado com sucesso.",
          data: {
            user: {
              id: "user-001",
              group: {
                name: "Emmanuel",
              },
            },
          },
        }),
      ),
    );

    const { updateAdminUserGroup } = await loadServiceModule();

    await expect(updateAdminUserGroup("user-001", { groupSlug: "emmanuel" })).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para alteração de grupo.",
    });
  });

  it.each([
    ["nome vazio", { name: "", slug: "emmanuel" }],
    ["slug vazio", { name: "Emmanuel", slug: "" }],
  ])("rejeita grupo inválido com %s", async (_label, group) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          success: true,
          message: "Grupo do usuário atualizado com sucesso.",
          data: {
            user: {
              id: "user-001",
              group,
            },
          },
        }),
      ),
    );

    const { updateAdminUserGroup } = await loadServiceModule();

    await expect(updateAdminUserGroup("user-001", { groupSlug: "emmanuel" })).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para alteração de grupo.",
    });
  });

  it("rejeita usuário inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          success: true,
          message: "Grupo do usuário atualizado com sucesso.",
          data: {
            user: {
              id: "",
              group: null,
            },
          },
        }),
      ),
    );

    const { updateAdminUserGroup } = await loadServiceModule();

    await expect(updateAdminUserGroup("user-001", { groupSlug: null })).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para alteração de grupo.",
    });
  });

  it("rejeita envelope inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          success: true,
          message: "ok",
          data: {},
        }),
      ),
    );

    const { updateAdminUserGroup } = await loadServiceModule();

    await expect(updateAdminUserGroup("user-001", { groupSlug: null })).rejects.toMatchObject({
      kind: "api",
      message: "Resposta inválida do servidor para alteração de grupo.",
    });
  });

  it("preserva ServiceRequestError da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: "ADMIN_USER_GROUP_INACTIVE",
            message: "Grupo inativo não pode ser associado ao usuário.",
          },
        }),
      }),
    );

    const { updateAdminUserGroup } = await loadServiceModule();

    await expect(updateAdminUserGroup("user-001", { groupSlug: "grupo-inativo" })).rejects.toMatchObject({
      code: "ADMIN_USER_GROUP_INACTIVE",
      kind: "api",
    });
  });

  it("bloqueia a mutação no modo demo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { updateAdminUserGroup } = await loadServiceModule("demo");

    await expect(updateAdminUserGroup("user-001", { groupSlug: "emmanuel" })).rejects.toMatchObject({
      code: "ADMIN_USER_GROUP_UNAVAILABLE_IN_DEMO",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
