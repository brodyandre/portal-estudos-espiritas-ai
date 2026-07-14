import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import {
  resetAdminUsersAuthRepositoryForTesting,
  setAdminUsersAuthRepositoryForTesting,
} from "../src/modules/admin/users/service";
import {
  createMemoryAuthRepository,
  getMemoryAuthAuditLogs,
  getMemoryAuthSessions,
} from "../src/modules/auth/auth.repository";
import type { StoredAuthUser } from "../src/modules/auth/auth.types";
import { resetAuthStore, setAuthRepositoryForTesting } from "../src/modules/auth/auth.service";
import { setAuthRateLimitNowProviderForTesting } from "../src/security/auth-rate-limit";

const loginAs = async (email: string, password: string) => {
  return request(app).post("/api/auth/login").send({ email, password });
};

const loginAsAdmin = async () => {
  const response = await loginAs("admin.demo@example.com", "AdminDemo@123");
  return response.body.data.token as string;
};

const useRealMemoryRepository = () => {
  const repository = createMemoryAuthRepository();
  setAuthRepositoryForTesting(repository);
  setAdminUsersAuthRepositoryForTesting(repository);
  return repository;
};

const getMutableUser = async (repository: ReturnType<typeof createMemoryAuthRepository>, userId: string) => {
  const user = await repository.getById(userId);

  if (!user) {
    throw new Error(`Usuário não encontrado no harness em memória: ${userId}`);
  }

  return user as StoredAuthUser;
};

const cloneStoredUserSnapshot = (user: StoredAuthUser) => ({
  ...user,
});

const getStatusAuditLogCount = () =>
  getMemoryAuthAuditLogs().filter((entry) => entry.action === "Status de usuário alterado por admin").length;

describe("admin user status rules", () => {
  let currentTime = 0;

  beforeEach(() => {
    currentTime = 0;
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
    setAuthRateLimitNowProviderForTesting(() => currentTime);
  });

  afterEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  it("inativa usuario ativo, revoga sessoes e audita a operação", async () => {
    const adminToken = await loginAsAdmin();
    const firstLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const secondLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    const firstToken = firstLogin.body.data.token as string;
    const secondToken = secondLogin.body.data.token as string;

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      user: {
        id: "user-aluno-demo",
        status: "inactive",
      },
      revokedSessions: 2,
    });

    const sessions = getMemoryAuthSessions().filter((session) => session.userId === "user-aluno-demo");
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.revokedAt)).toBe(true);

    const staleFirst = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${firstToken}`);
    const staleSecond = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${secondToken}`);
    expect(staleFirst.status).toBe(401);
    expect(staleSecond.status).toBe(401);

    const auditLogs = getMemoryAuthAuditLogs();
    expect(auditLogs[0]).toEqual(
      expect.objectContaining({
        action: "Status de usuário alterado por admin",
        entity: "User user-aluno-demo",
      }),
    );
    expect(auditLogs[0]?.note).toContain("Status alterado de active para inactive.");
    expect(auditLogs[0]?.note).toContain("2 sessoes revogadas.");
  });

  it("reativa usuario inativo sem restaurar sessoes antigas", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-inativo-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "active" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      user: {
        id: "user-aluno-inativo-demo",
        status: "active",
      },
      revokedSessions: 0,
    });

    const loginResponse = await loginAs("aluno.inativo.demo@example.com", "AlunoInativo@123");
    expect(loginResponse.status).toBe(200);
  });

  it("bloqueia autoinativacao", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-admin-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ADMIN_USER_SELF_DEACTIVATION_NOT_ALLOWED");
  });

  it("retorna conflito para estado ja aplicado", async () => {
    const adminToken = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-inativo-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ADMIN_USER_STATUS_ALREADY_SET");
  });

  it.each([
    ["pending", "active"],
    ["pending", "inactive"],
    ["rejected", "active"],
    ["rejected", "inactive"],
  ] as const)(
    "bloqueia transicao real de %s para %s sem alterar estado persistido",
    async (currentStatus, nextStatus) => {
      const repository = useRealMemoryRepository();
      const targetUser = await getMutableUser(repository, "user-aluno-demo");
      targetUser.status = currentStatus;

      const beforeSnapshot = cloneStoredUserSnapshot(targetUser);
      const auditCountBefore = getStatusAuditLogCount();
      const targetSessionsBefore = getMemoryAuthSessions().filter(
        (session) => session.userId === targetUser.id,
      );

      const adminToken = await loginAsAdmin();
      const response = await request(app)
        .patch(`/api/admin/users/${targetUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: nextStatus });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("ADMIN_USER_STATUS_TRANSITION_NOT_ALLOWED");

      const afterSnapshot = cloneStoredUserSnapshot(await getMutableUser(repository, targetUser.id));
      const targetSessionsAfter = getMemoryAuthSessions().filter(
        (session) => session.userId === targetUser.id,
      );

      expect(afterSnapshot).toEqual(beforeSnapshot);
      expect(targetSessionsBefore).toHaveLength(0);
      expect(targetSessionsAfter).toHaveLength(0);
      expect(getStatusAuditLogCount()).toBe(auditCountBefore);
    },
  );

  it("bloqueia reativacao real de conta nunca ativada sem alterar o usuario", async () => {
    const repository = useRealMemoryRepository();
    const targetUser = await getMutableUser(repository, "user-aluno-inativo-demo");
    targetUser.accountActivatedAt = null;

    const beforeSnapshot = cloneStoredUserSnapshot(targetUser);
    const auditCountBefore = getStatusAuditLogCount();
    const targetSessionsBefore = getMemoryAuthSessions().filter(
      (session) => session.userId === targetUser.id,
    );

    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .patch(`/api/admin/users/${targetUser.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "active" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ADMIN_USER_ACCOUNT_NOT_ACTIVATED");

    const afterSnapshot = cloneStoredUserSnapshot(await getMutableUser(repository, targetUser.id));
    const targetSessionsAfter = getMemoryAuthSessions().filter(
      (session) => session.userId === targetUser.id,
    );

    expect(afterSnapshot).toEqual(beforeSnapshot);
    expect(targetSessionsBefore).toHaveLength(0);
    expect(targetSessionsAfter).toHaveLength(0);
    expect(getStatusAuditLogCount()).toBe(auditCountBefore);
  });

  it("nao conta admin ativo sem accountActivatedAt como autenticavel", async () => {
    const repository = useRealMemoryRepository();
    const targetAdmin = await getMutableUser(repository, "user-professor-demo");
    targetAdmin.role = "admin";
    targetAdmin.status = "active";
    targetAdmin.accountActivatedAt = "2026-07-12T09:00:00.000Z";

    const nonAuthenticatableAdmin = await getMutableUser(repository, "user-aluno-demo");
    nonAuthenticatableAdmin.role = "admin";
    nonAuthenticatableAdmin.status = "active";
    nonAuthenticatableAdmin.accountActivatedAt = null;

    const targetLogin = await loginAs("professor.demo@example.com", "ProfessorDemo@123");
    const targetToken = targetLogin.body.data.token as string;
    const actorToken = await loginAsAdmin();

    const response = await request(app)
      .patch(`/api/admin/users/${targetAdmin.id}/status`)
      .set("Authorization", `Bearer ${actorToken}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      user: {
        id: targetAdmin.id,
        status: "inactive",
      },
      revokedSessions: 1,
    });

    const persistedTarget = await getMutableUser(repository, targetAdmin.id);
    const persistedNonAuthenticatableAdmin = await getMutableUser(repository, nonAuthenticatableAdmin.id);
    const targetTokenAfter = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${targetToken}`);

    expect(persistedTarget.role).toBe("admin");
    expect(persistedTarget.status).toBe("inactive");
    expect(persistedTarget.accountActivatedAt).toBe("2026-07-12T09:00:00.000Z");
    expect(persistedNonAuthenticatableAdmin.role).toBe("admin");
    expect(persistedNonAuthenticatableAdmin.status).toBe("active");
    expect(persistedNonAuthenticatableAdmin.accountActivatedAt).toBeNull();
    expect(targetTokenAfter.status).toBe(401);
    expect(targetTokenAfter.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("mantem estado estável quando a operação falha antes da persistência", async () => {
    const baseRepository = createMemoryAuthRepository();

    setAuthRepositoryForTesting({
      ...baseRepository,
      async updateAdminUserStatus() {
        throw new Error("Falha simulada durante auditoria");
      },
    });
    setAdminUsersAuthRepositoryForTesting({
      ...baseRepository,
      async updateAdminUserStatus() {
        throw new Error("Falha simulada durante auditoria");
      },
    });

    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(500);

    const loginResponse = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    expect(loginResponse.status).toBe(200);
  });

  it("aplica rate limit administrativo por alvo", async () => {
    const baseRepository = createMemoryAuthRepository();
    const repository = {
      ...baseRepository,
      async updateAdminUserStatus() {
        return { status: "already_set", currentStatus: "inactive" } as const;
      },
    };
    setAuthRepositoryForTesting(repository);
    setAdminUsersAuthRepositoryForTesting(repository);

    const adminToken = await loginAsAdmin();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .patch("/api/admin/users/user-aluno-demo/status")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "inactive" });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("ADMIN_USER_STATUS_ALREADY_SET");
      currentTime += 1_000;
    }

    const rateLimitedResponse = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "inactive" });

    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.body.error.code).toBe("ADMIN_USER_STATUS_RATE_LIMITED");
  });
});
