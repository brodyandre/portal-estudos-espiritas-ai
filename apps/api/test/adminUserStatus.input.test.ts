import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAdminUsersAuthRepositoryForTesting } from "../src/modules/admin/users/service";
import { resetAuthStore } from "../src/modules/auth/auth.service";

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });

  return response.body.data.token as string;
};

describe("admin user status input", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  it.each([
    ["body ausente", undefined],
    ["body null", null],
    ["body array", []],
    ["objeto vazio", {}],
    ["status ausente", { value: "inactive" }],
    ["status invalido", { status: "pending" }],
    ["status em caixa errada", { status: "INACTIVE" }],
    ["campo extra", { status: "inactive", extra: true }],
  ])("rejeita %s", async (_label, body) => {
    const token = await loginAsAdmin();
    let requestBuilder = request(app)
      .patch("/api/admin/users/user-aluno-demo/status")
      .set("Authorization", `Bearer ${token}`);

    if (body !== undefined) {
      requestBuilder = requestBuilder.send(body);
    }

    const response = await requestBuilder;

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_STATUS_INPUT");
  });

  it("rejeita path param vazio ou invalido", async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .patch("/api/admin/users/%20/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_STATUS_INPUT");
  });

  it("rejeita path param acima do limite", async () => {
    const token = await loginAsAdmin();
    const invalidId = "u".repeat(161);
    const response = await request(app)
      .patch(`/api/admin/users/${invalidId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_STATUS_INPUT");
  });
});
