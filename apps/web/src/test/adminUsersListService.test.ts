import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { ServiceRequestError } from "../services/api";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const listItem = {
  id: "account-user-001",
  name: "Ana Beatriz Moraes",
  emailMasked: "an***@demo.local",
  role: "student",
  status: "active",
  activationStatus: "activated",
  group: {
    name: "Emmanuel",
    slug: "emmanuel",
  },
  createdAt: "2026-07-12T10:00:00.000Z",
};

const listEnvelope = (items: unknown[] = [listItem]) => ({
  success: true,
  message: "Usuários administrativos consultados com sucesso.",
  data: {
    items,
  },
  meta: {
    page: 1,
    pageSize: 10,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
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

  return import("../services/adminUsersListService");
};

describe("admin users list service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    window.localStorage.clear();
  });

  it("listagem sem query gera URL sem ?", async () => {
    const { listAdminUsersList } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminUsersList();

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users",
      expect.any(Object),
    );
  });

  it("serializa todas as queries válidas na ordem do contrato", async () => {
    const { listAdminUsersList } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminUsersList({
      page: 2,
      pageSize: 25,
      search: "Ana",
      role: "teacher",
      status: "inactive",
      activationStatus: "not_activated",
      group: "emmanuel",
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users?page=2&pageSize=25&search=Ana&role=teacher&status=inactive&activationStatus=not_activated&group=emmanuel&sortBy=name&sortOrder=asc",
      expect.any(Object),
    );
  });

  it("omite valores vazios ou indefinidos", async () => {
    const { listAdminUsersList } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminUsersList({
      page: null,
      pageSize: undefined,
      search: "  Ana Beatriz  ",
      role: null,
      status: undefined,
      activationStatus: null,
      group: "   ",
      sortBy: undefined,
      sortOrder: null,
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/users?search=Ana+Beatriz",
      expect.any(Object),
    );
  });

  it("faz o parsing do envelope e preserva group null", async () => {
    const { listAdminUsersList } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          listEnvelope([
            {
              ...listItem,
              group: null,
            },
          ]),
        ),
      ),
    );

    const result = await listAdminUsersList();

    expect(result).toEqual({
      items: [
        {
          ...listItem,
          group: null,
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
      source: "api",
    });
  });

  it("encaminha o token pelo mecanismo existente", async () => {
    const { listAdminUsersList } = await loadServiceModule();
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

    await listAdminUsersList();

    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-local",
        }),
      }),
    );
  });

  it("rejeita envelope inválido", async () => {
    const { listAdminUsersList } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          message: "ok",
          data: {
            items: [
              {
                ...listItem,
                role: "unknown",
              },
            ],
          },
          meta: {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          },
        }),
      ),
    );

    await expect(listAdminUsersList()).rejects.toMatchObject({
      message: "Resposta inválida do servidor para usuários administrativos.",
    });
  });

  it("propaga erro HTTP sem fallback para mock no modo local", async () => {
    const { listAdminUsersList } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Seu perfil não tem acesso a este recurso.",
            },
          },
          false,
        ),
      ),
    );

    await expect(listAdminUsersList()).rejects.toMatchObject({
      code: "FORBIDDEN",
      kind: "api",
    });
  });

  it("propaga erro de rede sem fallback para mock no modo local", async () => {
    const { listAdminUsersList } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(listAdminUsersList()).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("modo demo não faz chamada HTTP", async () => {
    const { listAdminUsersList } = await loadServiceModule("demo");
    const fetchSpy = vi.fn(async () => createJsonResponse(listEnvelope()));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await listAdminUsersList();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.source).toBe("demo");
  });

  it("modo demo aplica filtros", async () => {
    const { listAdminUsersList } = await loadServiceModule("demo");

    const result = await listAdminUsersList({
      role: "visitor",
      status: "pending",
      activationStatus: "not_activated",
      group: null,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        name: "Diego Farias",
        role: "visitor",
        status: "pending",
        activationStatus: "not_activated",
      }),
    ]);
  });

  it("modo demo aplica ordenação determinística", async () => {
    const { listAdminUsersList } = await loadServiceModule("demo");

    const result = await listAdminUsersList({
      sortBy: "name",
      sortOrder: "asc",
      pageSize: 3,
    });

    expect(result.items.map((item) => item.name)).toEqual([
      "Ana Beatriz Moraes",
      "Bruno Lima",
      "Celia Nogueira",
    ]);
  });

  it("modo demo aplica paginação", async () => {
    const { listAdminUsersList } = await loadServiceModule("demo");

    const result = await listAdminUsersList({
      page: 2,
      pageSize: 5,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.meta).toEqual({
      page: 2,
      pageSize: 5,
      total: 12,
      totalPages: 3,
    });
    expect(result.items).toHaveLength(5);
  });

  it("modo demo mantém apenas e-mails já mascarados", async () => {
    const { listAdminUsersList } = await loadServiceModule("demo");

    const result = await listAdminUsersList({ search: "an***" });

    expect(result.items).toEqual([
      expect.objectContaining({
        emailMasked: "an***@demo.local",
      }),
    ]);
    expect(result.items.some((item) => item.emailMasked.includes("ana.beatriz"))).toBe(false);
  });
});
