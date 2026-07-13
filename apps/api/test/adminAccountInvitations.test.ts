import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { app } from "../src/app";
import type { AuthUser, ListAccountInvitationsInput } from "../src/modules/auth/auth.types";
import {
  accountInvitationResendContextSelect,
  calculateAccountInvitationLifecycleStatus,
  createMemoryAuthRepository,
  getMemoryAccountInvitations,
  getMemoryAuthAuditLogs,
  resetMemoryAuthRepositoryStore,
  type AuthRepository,
} from "../src/modules/auth/auth.repository";
import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
  setAuthRepositoryForTesting,
} from "../src/modules/auth/auth.service";
import {
  listAccountInvitationPreviews,
  resetAccountInvitationNotifier,
  setAccountInvitationNotifierForTesting,
} from "../src/modules/auth/account-invitation.notifier";
import { resetAuthRateLimitStore } from "../src/security/auth-rate-limit";

const NOW = new Date("2026-07-12T12:00:00.000Z");
const PAST = new Date("2026-07-11T12:00:00.000Z").toISOString();
const FUTURE = new Date("2027-07-13T12:00:00.000Z").toISOString();

const adminUser: AuthUser = {
  id: "user-admin-demo",
  fullName: "Admin Demonstrativo",
  email: "admin.demo@example.com",
  role: "admin",
  status: "active",
  permissions: [],
};

const teacherUser: AuthUser = {
  ...adminUser,
  id: "teacher-001",
  role: "teacher",
};

type TestUserKey = "ana" | "bruno" | "clara" | "diego" | "elisa";
type TestUserIds = Record<TestUserKey, string>;

const createInvitation = async (
  repository: AuthRepository,
  input: {
    userId: string;
    tokenHash: string;
    email: string;
    expiresAt?: string;
    invitationType?: "enrollment_approval" | "admin_reinvite";
  },
) => {
  return repository.replaceAccountInvitation({
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt ?? FUTURE,
    invitedByUserId: adminUser.id,
    invitationType: input.invitationType ?? "enrollment_approval",
    recipientEmailSnapshot: input.email,
    actorName: adminUser.fullName,
    actorRole: adminUser.role,
  });
};

const expectDomainError = async (action: Promise<unknown>, code: string) => {
  await expect(action).rejects.toMatchObject({
    code,
  });
};

const buildListInput = (
  overrides: Partial<ListAccountInvitationsInput> = {},
): ListAccountInvitationsInput => ({
  page: 1,
  pageSize: 10,
  sortBy: "createdAt",
  sortOrder: "desc",
  ...overrides,
});

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data.token as string;
};

const loginAsAdmin = () => loginAs("admin.demo@example.com", "AdminDemo@123");
const loginAsTeacher = () => loginAs("professor.demo@example.com", "ProfessorDemo@123");
const loginAsStudent = () => loginAs("aluno.demo@example.com", "AlunoDemo@123");

describe("admin account invitations foundation", () => {
  let repository: AuthRepository;
  let testUserIds: TestUserIds;

  const seedInvitationMatrix = async () => {
    await createInvitation(repository, {
      userId: testUserIds.ana,
      tokenHash: "hash-ana",
      email: "ana.beatriz@example.com",
    });
    const bruno = await createInvitation(repository, {
      userId: testUserIds.bruno,
      tokenHash: "hash-bruno",
      email: "bruno@example.com",
      invitationType: "admin_reinvite",
    });
    await repository.markAccountInvitationDelivered({
      invitationId: bruno.id,
      deliveredAt: NOW.toISOString(),
      actorName: adminUser.fullName,
      actorRole: adminUser.role,
      note: "Entrega registrada em teste.",
    });
    await createInvitation(repository, {
      userId: testUserIds.clara,
      tokenHash: "hash-clara",
      email: "clara@example.com",
      expiresAt: PAST,
    });
    const diego = await createInvitation(repository, {
      userId: testUserIds.diego,
      tokenHash: "hash-diego",
      email: "diego@example.com",
    });
    await repository.cancelAccountInvitation({
      invitationId: diego.id,
      actorName: adminUser.fullName,
      actorRole: adminUser.role,
      now: NOW,
    });
    await createInvitation(repository, {
      userId: testUserIds.elisa,
      tokenHash: "hash-elisa",
      email: "elisa@example.com",
    });
    await repository.acceptAccountInvitation({
      tokenHash: "hash-elisa",
      passwordHash: "new-hash",
      passwordChangedAt: NOW.toISOString(),
      actorName: "Participante",
      actorRole: "student",
    });
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    resetAuthRateLimitStore();
    let nextTimestamp = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      nextTimestamp += 1;
      return nextTimestamp;
    });
    resetMemoryAuthRepositoryStore();
    resetAccountInvitationNotifier();
    repository = createMemoryAuthRepository();
    setAuthRepositoryForTesting(repository);
    testUserIds = {} as TestUserIds;

    const users: Array<{ key: TestUserKey; fullName: string; email: string }> = [
      { key: "ana", fullName: "Ana Beatriz", email: "ana@example.com" },
      { key: "bruno", fullName: "Bruno Costa", email: "bruno@example.com" },
      { key: "clara", fullName: "Clara Dias", email: "clara@example.com" },
      { key: "diego", fullName: "Diego Lima", email: "diego@example.com" },
      { key: "elisa", fullName: "Elisa Martins", email: "elisa@example.com" },
    ];

    for (const user of users) {
      const result = await repository.prepareInvitedEnrollmentUser({
        enrollmentId: `enrollment-${user.key}`,
        fullName: user.fullName,
        email: user.email,
        whatsapp: "11999999999",
        groupName: null,
        groupSlug: null,
        actorName: adminUser.fullName,
        actorRole: adminUser.role,
        passwordHash: "hash",
      });

      testUserIds[user.key] = result.user.id;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("status calculado", () => {
    it("calcula pending", () => {
      expect(calculateAccountInvitationLifecycleStatus({ expiresAt: FUTURE }, NOW)).toBe("pending");
    });

    it("calcula accepted", () => {
      expect(
        calculateAccountInvitationLifecycleStatus(
          { acceptedAt: PAST, expiresAt: FUTURE },
          NOW,
        ),
      ).toBe("accepted");
    });

    it("calcula expired", () => {
      expect(calculateAccountInvitationLifecycleStatus({ expiresAt: PAST }, NOW)).toBe("expired");
    });

    it("calcula canceled", () => {
      expect(
        calculateAccountInvitationLifecycleStatus(
          { invalidatedAt: PAST, expiresAt: FUTURE },
          NOW,
        ),
      ).toBe("canceled");
    });

    it("prioriza accepted", () => {
      expect(
        calculateAccountInvitationLifecycleStatus(
          { acceptedAt: PAST, invalidatedAt: PAST, expiresAt: PAST },
          NOW,
        ),
      ).toBe("accepted");
    });

    it("prioriza canceled sobre expired", () => {
      expect(
        calculateAccountInvitationLifecycleStatus(
          { invalidatedAt: PAST, expiresAt: PAST },
          NOW,
        ),
      ).toBe("canceled");
    });
  });

  describe("listagem", () => {
    beforeEach(async () => {
      let nextTimestamp = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => {
        nextTimestamp += 1;
        return nextTimestamp;
      });

      await seedInvitationMatrix();
    });

    it("aplica paginação padrão pelo serviço", async () => {
      const result = await listAdminAccountInvitations(adminUser);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(1);
    });

    it("retorna segunda página", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        page: 2,
        pageSize: 2,
        sortBy: "recipient",
        sortOrder: "asc",
      });

      expect(result.items.map((item) => item.recipientName)).toEqual([
        "Clara Dias",
        "Diego Lima",
      ]);
    });

    it("filtra por delivery status", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        deliveryStatus: "sent",
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.recipientName).sort()).toEqual([
        "Bruno Costa",
        "Elisa Martins",
      ]);
    });

    it("filtra por lifecycle status", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        lifecycleStatus: "expired",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].recipientName).toBe("Clara Dias");
    });

    it("filtra por invitation type", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        invitationType: "admin_reinvite",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].recipientName).toBe("Bruno Costa");
    });

    it("busca por nome", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        search: "beatriz",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].recipientName).toBe("Ana Beatriz");
    });

    it("busca por e-mail", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        search: "DIEGO@EXAMPLE.COM",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].recipientName).toBe("Diego Lima");
    });

    it("ordena de forma ascendente", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        sortBy: "recipient",
        sortOrder: "asc",
      });

      expect(result.items.map((item) => item.recipientName)).toEqual([
        "Ana Beatriz",
        "Bruno Costa",
        "Clara Dias",
        "Diego Lima",
        "Elisa Martins",
      ]);
    });

    it("ordena de forma descendente", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        sortBy: "recipient",
        sortOrder: "desc",
      });

      expect(result.items.map((item) => item.recipientName)).toEqual([
        "Elisa Martins",
        "Diego Lima",
        "Clara Dias",
        "Bruno Costa",
        "Ana Beatriz",
      ]);
    });

    it("usa desempate determinístico por id com sortOrder asc", async () => {
      const result = await repository.listAccountInvitations(
        {
          page: 1,
          pageSize: 5,
          lifecycleStatus: "pending",
          sortBy: "expiresAt",
          sortOrder: "asc",
        },
        NOW,
      );
      const ids = result.items.map((item) => item.id);

      expect(ids).toEqual([...ids].sort((first, second) => first.localeCompare(second)));
    });

    it("usa desempate determinístico por id com sortOrder desc", async () => {
      const result = await repository.listAccountInvitations(
        {
          page: 1,
          pageSize: 5,
          lifecycleStatus: "pending",
          sortBy: "expiresAt",
          sortOrder: "desc",
        },
        NOW,
      );
      const ids = result.items.map((item) => item.id);

      expect(ids).toEqual([...ids].sort((first, second) => first.localeCompare(second)));
    });

    it("rejeita sortBy inválido no repositório", async () => {
      await expect(
        repository.listAccountInvitations(
          buildListInput({
            sortBy: "updatedAt" as ListAccountInvitationsInput["sortBy"],
          }),
          NOW,
        ),
      ).rejects.toThrow(RangeError);
    });

    it("rejeita sortOrder inválido no repositório", async () => {
      await expect(
        repository.listAccountInvitations(
          buildListInput({
            sortOrder: "sideways" as ListAccountInvitationsInput["sortOrder"],
          }),
          NOW,
        ),
      ).rejects.toThrow(RangeError);
    });

    it("rejeita page menor que 1 no repositório", async () => {
      await expect(
        repository.listAccountInvitations(
          buildListInput({
            page: 0,
          }),
          NOW,
        ),
      ).rejects.toThrow(RangeError);
    });

    it("rejeita pageSize menor que 1 no repositório", async () => {
      await expect(
        repository.listAccountInvitations(
          buildListInput({
            pageSize: 0,
          }),
          NOW,
        ),
      ).rejects.toThrow(RangeError);
    });

    it("rejeita pageSize maior que 50 no repositório", async () => {
      await expect(
        repository.listAccountInvitations(
          buildListInput({
            pageSize: 51,
          }),
          NOW,
        ),
      ).rejects.toThrow(RangeError);
    });

    it("não expõe dados sensíveis", async () => {
      const result = await listAdminAccountInvitations(adminUser, {
        search: "ana",
      });
      const item = result.items[0] as unknown as Record<string, unknown>;

      expect(item.recipientEmailMasked).toBe("a***z@example.com");
      expect(item).not.toHaveProperty("token");
      expect(item).not.toHaveProperty("tokenHash");
      expect(item).not.toHaveProperty("invitationUrl");
      expect(item).not.toHaveProperty("password");
      expect(item).not.toHaveProperty("userId");
      expect(item).not.toHaveProperty("invitedByUserId");
      expect(JSON.stringify(item)).not.toContain("ana.beatriz@example.com");
    });

    it("mantém comportamento equivalente no modo em memória", async () => {
      const result = await repository.listAccountInvitations(
        {
          page: 1,
          pageSize: 50,
          lifecycleStatus: "canceled",
          sortBy: "recipient",
          sortOrder: "asc",
        },
        NOW,
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          recipientName: "Diego Lima",
          lifecycleStatus: "canceled",
          deliveryStatus: "pending",
        }),
      );
    });
  });

  describe("cancelamento", () => {
    it("permite admin cancelar convite utilizável", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "cancel-hash",
        email: "ana@example.com",
      });

      await expect(cancelAdminAccountInvitation(adminUser, invitation.id)).resolves.toEqual({
        canceled: true,
      });

      const storedInvitation = getMemoryAccountInvitations().find((item) => item.id === invitation.id);
      expect(storedInvitation?.invalidatedAt).toEqual(expect.any(String));
    });

    it("preserva deliveryStatus e cria auditoria", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.bruno,
        tokenHash: "sent-cancel-hash",
        email: "bruno@example.com",
      });
      await repository.markAccountInvitationDelivered({
        invitationId: invitation.id,
        deliveredAt: NOW.toISOString(),
        actorName: adminUser.fullName,
        actorRole: adminUser.role,
        note: "Entrega registrada em teste.",
      });

      await cancelAdminAccountInvitation(adminUser, invitation.id);

      const storedInvitation = getMemoryAccountInvitations().find((item) => item.id === invitation.id);
      expect(storedInvitation?.deliveryStatus).toBe("sent");
      expect(getMemoryAuthAuditLogs()[0]).toEqual(
        expect.objectContaining({
          action: "ACCOUNT_INVITATION_CANCELED",
          entity: `AccountInvitation ${invitation.id}`,
        }),
      );
    });

    it("rejeita convite aceito", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.clara,
        tokenHash: "accepted-hash",
        email: "clara@example.com",
      });
      await repository.acceptAccountInvitation({
        tokenHash: "accepted-hash",
        passwordHash: "new-hash",
        passwordChangedAt: NOW.toISOString(),
        actorName: "Participante",
        actorRole: "student",
      });

      await expectDomainError(
        cancelAdminAccountInvitation(adminUser, invitation.id),
        "ACCOUNT_INVITATION_NOT_CANCELABLE",
      );
    });

    it("rejeita convite expirado", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.diego,
        tokenHash: "expired-hash",
        email: "diego@example.com",
        expiresAt: PAST,
      });

      await expectDomainError(
        cancelAdminAccountInvitation(adminUser, invitation.id),
        "ACCOUNT_INVITATION_NOT_CANCELABLE",
      );
    });

    it("rejeita convite já invalidado", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.elisa,
        tokenHash: "invalidated-hash",
        email: "elisa@example.com",
      });
      await cancelAdminAccountInvitation(adminUser, invitation.id);

      await expectDomainError(
        cancelAdminAccountInvitation(adminUser, invitation.id),
        "ACCOUNT_INVITATION_NOT_CANCELABLE",
      );
    });

    it("rejeita convite inexistente com o mesmo código", async () => {
      await expectDomainError(
        cancelAdminAccountInvitation(adminUser, "missing-invitation"),
        "ACCOUNT_INVITATION_NOT_CANCELABLE",
      );
    });

    it("não remove nem desativa usuário", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "user-preserved-hash",
        email: "ana@example.com",
      });

      await cancelAdminAccountInvitation(adminUser, invitation.id);

      await expect(repository.getById(testUserIds.ana)).resolves.toEqual(
        expect.objectContaining({
          id: testUserIds.ana,
          status: "active",
        }),
      );
    });

    it("não aciona entrega de e-mail", async () => {
      let sendCount = 0;
      setAccountInvitationNotifierForTesting({
        kind: "smtp",
        async sendAccountInvitation() {
          sendCount += 1;
        },
      });
      const invitation = await createInvitation(repository, {
        userId: testUserIds.bruno,
        tokenHash: "no-email-hash",
        email: "bruno@example.com",
      });

      await cancelAdminAccountInvitation(adminUser, invitation.id);

      expect(sendCount).toBe(0);
    });

    it("segunda tentativa não altera novamente o convite", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.clara,
        tokenHash: "double-cancel-hash",
        email: "clara@example.com",
      });
      await cancelAdminAccountInvitation(adminUser, invitation.id);
      const firstInvalidatedAt = getMemoryAccountInvitations().find(
        (item) => item.id === invitation.id,
      )?.invalidatedAt;

      await expectDomainError(
        cancelAdminAccountInvitation(adminUser, invitation.id),
        "ACCOUNT_INVITATION_NOT_CANCELABLE",
      );

      const secondInvalidatedAt = getMemoryAccountInvitations().find(
        (item) => item.id === invitation.id,
      )?.invalidatedAt;
      expect(secondInvalidatedAt).toBe(firstInvalidatedAt);
    });

    it("exige papel admin", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "forbidden-hash",
        email: "ana@example.com",
      });

      await expectDomainError(cancelAdminAccountInvitation(teacherUser, invitation.id), "FORBIDDEN");
    });
  });

  describe("reenvio", () => {
    const expectSuccessfulResend = async (invitationId: string) => {
      const previousPreviews = listAccountInvitationPreviews();
      const result = await resendAdminAccountInvitation(adminUser, invitationId);
      const previews = listAccountInvitationPreviews();
      const invitations = getMemoryAccountInvitations();

      expect(result).toEqual({
        invitation: {
          expiresAt: expect.any(String),
          deliveryStatus: "sent",
          invitationType: "admin_reinvite",
        },
      });
      expect(previews[0].token).not.toBe(previousPreviews[0]?.token);
      expect(invitations[0]).toEqual(
        expect.objectContaining({
          invitationType: "admin_reinvite",
          deliveryStatus: "sent",
        }),
      );
      expect(JSON.stringify(result)).not.toContain("token");
      expect(JSON.stringify(result)).not.toContain("hash");
      expect(JSON.stringify(result)).not.toContain("ativar-conta");
    };

    it("obtém contexto de reenvio sem tokenHash no modo em memória", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "context-hash",
        email: "ana@example.com",
      });

      const context = await repository.getAccountInvitationResendContext(invitation.id);

      expect(context).toEqual({
        invitationId: invitation.id,
        acceptedAt: null,
        user: expect.objectContaining({
          id: testUserIds.ana,
          fullName: "Ana Beatriz",
          email: "ana@example.com",
          accountActivatedAt: null,
          status: "active",
        }),
      });
      expect(context as unknown as Record<string, unknown>).not.toHaveProperty("tokenHash");
      expect(JSON.stringify(context)).not.toContain("context-hash");
    });

    it("mantém seleção Prisma mínima para contexto de reenvio", () => {
      expect(accountInvitationResendContextSelect).toEqual({
        id: true,
        acceptedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            accountActivatedAt: true,
            status: true,
          },
        },
      });
      expect(JSON.stringify(accountInvitationResendContextSelect)).not.toContain("tokenHash");
    });

    it("reenvia convite pendente", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "resend-pending-hash",
        email: "ana@example.com",
      });

      await expectSuccessfulResend(invitation.id);
    });

    it("reenvia convite enviado", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.bruno,
        tokenHash: "resend-sent-hash",
        email: "bruno@example.com",
      });
      await repository.markAccountInvitationDelivered({
        invitationId: invitation.id,
        deliveredAt: NOW.toISOString(),
        actorName: adminUser.fullName,
        actorRole: adminUser.role,
        note: "Entrega registrada em teste.",
      });

      await expectSuccessfulResend(invitation.id);
    });

    it("reenvia convite expirado", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.clara,
        tokenHash: "resend-expired-hash",
        email: "clara@example.com",
        expiresAt: PAST,
      });

      await expectSuccessfulResend(invitation.id);
    });

    it("reenvia convite cancelado", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.diego,
        tokenHash: "resend-canceled-hash",
        email: "diego@example.com",
      });
      await repository.cancelAccountInvitation({
        invitationId: invitation.id,
        actorName: adminUser.fullName,
        actorRole: adminUser.role,
        now: NOW,
      });

      await expectSuccessfulResend(invitation.id);
    });

    it("reenvia convite com entrega failed", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.elisa,
        tokenHash: "resend-failed-hash",
        email: "elisa@example.com",
      });
      await repository.markAccountInvitationFailed({
        invitationId: invitation.id,
        failedAt: NOW.toISOString(),
        invalidatedAt: NOW.toISOString(),
        actorName: adminUser.fullName,
        actorRole: adminUser.role,
        note: "Falha registrada em teste.",
      });

      await expectSuccessfulResend(invitation.id);
    });

    it("reenvia convite com entrega not_configured sem depender do deliveryStatus no contexto", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "resend-not-configured-hash",
        email: "ana@example.com",
      });
      setAccountInvitationNotifierForTesting({
        kind: "null",
        async sendAccountInvitation() {
          return;
        },
      });

      const result = await resendAdminAccountInvitation(adminUser, invitation.id);

      expect(result.invitation.deliveryStatus).toBe("not_configured");
      expect(result.invitation.invitationType).toBe("admin_reinvite");
    });

    it("invalida convite utilizável anterior e gera novo token", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "resend-old-hash",
        email: "ana@example.com",
        invitationType: "admin_reinvite",
      });
      const previousToken = listAccountInvitationPreviews()[0]?.token;

      await resendAdminAccountInvitation(adminUser, invitation.id);

      const invitations = getMemoryAccountInvitations();
      expect(invitations.find((item) => item.id === invitation.id)?.invalidatedAt).toEqual(
        expect.any(String),
      );
      expect(listAccountInvitationPreviews()[0].token).not.toBe(previousToken);
    });

    it("rejeita convite aceito, inexistente e usuário ativado com erro genérico", async () => {
      const acceptedInvitation = await createInvitation(repository, {
        userId: testUserIds.bruno,
        tokenHash: "resend-accepted-hash",
        email: "bruno@example.com",
      });
      await repository.acceptAccountInvitation({
        tokenHash: "resend-accepted-hash",
        passwordHash: "new-hash",
        passwordChangedAt: NOW.toISOString(),
        actorName: "Participante",
        actorRole: "student",
      });

      await expectDomainError(
        resendAdminAccountInvitation(adminUser, acceptedInvitation.id),
        "ACCOUNT_INVITATION_NOT_RESENDABLE",
      );
      await expectDomainError(
        resendAdminAccountInvitation(adminUser, "missing-invitation"),
        "ACCOUNT_INVITATION_NOT_RESENDABLE",
      );
      await expectDomainError(
        resendAdminAccountInvitation(adminUser, acceptedInvitation.id),
        "ACCOUNT_INVITATION_NOT_RESENDABLE",
      );
    });

    it("rejeita usuário inexistente e usuário não ativo genericamente", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "resend-context-hash",
        email: "ana@example.com",
      });
      const baseRepository = repository;
      setAuthRepositoryForTesting({
        ...baseRepository,
        async getAccountInvitationResendContext() {
          return {
            invitationId: invitation.id,
            acceptedAt: null,
            user: null,
          };
        },
      });

      await expectDomainError(
        resendAdminAccountInvitation(adminUser, invitation.id),
        "ACCOUNT_INVITATION_NOT_RESENDABLE",
      );

      setAuthRepositoryForTesting({
        ...baseRepository,
        async getAccountInvitationResendContext() {
          return {
            invitationId: invitation.id,
            acceptedAt: null,
            user: {
              id: testUserIds.ana,
              fullName: "Ana Beatriz",
              email: "ana@example.com",
              accountActivatedAt: null,
              status: "inactive",
            },
          };
        },
      });

      await expectDomainError(
        resendAdminAccountInvitation(adminUser, invitation.id),
        "ACCOUNT_INVITATION_NOT_RESENDABLE",
      );
      setAuthRepositoryForTesting(baseRepository);
    });

    it("bloqueia teacher e student", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "resend-forbidden-hash",
        email: "ana@example.com",
      });

      await expectDomainError(resendAdminAccountInvitation(teacherUser, invitation.id), "FORBIDDEN");
      await expectDomainError(
        resendAdminAccountInvitation({ ...teacherUser, role: "student" }, invitation.id),
        "FORBIDDEN",
      );
    });

    it("realiza SMTP depois da persistência", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "resend-smtp-order-hash",
        email: "ana@example.com",
      });
      let persistedBeforeSmtp = false;
      setAccountInvitationNotifierForTesting({
        kind: "smtp",
        async sendAccountInvitation() {
          persistedBeforeSmtp = getMemoryAccountInvitations()[0]?.invitationType === "admin_reinvite";
        },
      });

      await resendAdminAccountInvitation(adminUser, invitation.id);

      expect(persistedBeforeSmtp).toBe(true);
    });

    it("falha SMTP não desfaz o novo convite e marca estado failed previsto", async () => {
      const invitation = await createInvitation(repository, {
        userId: testUserIds.ana,
        tokenHash: "resend-smtp-fail-hash",
        email: "ana@example.com",
      });
      setAccountInvitationNotifierForTesting({
        kind: "smtp",
        async sendAccountInvitation() {
          throw new Error("smtp unavailable");
        },
      });

      await expect(resendAdminAccountInvitation(adminUser, invitation.id)).rejects.toMatchObject({
        code: "INVITATION_DELIVERY_FAILED",
      });

      expect(getMemoryAccountInvitations()[0]).toEqual(
        expect.objectContaining({
          invitationType: "admin_reinvite",
          deliveryStatus: "failed",
          invalidatedAt: expect.any(String),
        }),
      );
    });
  });

  describe("rotas HTTP", () => {
    describe("GET /api/admin/account-invitations", () => {
      beforeEach(async () => {
        await seedInvitationMatrix();
      });

      it("retorna envelope, defaults e payload seguro para admin", async () => {
        const token = await loginAsAdmin();

        const response = await request(app)
          .get("/api/admin/account-invitations")
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          expect.objectContaining({
            success: true,
            message: "Convites administrativos consultados com sucesso.",
            data: {
              items: expect.any(Array),
            },
            meta: {
              page: 1,
              pageSize: 10,
              total: 5,
              totalPages: 1,
            },
          }),
        );
        expect(response.body.data.items[0]).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            recipientName: expect.any(String),
            recipientEmailMasked: expect.any(String),
            invitationType: expect.any(String),
            deliveryStatus: expect.any(String),
            lifecycleStatus: expect.any(String),
            createdAt: expect.any(String),
            expiresAt: expect.any(String),
          }),
        );
        expect(JSON.stringify(response.body)).not.toContain("tokenHash");
        expect(JSON.stringify(response.body)).not.toContain("userId");
        expect(JSON.stringify(response.body)).not.toContain("invitedByUserId");
        expect(JSON.stringify(response.body)).not.toContain("ana.beatriz@example.com");
      });

      it("aplica paginação customizada", async () => {
        const token = await loginAsAdmin();

        const response = await request(app)
          .get("/api/admin/account-invitations")
          .query({ page: "2", pageSize: "2", sortBy: "recipient", sortOrder: "asc" })
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.meta).toEqual({
          page: 2,
          pageSize: 2,
          total: 5,
          totalPages: 3,
        });
        expect(response.body.data.items.map((item: { recipientName: string }) => item.recipientName)).toEqual([
          "Clara Dias",
          "Diego Lima",
        ]);
      });

      it("filtra por delivery status, lifecycle status e invitation type", async () => {
        const token = await loginAsAdmin();
        const sentResponse = await request(app)
          .get("/api/admin/account-invitations")
          .query({ deliveryStatus: "sent" })
          .set("Authorization", `Bearer ${token}`);
        const expiredResponse = await request(app)
          .get("/api/admin/account-invitations")
          .query({ lifecycleStatus: "expired" })
          .set("Authorization", `Bearer ${token}`);
        const reinviteResponse = await request(app)
          .get("/api/admin/account-invitations")
          .query({ invitationType: "admin_reinvite" })
          .set("Authorization", `Bearer ${token}`);

        expect(sentResponse.status).toBe(200);
        expect(sentResponse.body.data.items).toHaveLength(2);
        expect(expiredResponse.status).toBe(200);
        expect(expiredResponse.body.data.items).toHaveLength(1);
        expect(expiredResponse.body.data.items[0].recipientName).toBe("Clara Dias");
        expect(reinviteResponse.status).toBe(200);
        expect(reinviteResponse.body.data.items).toHaveLength(1);
        expect(reinviteResponse.body.data.items[0].recipientName).toBe("Bruno Costa");
      });

      it("aplica busca e ordenação", async () => {
        const token = await loginAsAdmin();

        const searchResponse = await request(app)
          .get("/api/admin/account-invitations")
          .query({ search: "beatriz" })
          .set("Authorization", `Bearer ${token}`);
        const sortResponse = await request(app)
          .get("/api/admin/account-invitations")
          .query({ sortBy: "recipient", sortOrder: "desc" })
          .set("Authorization", `Bearer ${token}`);

        expect(searchResponse.status).toBe(200);
        expect(searchResponse.body.data.items).toHaveLength(1);
        expect(searchResponse.body.data.items[0].recipientName).toBe("Ana Beatriz");
        expect(sortResponse.status).toBe(200);
        expect(sortResponse.body.data.items.map((item: { recipientName: string }) => item.recipientName)).toEqual([
          "Elisa Martins",
          "Diego Lima",
          "Clara Dias",
          "Bruno Costa",
          "Ana Beatriz",
        ]);
      });

      it("bloqueia perfis teacher, student e requisição sem autenticação", async () => {
        const teacherToken = await loginAsTeacher();
        const studentToken = await loginAsStudent();

        const teacherResponse = await request(app)
          .get("/api/admin/account-invitations")
          .set("Authorization", `Bearer ${teacherToken}`);
        const studentResponse = await request(app)
          .get("/api/admin/account-invitations")
          .set("Authorization", `Bearer ${studentToken}`);
        const anonymousResponse = await request(app).get("/api/admin/account-invitations");

        expect(teacherResponse.status).toBe(403);
        expect(studentResponse.status).toBe(403);
        expect(anonymousResponse.status).toBe(401);
        expect(anonymousResponse.body.error.code).toBe("AUTH_REQUIRED");
      });

      it.each([
        ["page=0", "/api/admin/account-invitations?page=0"],
        ["pageSize=0", "/api/admin/account-invitations?pageSize=0"],
        ["pageSize=51", "/api/admin/account-invitations?pageSize=51"],
        ["page=abc", "/api/admin/account-invitations?page=abc"],
        ["deliveryStatus inválido", "/api/admin/account-invitations?deliveryStatus=SENT"],
        ["sortBy inválido", "/api/admin/account-invitations?sortBy=updatedAt"],
        ["sortOrder inválido", "/api/admin/account-invitations?sortOrder=sideways"],
        ["search acima de 120", `/api/admin/account-invitations?search=${"x".repeat(121)}`],
        ["query repetida", "/api/admin/account-invitations?page=1&page=2"],
        ["query extra", "/api/admin/account-invitations?unknown=value"],
      ])("retorna 400 para %s", async (_caseName, path) => {
        const token = await loginAsAdmin();

        const response = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_ACCOUNT_INVITATION_LIST_QUERY");
        expect(response.body.error.message).toBe("Parâmetros inválidos para consultar convites.");
      }, 10000);
    });

    describe("POST /api/admin/account-invitations/:invitationId/cancel", () => {
      it("permite admin cancelar convite válido com envelope seguro", async () => {
        let sendCount = 0;
        setAccountInvitationNotifierForTesting({
          kind: "smtp",
          async sendAccountInvitation() {
            sendCount += 1;
          },
        });
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-cancel-hash",
          email: "ana@example.com",
        });
        await repository.markAccountInvitationDelivered({
          invitationId: invitation.id,
          deliveredAt: NOW.toISOString(),
          actorName: adminUser.fullName,
          actorRole: adminUser.role,
          note: "Entrega registrada em teste.",
        });
        const auditLogCount = getMemoryAuthAuditLogs().length;

        const response = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/cancel`)
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Convite cancelado com sucesso.",
          data: {
            canceled: true,
          },
        });
        expect(sendCount).toBe(0);
        expect(getMemoryAuthAuditLogs()).toHaveLength(auditLogCount + 1);
        expect(getMemoryAccountInvitations().find((item) => item.id === invitation.id)?.deliveryStatus).toBe("sent");
      });

      it("retorna 409 para segunda tentativa, aceito, expirado, invalidado e inexistente", async () => {
        const token = await loginAsAdmin();
        const validInvitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-double-hash",
          email: "ana@example.com",
        });
        const acceptedInvitation = await createInvitation(repository, {
          userId: testUserIds.bruno,
          tokenHash: "http-accepted-hash",
          email: "bruno@example.com",
        });
        await repository.acceptAccountInvitation({
          tokenHash: "http-accepted-hash",
          passwordHash: "new-hash",
          passwordChangedAt: NOW.toISOString(),
          actorName: "Participante",
          actorRole: "student",
        });
        const expiredInvitation = await createInvitation(repository, {
          userId: testUserIds.clara,
          tokenHash: "http-expired-hash",
          email: "clara@example.com",
          expiresAt: PAST,
        });
        const invalidatedInvitation = await createInvitation(repository, {
          userId: testUserIds.diego,
          tokenHash: "http-invalidated-hash",
          email: "diego@example.com",
        });
        await repository.cancelAccountInvitation({
          invitationId: invalidatedInvitation.id,
          actorName: adminUser.fullName,
          actorRole: adminUser.role,
          now: NOW,
        });

        await request(app)
          .post(`/api/admin/account-invitations/${validInvitation.id}/cancel`)
          .set("Authorization", `Bearer ${token}`)
          .expect(200);

        for (const invitationId of [
          validInvitation.id,
          acceptedInvitation.id,
          expiredInvitation.id,
          invalidatedInvitation.id,
          "missing-invitation",
        ]) {
          const response = await request(app)
            .post(`/api/admin/account-invitations/${invitationId}/cancel`)
            .set("Authorization", `Bearer ${token}`);

          expect(response.status).toBe(409);
          expect(response.body.error.code).toBe("ACCOUNT_INVITATION_NOT_CANCELABLE");
        }
      });

      it("retorna 400 para ID inválido e body inesperado", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-body-hash",
          email: "ana@example.com",
        });

        const invalidIdResponse = await request(app)
          .post(`/api/admin/account-invitations/${"x".repeat(161)}/cancel`)
          .set("Authorization", `Bearer ${token}`);
        const unexpectedBodyResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/cancel`)
          .set("Authorization", `Bearer ${token}`)
          .send({ reason: "teste" });

        expect(invalidIdResponse.status).toBe(400);
        expect(invalidIdResponse.body.error.code).toBe("INVALID_ACCOUNT_INVITATION_CANCEL_INPUT");
        expect(unexpectedBodyResponse.status).toBe(400);
        expect(unexpectedBodyResponse.body.error.code).toBe("INVALID_ACCOUNT_INVITATION_CANCEL_INPUT");
      });

      it("retorna 400 para body null", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-null-body-cancel-hash",
          email: "ana@example.com",
        });

        const response = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/cancel`)
          .set("Authorization", `Bearer ${token}`)
          .set("Content-Type", "application/json")
          .send("null");

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it("bloqueia teacher, student e requisição sem autenticação", async () => {
        const teacherToken = await loginAsTeacher();
        const studentToken = await loginAsStudent();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-forbidden-hash",
          email: "ana@example.com",
        });

        const teacherResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/cancel`)
          .set("Authorization", `Bearer ${teacherToken}`);
        const studentResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/cancel`)
          .set("Authorization", `Bearer ${studentToken}`);
        const anonymousResponse = await request(app).post(
          `/api/admin/account-invitations/${invitation.id}/cancel`,
        );

        expect(teacherResponse.status).toBe(403);
        expect(studentResponse.status).toBe(403);
        expect(anonymousResponse.status).toBe(401);
        expect(anonymousResponse.body.error.code).toBe("AUTH_REQUIRED");
      });

      it("limita tentativas por ator e convite", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-rate-hash",
          email: "ana@example.com",
        });

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const response = await request(app)
            .post(`/api/admin/account-invitations/${invitation.id}/cancel`)
            .set("Authorization", `Bearer ${token}`);

          expect([200, 409]).toContain(response.status);
        }

        const blockedResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/cancel`)
          .set("Authorization", `Bearer ${token}`);

        expect(blockedResponse.status).toBe(429);
        expect(blockedResponse.body.error.code).toBe("ADMIN_INVITATION_CANCEL_RATE_LIMITED");
      });
    });

    describe("POST /api/admin/account-invitations/:invitationId/resend", () => {
      it("permite admin reenviar com body ausente e envelope seguro", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-resend-hash",
          email: "ana@example.com",
        });

        const response = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: "Reenvio de convite processado com sucesso.",
          data: {
            invitation: {
              invitationType: "admin_reinvite",
              deliveryStatus: "sent",
              expiresAt: expect.any(String),
            },
          },
        });
        expect(JSON.stringify(response.body)).not.toContain("token");
        expect(JSON.stringify(response.body)).not.toContain("hash");
        expect(JSON.stringify(response.body)).not.toContain("ativar-conta");
        expect(JSON.stringify(response.body)).not.toContain("userId");
        expect(JSON.stringify(response.body)).not.toContain("ana@example.com");
      });

      it("aceita body vazio", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.bruno,
          tokenHash: "http-resend-empty-body-hash",
          email: "bruno@example.com",
        });

        const response = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.data.invitation.invitationType).toBe("admin_reinvite");
      });

      it("rejeita body inesperado e ID acima de 160", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-resend-invalid-body-hash",
          email: "ana@example.com",
        });

        const unexpectedBodyResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${token}`)
          .send({ reason: "teste" });
        const invalidIdResponse = await request(app)
          .post(`/api/admin/account-invitations/${"x".repeat(161)}/resend`)
          .set("Authorization", `Bearer ${token}`);

        expect(unexpectedBodyResponse.status).toBe(400);
        expect(unexpectedBodyResponse.body.error.code).toBe("INVALID_ACCOUNT_INVITATION_RESEND_INPUT");
        expect(invalidIdResponse.status).toBe(400);
        expect(invalidIdResponse.body.error.code).toBe("INVALID_ACCOUNT_INVITATION_RESEND_INPUT");
      });

      it("retorna 400 para body null", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-null-body-resend-hash",
          email: "ana@example.com",
        });

        const response = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${token}`)
          .set("Content-Type", "application/json")
          .send("null");

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it("bloqueia teacher, student e requisição sem autenticação", async () => {
        const teacherToken = await loginAsTeacher();
        const studentToken = await loginAsStudent();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-resend-forbidden-hash",
          email: "ana@example.com",
        });

        const teacherResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${teacherToken}`);
        const studentResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${studentToken}`);
        const anonymousResponse = await request(app).post(
          `/api/admin/account-invitations/${invitation.id}/resend`,
        );

        expect(teacherResponse.status).toBe(403);
        expect(studentResponse.status).toBe(403);
        expect(anonymousResponse.status).toBe(401);
        expect(anonymousResponse.body.error.code).toBe("AUTH_REQUIRED");
      });

      it("retorna 409 genérico para convite não reenviável", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-resend-accepted-hash",
          email: "ana@example.com",
        });
        await repository.acceptAccountInvitation({
          tokenHash: "http-resend-accepted-hash",
          passwordHash: "new-hash",
          passwordChangedAt: NOW.toISOString(),
          actorName: "Participante",
          actorRole: "student",
        });

        const response = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("ACCOUNT_INVITATION_NOT_RESENDABLE");
        expect(response.body.error.message).toBe("Não foi possível reenviar este convite.");
      });

      it("retorna 429 ao exceder limite por ator e convite", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-resend-rate-hash",
          email: "ana@example.com",
        });

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const response = await request(app)
            .post(`/api/admin/account-invitations/${invitation.id}/resend`)
            .set("Authorization", `Bearer ${token}`);

          expect([200, 409]).toContain(response.status);
        }

        const blockedResponse = await request(app)
          .post(`/api/admin/account-invitations/${invitation.id}/resend`)
          .set("Authorization", `Bearer ${token}`);

        expect(blockedResponse.status).toBe(429);
        expect(blockedResponse.body.error.code).toBe("ADMIN_INVITATION_RESEND_RATE_LIMITED");
      });

      it("mantém apenas o convite mais recente válido em reenvios concorrentes", async () => {
        const token = await loginAsAdmin();
        const invitation = await createInvitation(repository, {
          userId: testUserIds.ana,
          tokenHash: "http-concurrent-resend-hash",
          email: "ana@example.com",
        });

        const responses = await Promise.all([
          request(app)
            .post(`/api/admin/account-invitations/${invitation.id}/resend`)
            .set("Authorization", `Bearer ${token}`),
          request(app)
            .post(`/api/admin/account-invitations/${invitation.id}/resend`)
            .set("Authorization", `Bearer ${token}`),
        ]);
        const responsePayload = JSON.stringify(responses.map((response) => response.body));
        const invitations = getMemoryAccountInvitations().filter(
          (item) => item.userId === testUserIds.ana,
        );
        const activeInvitations = invitations.filter(
          (item) =>
            !item.acceptedAt &&
            !item.invalidatedAt &&
            new Date(item.expiresAt).getTime() > Date.now(),
        );
        const latestInvitation = invitations[0];
        const substitutedInvitations = invitations.slice(1);
        const auditPayload = JSON.stringify(getMemoryAuthAuditLogs());

        expect(responses.map((response) => response.status).sort()).toEqual([200, 200]);
        expect(responsePayload).not.toContain("token");
        expect(responsePayload).not.toContain("tokenHash");
        expect(responsePayload).not.toContain("ativar-conta");
        expect(responsePayload).not.toContain("userId");
        expect(responsePayload).not.toContain("ana@example.com");
        expect(activeInvitations).toHaveLength(1);
        expect(activeInvitations[0].id).toBe(latestInvitation.id);
        expect(latestInvitation.invitationType).toBe("admin_reinvite");
        expect(substitutedInvitations.length).toBeGreaterThanOrEqual(2);
        expect(substitutedInvitations.every((item) => item.invalidatedAt)).toBe(true);
        expect(auditPayload).not.toContain("token");
        expect(auditPayload).not.toContain("hash");
        expect(auditPayload).not.toContain("ativar-conta");
      });

      it("mantém endpoint existente por userId funcionando", async () => {
        const token = await loginAsAdmin();

        const response = await request(app)
          .post(`/api/admin/users/${testUserIds.ana}/send-invitation`)
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.invitation).toEqual(
          expect.objectContaining({
            invitationType: "admin_reinvite",
            deliveryStatus: "sent",
            expiresAt: expect.any(String),
          }),
        );
      });
    });
  });
});
