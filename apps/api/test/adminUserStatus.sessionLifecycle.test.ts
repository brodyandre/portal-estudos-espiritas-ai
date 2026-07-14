import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAdminUsersAuthRepositoryForTesting, setAdminUsersAuthRepositoryForTesting } from "../src/modules/admin/users/service";
import { createMemoryAuthRepository, getMemoryAuthSessions } from "../src/modules/auth/auth.repository";
import { resetAuthStore, setAuthRepositoryForTesting } from "../src/modules/auth/auth.service";

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

describe("admin user status session lifecycle", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  afterEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  it("mantem o token antigo revogado mesmo depois da reativacao", async () => {
    useRealMemoryRepository();

    const firstLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    expect(firstLogin.status).toBe(200);
    const originalToken = firstLogin.body.data.token as string;

    const protectedBefore = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${originalToken}`);
    expect(protectedBefore.status).toBe(200);

    const originalSessions = getMemoryAuthSessions().filter((session) => session.userId === "user-aluno-demo");
    expect(originalSessions).toHaveLength(1);
    const [originalSession] = originalSessions;
    expect(originalSession?.revokedAt).toBeNull();

    const adminToken = await loginAsAdmin();

    const deactivateResponse = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "inactive" });

    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.data.revokedSessions).toBe(1);

    const oldTokenAfterDeactivation = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${originalToken}`);
    expect(oldTokenAfterDeactivation.status).toBe(401);
    expect(oldTokenAfterDeactivation.body.error.code).toBe("AUTH_REQUIRED");

    const sessionsAfterDeactivation = getMemoryAuthSessions().filter(
      (session) => session.userId === "user-aluno-demo",
    );
    expect(sessionsAfterDeactivation).toHaveLength(1);
    expect(sessionsAfterDeactivation[0]?.id).toBe(originalSession?.id);
    expect(sessionsAfterDeactivation[0]?.revokedAt).toEqual(expect.any(String));

    const reactivateResponse = await request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "active" });

    expect(reactivateResponse.status).toBe(200);
    expect(reactivateResponse.body.data).toEqual({
      user: {
        id: "user-aluno-demo",
        status: "active",
      },
      revokedSessions: 0,
    });

    const sessionsAfterReactivation = getMemoryAuthSessions().filter(
      (session) => session.userId === "user-aluno-demo",
    );
    expect(sessionsAfterReactivation).toHaveLength(1);
    expect(sessionsAfterReactivation[0]?.id).toBe(originalSession?.id);
    expect(sessionsAfterReactivation[0]?.revokedAt).toEqual(expect.any(String));

    const oldTokenAfterReactivation = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${originalToken}`);
    expect(oldTokenAfterReactivation.status).toBe(401);
    expect(oldTokenAfterReactivation.body.error.code).toBe("AUTH_REQUIRED");

    const secondLogin = await loginAs("aluno.demo@example.com", "AlunoDemo@123");
    expect(secondLogin.status).toBe(200);
    const newToken = secondLogin.body.data.token as string;

    const protectedAfterNewLogin = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${newToken}`);
    expect(protectedAfterNewLogin.status).toBe(200);

    const finalSessions = getMemoryAuthSessions().filter((session) => session.userId === "user-aluno-demo");
    expect(finalSessions).toHaveLength(2);
    expect(finalSessions.find((session) => session.id === originalSession?.id)?.revokedAt).toEqual(
      expect.any(String),
    );
    expect(
      finalSessions.filter((session) => session.id !== originalSession?.id && session.revokedAt === null),
    ).toHaveLength(1);
  });
});
