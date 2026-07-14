import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import {
  resetAdminUsersAuthRepositoryForTesting,
  setAdminUsersAuthRepositoryForTesting,
} from "../src/modules/admin/users/service";
import { createMemoryAuthRepository } from "../src/modules/auth/auth.repository";
import { resetAuthStore, setAuthRepositoryForTesting } from "../src/modules/auth/auth.service";

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });

  return response.body.data.token as string;
};

const expectStatusConflict = async (
  repositoryResponse:
    | { status: "actor_not_authorized" }
    | { status: "not_found" }
    | { status: "transition_not_allowed"; currentStatus: "pending" | "rejected" | "active" | "inactive" }
    | { status: "account_not_activated" }
    | { status: "conflict" },
  expectedHttpStatus: number,
  expectedCode: string,
) => {
  const baseRepository = createMemoryAuthRepository();
  const repository = {
    ...baseRepository,
    async updateAdminUserStatus() {
      return repositoryResponse;
    },
  };
  setAuthRepositoryForTesting(repository);
  setAdminUsersAuthRepositoryForTesting(repository);

  const adminToken = await loginAsAdmin();
  const response = await request(app)
    .patch("/api/admin/users/user-aluno-demo/status")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "inactive" });

  expect(response.status).toBe(expectedHttpStatus);
  expect(response.body.error.code).toBe(expectedCode);
};

describe("admin user status repository responses", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  it("converte ator não autorizado em 403", async () => {
    await expectStatusConflict(
      { status: "actor_not_authorized" },
      403,
      "ADMIN_USER_STATUS_ACTOR_NOT_AUTHORIZED",
    );
  });

  it("converte usuário inexistente em 404", async () => {
    await expectStatusConflict(
      { status: "not_found" },
      404,
      "ADMIN_USER_NOT_FOUND",
    );
  });

  it("converte transição não permitida em 409", async () => {
    await expectStatusConflict(
      { status: "transition_not_allowed", currentStatus: "pending" },
      409,
      "ADMIN_USER_STATUS_TRANSITION_NOT_ALLOWED",
    );
  });

  it("converte conta nunca ativada em 409", async () => {
    await expectStatusConflict(
      { status: "account_not_activated" },
      409,
      "ADMIN_USER_ACCOUNT_NOT_ACTIVATED",
    );
  });

  it("converte conflito concorrente em 409", async () => {
    await expectStatusConflict(
      { status: "conflict" },
      409,
      "ADMIN_USER_STATUS_CONFLICT",
    );
  });
});
