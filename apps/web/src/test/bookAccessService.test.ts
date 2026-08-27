import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const bookAccessGroup = {
  id: "emmanuel",
  name: "Emmanuel",
  knowledgeBook: {
    id: "book-emmanuel",
    slug: "emmanuel",
    title: "Emmanuel",
  },
};

const responseEnvelope = (groups: unknown[] = [bookAccessGroup]) => ({
  success: true,
  message: "Vínculos de livros listados com sucesso.",
  data: { groups },
  meta: { count: groups.length },
});

const errorEnvelope = (code: string, message: string) => ({
  success: false,
  error: { code, message },
});

const loadServiceModule = async (mode: "local" | "demo" = "local") => {
  vi.resetModules();
  vi.doMock("../config/appMode", () => ({
    appConfig: {
      appMode: mode,
      apiUrl: mode === "local" ? "http://localhost:3333" : null,
      canUseDemoFallback: mode === "demo",
    },
  }));

  return import("../services/bookAccessService");
};

describe("bookAccessService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("consulta /api/me/book-access e encaminha token autenticado", async () => {
    const { listUserBookAccess } = await loadServiceModule();
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "jwt-local");
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: "teacher-001",
        fullName: "Professor Demo",
        email: "professor.demo@example.com",
        role: "teacher",
        status: "active",
        mustChangePassword: false,
        permissions: [],
      }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(responseEnvelope())));

    await expect(listUserBookAccess()).resolves.toEqual({
      groups: [bookAccessGroup],
      count: 1,
      source: "api",
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:3333/api/me/book-access",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-local",
        }),
      }),
    );
  });

  it("aceita respostas válidas com dois grupos e zero grupos", async () => {
    const { listUserBookAccess } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          createJsonResponse(
            responseEnvelope([
              bookAccessGroup,
              {
                id: "a-caminho-da-luz",
                name: "A Caminho da Luz",
                knowledgeBook: {
                  id: "book-a-caminho-da-luz",
                  slug: "a-caminho-da-luz",
                  title: "A Caminho da Luz",
                },
              },
            ]),
          ),
        )
        .mockResolvedValueOnce(createJsonResponse(responseEnvelope([]))),
    );

    await expect(listUserBookAccess()).resolves.toMatchObject({
      count: 2,
      groups: [
        { id: "emmanuel" },
        { id: "a-caminho-da-luz" },
      ],
    });
    await expect(listUserBookAccess()).resolves.toEqual({
      groups: [],
      count: 0,
      source: "api",
    });
  });

  it("falha fechado para payload inválido", async () => {
    const { listUserBookAccess } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse({ success: true, data: { groups: "emmanuel" } }))
        .mockResolvedValueOnce(createJsonResponse(responseEnvelope([{ id: "emmanuel", name: "Emmanuel" }])))
        .mockResolvedValueOnce(
          createJsonResponse(
            responseEnvelope([
              {
                id: "emmanuel",
                name: "Emmanuel",
                knowledgeBook: { id: "", slug: "emmanuel", title: "Emmanuel" },
              },
            ]),
          ),
        ),
    );

    await expect(listUserBookAccess()).rejects.toMatchObject({ kind: "api" });
    await expect(listUserBookAccess()).rejects.toMatchObject({ kind: "api" });
    await expect(listUserBookAccess()).rejects.toMatchObject({ kind: "api" });
  });

  it.each([
    ["AUTH_REQUIRED", 401],
    ["FORBIDDEN", 403],
    ["BOOK_ACCESS_CATALOG_UNAVAILABLE", 503],
  ])("preserva erro %s sem retornar mock", async (code, status) => {
    const { listUserBookAccess } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => createJsonResponse(errorEnvelope(code, "Erro seguro."), false)),
    );

    await expect(listUserBookAccess()).rejects.toMatchObject({
      kind: "api",
      code,
    });
    expect(status).toBeGreaterThan(0);
  });

  it("usa mock somente no modo demo explícito", async () => {
    const { listUserBookAccess } = await loadServiceModule("demo");
    vi.stubGlobal("fetch", vi.fn());

    const result = await listUserBookAccess();

    expect(result.source).toBe("mock");
    expect(result.groups.map((group) => group.id)).toEqual(["emmanuel", "a-caminho-da-luz"]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("não retorna scope mock após erro de rede em runtime local com API", async () => {
    const { listUserBookAccess } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(listUserBookAccess()).rejects.toMatchObject({
      kind: "network",
    });
  });
});
