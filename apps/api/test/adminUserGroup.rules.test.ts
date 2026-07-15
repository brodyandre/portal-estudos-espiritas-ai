import request from "supertest";
import type { Response } from "supertest";
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
  setMemoryStudyGroupsForTesting,
} from "../src/modules/auth/auth.repository";
import type { StoredAuthUser } from "../src/modules/auth/auth.types";
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

const getMutableUser = async (repository: ReturnType<typeof createMemoryAuthRepository>, userId: string) => {
  const user = await repository.getById(userId);

  if (!user) {
    throw new Error(`Usuário não encontrado no harness em memória: ${userId}`);
  }

  return user as StoredAuthUser;
};

describe("admin user group rules", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  afterEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  it("associa usuario sem grupo, usa nome canonico, preserva contrato e audita", async () => {
    const repository = useRealMemoryRepository();
    const token = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "  emmanuel  " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Grupo do usuário atualizado com sucesso.",
      data: {
        user: {
          id: "user-aluno-demo",
          group: {
            name: "Emmanuel",
            slug: "emmanuel",
          },
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("email");
    expect(JSON.stringify(response.body)).not.toContain("password");
    expect(JSON.stringify(response.body)).not.toContain("token");

    const user = await getMutableUser(repository, "user-aluno-demo");
    expect(user.groupName).toBe("Emmanuel");
    expect(user.groupSlug).toBe("emmanuel");
    expect(user.status).toBe("active");
    expect(user.mustChangePassword).toBe(false);
    expect(getMemoryAuthSessions().filter((session) => session.userId === "user-aluno-demo")).toEqual([]);

    expect(getMemoryAuthAuditLogs()[0]).toEqual(
      expect.objectContaining({
        action: "Grupo de usuário alterado por admin",
        entity: "User user-aluno-demo",
      }),
    );
    expect(getMemoryAuthAuditLogs()[0]?.note).toContain("sem grupo");
    expect(getMemoryAuthAuditLogs()[0]?.note).toContain("emmanuel");
  });

  it("substitui o grupo atual", async () => {
    const repository = useRealMemoryRepository();
    const target = await getMutableUser(repository, "user-aluno-demo");
    target.groupName = "Emmanuel";
    target.groupSlug = "emmanuel";
    const token = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "a-caminho-da-luz" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.group).toEqual({
      name: "A Caminho da Luz",
      slug: "a-caminho-da-luz",
    });
    expect(target.groupName).toBe("A Caminho da Luz");
    expect(target.groupSlug).toBe("a-caminho-da-luz");
  });

  it("remove vinculo existente", async () => {
    const repository = useRealMemoryRepository();
    const target = await getMutableUser(repository, "user-aluno-demo");
    target.groupName = "Emmanuel";
    target.groupSlug = "emmanuel";
    const token = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: null });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      user: {
        id: "user-aluno-demo",
        group: null,
      },
    });
    expect(target.groupName).toBeNull();
    expect(target.groupSlug).toBeNull();
  });

  it("corrige estado parcial por associacao e por remocao", async () => {
    const repository = useRealMemoryRepository();
    const target = await getMutableUser(repository, "user-aluno-demo");
    const token = await loginAsAdmin();

    target.groupName = "Emmanuel";
    target.groupSlug = null;
    const associateResponse = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "emmanuel" });

    expect(associateResponse.status).toBe(200);
    expect(target.groupName).toBe("Emmanuel");
    expect(target.groupSlug).toBe("emmanuel");

    target.groupName = null;
    target.groupSlug = "emmanuel";
    const removeResponse = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: null });

    expect(removeResponse.status).toBe(200);
    expect(target.groupName).toBeNull();
    expect(target.groupSlug).toBeNull();
  });

  it("rejeita mesmo grupo integralmente associado", async () => {
    const repository = useRealMemoryRepository();
    const target = await getMutableUser(repository, "user-aluno-demo");
    target.groupName = "Emmanuel";
    target.groupSlug = "emmanuel";
    const token = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "emmanuel" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ADMIN_USER_GROUP_ALREADY_SET");
  });

  it("rejeita remocao quando nao existe vinculo", async () => {
    const token = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: null });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ADMIN_USER_GROUP_ALREADY_EMPTY");
  });

  it("rejeita usuario inexistente, grupo inexistente e grupo inativo", async () => {
    useRealMemoryRepository();
    setMemoryStudyGroupsForTesting([
      { id: "emmanuel", name: "Emmanuel", status: "active" },
      { id: "grupo-inativo", name: "Grupo Inativo", status: "inactive" },
    ]);
    const token = await loginAsAdmin();

    const missingUser = await request(app)
      .patch("/api/admin/users/user-inexistente/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "emmanuel" });
    expect(missingUser.status).toBe(404);
    expect(missingUser.body.error.code).toBe("ADMIN_USER_NOT_FOUND");

    const missingGroup = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "grupo-inexistente" });
    expect(missingGroup.status).toBe(404);
    expect(missingGroup.body.error.code).toBe("ADMIN_USER_GROUP_NOT_FOUND");

    const inactiveGroup = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "grupo-inativo" });
    expect(inactiveGroup.status).toBe(409);
    expect(inactiveGroup.body.error.code).toBe("ADMIN_USER_GROUP_INACTIVE");
  });

  it("permite alterar vinculo de usuario inativo sem ativar conta", async () => {
    const repository = useRealMemoryRepository();
    const target = await getMutableUser(repository, "user-aluno-inativo-demo");
    const token = await loginAsAdmin();

    const response = await request(app)
      .patch("/api/admin/users/user-aluno-inativo-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "emmanuel" });

    expect(response.status).toBe(200);
    expect(target.groupName).toBe("Emmanuel");
    expect(target.groupSlug).toBe("emmanuel");
    expect(target.status).toBe("inactive");

    const loginResponse = await loginAs("aluno.inativo.demo@example.com", "AlunoInativo@123");
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.error.code).toBe("USER_INACTIVE");
  });

  it("aplica rate limit estruturado para tentativas repetidas", async () => {
    useRealMemoryRepository();
    const token = await loginAsAdmin();
    let response: Response | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await request(app)
        .patch("/api/admin/users/user-aluno-demo/group")
        .set("Authorization", `Bearer ${token}`)
        .send({ groupSlug: "grupo-inexistente" });
    }

    expect(response?.status).toBe(429);
    expect(response?.body.error.code).toBe("ADMIN_USER_GROUP_RATE_LIMITED");
    expect(response?.body.error.details.retryAfterSeconds).toEqual(expect.any(Number));
    expect(response?.headers["retry-after"]).toEqual(expect.any(String));
  });
});
