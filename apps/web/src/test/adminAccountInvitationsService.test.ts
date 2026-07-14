import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
} from "../services/adminAccountInvitationsService";
import { ServiceRequestError } from "../services/api";

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const listItem = {
  id: "account-invitation-001",
  recipientName: "Ana Beatriz",
  recipientEmailMasked: "a***z@example.com",
  invitationType: "enrollment_approval",
  deliveryStatus: "sent",
  lifecycleStatus: "pending",
  createdAt: "2026-07-12T10:00:00.000Z",
  expiresAt: "2026-07-14T10:00:00.000Z",
  deliveredAt: "2026-07-12T10:01:00.000Z",
  deliveryFailedAt: null,
  acceptedAt: null,
  invalidatedAt: null,
  invitedByName: "Admin Demonstrativo",
};

const listEnvelope = (items: unknown[] = [listItem]) => ({
  success: true,
  message: "Convites administrativos consultados com sucesso.",
  data: {
    items,
  },
  meta: {
    page: 1,
    pageSize: 10,
    total: items.length,
    totalPages: 1,
  },
});

const resendEnvelope = (invitation: unknown = {
  expiresAt: "2026-07-15T10:00:00.000Z",
  deliveryStatus: "sent",
  invitationType: "admin_reinvite",
}) => ({
  success: true,
  message: "Reenvio de convite processado com sucesso.",
  data: {
    invitation,
  },
});

const fetchMock = () => {
  return vi.mocked(fetch);
};

const expectInvalidListItem = async (item: unknown) => {
  vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope([item]))));

  await expect(listAdminAccountInvitations()).rejects.toBeInstanceOf(ServiceRequestError);
};

const expectInvalidListMeta = async (meta: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      createJsonResponse({
        success: true,
        message: "ok",
        data: {
          items: [],
        },
        meta,
      }),
    ),
  );

  await expect(listAdminAccountInvitations()).rejects.toBeInstanceOf(ServiceRequestError);
};

const expectInvalidResendInvitation = async (invitation: unknown) => {
  vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(resendEnvelope(invitation))));

  await expect(resendAdminAccountInvitation("invite-001")).rejects.toBeInstanceOf(ServiceRequestError);
};

describe("admin account invitations service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("listagem sem query gera URL sem ?", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminAccountInvitations();

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/account-invitations",
      expect.any(Object),
    );
  });

  it("serializa todos os filtros válidos na ordem do contrato", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminAccountInvitations({
      page: 2,
      pageSize: 25,
      deliveryStatus: "failed",
      lifecycleStatus: "expired",
      invitationType: "admin_reinvite",
      search: "Ana",
      sortBy: "recipient",
      sortOrder: "asc",
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/account-invitations?page=2&pageSize=25&deliveryStatus=failed&lifecycleStatus=expired&invitationType=admin_reinvite&search=Ana&sortBy=recipient&sortOrder=asc",
      expect.any(Object),
    );
  });

  it("trima search e omite parâmetros vazios", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminAccountInvitations({
      page: null,
      pageSize: undefined,
      deliveryStatus: null,
      lifecycleStatus: undefined,
      invitationType: null,
      search: "  Ana Beatriz  ",
      sortBy: undefined,
      sortOrder: null,
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/account-invitations?search=Ana+Beatriz",
      expect.any(Object),
    );
  });

  it("omite string vazia e gera URL sem ?", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminAccountInvitations({ search: "   " });

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/account-invitations",
      expect.any(Object),
    );
  });

  it("codifica caracteres especiais", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    await listAdminAccountInvitations({ search: "Ana & Bruno/Teste?" });

    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/account-invitations?search=Ana+%26+Bruno%2FTeste%3F",
      expect.any(Object),
    );
  });

  it("não muta o objeto de parâmetros", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));
    const params = {
      search: "  Ana  ",
      sortBy: "createdAt" as const,
      sortOrder: "desc" as const,
    };

    await listAdminAccountInvitations(params);

    expect(params).toEqual({
      search: "  Ana  ",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("encaminha o token de autenticação pelo mecanismo existente", async () => {
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

    await listAdminAccountInvitations();

    expect(fetchMock().mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-local",
        }),
      }),
    );
  });

  it("cancelamento usa método, URL e body corretos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          message: "Convite cancelado com sucesso.",
          data: { canceled: true },
        }),
      ),
    );

    const result = await cancelAdminAccountInvitation("invite/001");

    expect(result).toEqual({ canceled: true });
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/account-invitations/invite%2F001/cancel",
      expect.objectContaining({
        method: "POST",
        body: "{}",
      }),
    );
  });

  it("reenvio usa método, URL e body corretos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          message: "Reenvio de convite processado com sucesso.",
          data: {
            invitation: {
              expiresAt: "2026-07-15T10:00:00.000Z",
              deliveryStatus: "sent",
              invitationType: "admin_reinvite",
            },
          },
        }),
      ),
    );

    const result = await resendAdminAccountInvitation("invite 001");

    expect(result).toEqual({
      invitation: {
        expiresAt: "2026-07-15T10:00:00.000Z",
        deliveryStatus: "sent",
        invitationType: "admin_reinvite",
      },
    });
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3333/api/admin/account-invitations/invite%20001/resend",
      expect.objectContaining({
        method: "POST",
        body: "{}",
      }),
    );
  });

  it("sucesso da listagem retorna items e meta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(listEnvelope())));

    const result = await listAdminAccountInvitations();

    expect(result).toEqual({
      items: [listItem],
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it.each([
    ["AUTH_REQUIRED", 401],
    ["FORBIDDEN", 403],
    ["ACCOUNT_INVITATION_NOT_CANCELABLE", 409],
    ["ADMIN_INVITATION_RESEND_RATE_LIMITED", 429],
  ])("%s continua erro", async (code, status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          {
            success: false,
            error: {
              code,
              message: "Não foi possível concluir a solicitação.",
              details: status === 429 ? { retryAfterSeconds: 120 } : undefined,
            },
          },
          false,
        ),
      ),
    );

    await expect(listAdminAccountInvitations()).rejects.toMatchObject({
      kind: "api",
      code,
    });
  });

  it("falha de rede continua erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));

    await expect(listAdminAccountInvitations()).rejects.toMatchObject({
      kind: "network",
    });
  });

  it.each([
    ["listagem sem data", { success: true, message: "ok" }],
    ["listagem sem items", { success: true, message: "ok", data: {}, meta: {} }],
    ["listagem com items inválido", { success: true, message: "ok", data: { items: {} }, meta: {} }],
    ["listagem sem meta", { success: true, message: "ok", data: { items: [] } }],
  ])("não aceita envelope inválido: %s", async (_caseName, payload) => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(payload)));

    await expect(listAdminAccountInvitations()).rejects.toBeInstanceOf(ServiceRequestError);
  });

  it("não aceita cancelamento sem canceled true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          message: "ok",
          data: { canceled: false },
        }),
      ),
    );

    await expect(cancelAdminAccountInvitation("invite-001")).rejects.toBeInstanceOf(ServiceRequestError);
  });

  it("não aceita reenvio sem data.invitation", async () => {
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

    await expect(resendAdminAccountInvitation("invite-001")).rejects.toBeInstanceOf(ServiceRequestError);
  });

  it("rejeita item sem id", async () => {
    const { id: _id, ...itemWithoutId } = listItem;

    await expectInvalidListItem(itemWithoutId);
  });

  it("rejeita item com id vazio", async () => {
    await expectInvalidListItem({
      ...listItem,
      id: "",
    });
  });

  it("rejeita item com deliveryStatus inválido", async () => {
    await expectInvalidListItem({
      ...listItem,
      deliveryStatus: "delivered",
    });
  });

  it("rejeita item com lifecycleStatus inválido", async () => {
    await expectInvalidListItem({
      ...listItem,
      lifecycleStatus: "active",
    });
  });

  it("rejeita item com invitationType inválido", async () => {
    await expectInvalidListItem({
      ...listItem,
      invitationType: "manual",
    });
  });

  it("rejeita campo obrigatório com tipo incorreto", async () => {
    await expectInvalidListItem({
      ...listItem,
      recipientName: 123,
    });
  });

  it("rejeita campo opcional diferente de string ou null", async () => {
    await expectInvalidListItem({
      ...listItem,
      deliveredAt: 123,
    });
  });

  it("rejeita meta.page ausente", async () => {
    await expectInvalidListMeta({
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it("rejeita meta.page como string", async () => {
    await expectInvalidListMeta({
      page: "1",
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it("rejeita meta.page fracionário", async () => {
    await expectInvalidListMeta({
      page: 1.5,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it("rejeita meta.pageSize igual a zero", async () => {
    await expectInvalidListMeta({
      page: 1,
      pageSize: 0,
      total: 0,
      totalPages: 0,
    });
  });

  it("rejeita meta.total negativo", async () => {
    await expectInvalidListMeta({
      page: 1,
      pageSize: 10,
      total: -1,
      totalPages: 0,
    });
  });

  it("rejeita meta.totalPages como NaN", async () => {
    await expectInvalidListMeta({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: Number.NaN,
    });
  });

  it("rejeita reenvio sem expiresAt", async () => {
    await expectInvalidResendInvitation({
      deliveryStatus: "sent",
      invitationType: "admin_reinvite",
    });
  });

  it("rejeita reenvio com expiresAt vazio", async () => {
    await expectInvalidResendInvitation({
      expiresAt: "",
      deliveryStatus: "sent",
      invitationType: "admin_reinvite",
    });
  });

  it("rejeita reenvio com deliveryStatus inválido", async () => {
    await expectInvalidResendInvitation({
      expiresAt: "2026-07-15T10:00:00.000Z",
      deliveryStatus: "delivered",
      invitationType: "admin_reinvite",
    });
  });

  it("rejeita reenvio com invitationType diferente de admin_reinvite", async () => {
    await expectInvalidResendInvitation({
      expiresAt: "2026-07-15T10:00:00.000Z",
      deliveryStatus: "sent",
      invitationType: "enrollment_approval",
    });
  });

  it("remove dados sensíveis dos objetos retornados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/resend")) {
          return createJsonResponse({
            success: true,
            message: "ok",
            data: {
              invitation: {
                expiresAt: "2026-07-15T10:00:00.000Z",
                deliveryStatus: "sent",
                invitationType: "admin_reinvite",
                token: "raw-token",
                tokenHash: "token-hash",
                activationUrl: "https://example.test/#/ativar-conta?token=raw-token",
                userId: "user-001",
                recipientEmail: "ana.beatriz@example.com",
              },
            },
          });
        }

        return createJsonResponse(
          listEnvelope([
            {
              ...listItem,
              token: "raw-token",
              tokenHash: "token-hash",
              rawToken: "raw-token",
              activationUrl: "https://example.test/#/ativar-conta?token=raw-token",
              password: "Senha@123",
              passwordHash: "password-hash",
              userId: "user-001",
              invitedByUserId: "admin-001",
              recipientEmail: "ana.beatriz@example.com",
              jwt: "jwt-token",
              ip: "127.0.0.1",
              smtp: "smtp://localhost",
            },
          ]),
        );
      }),
    );

    const listResult = await listAdminAccountInvitations();
    const resendResult = await resendAdminAccountInvitation("invite-001");

    expect(JSON.stringify(listResult)).not.toContain("raw-token");
    expect(JSON.stringify(listResult)).not.toContain("token-hash");
    expect(JSON.stringify(listResult)).not.toContain("ativar-conta");
    expect(JSON.stringify(listResult)).not.toContain("Senha@123");
    expect(JSON.stringify(listResult)).not.toContain("password-hash");
    expect(JSON.stringify(listResult)).not.toContain("user-001");
    expect(JSON.stringify(listResult)).not.toContain("admin-001");
    expect(JSON.stringify(listResult)).not.toContain("ana.beatriz@example.com");
    expect(JSON.stringify(listResult)).not.toContain("jwt-token");
    expect(JSON.stringify(listResult)).not.toContain("127.0.0.1");
    expect(JSON.stringify(listResult)).not.toContain("smtp://localhost");
    expect(JSON.stringify(resendResult)).not.toContain("raw-token");
    expect(JSON.stringify(resendResult)).not.toContain("token-hash");
    expect(JSON.stringify(resendResult)).not.toContain("ativar-conta");
    expect(JSON.stringify(resendResult)).not.toContain("user-001");
    expect(JSON.stringify(resendResult)).not.toContain("ana.beatriz@example.com");
  });
});
