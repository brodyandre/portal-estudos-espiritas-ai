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

describe("admin user group input", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminUsersAuthRepositoryForTesting();
  });

  it.each([
    ["body ausente", undefined],
    ["body null", null],
    ["body array", []],
    ["objeto vazio", {}],
    ["campo ausente", { value: "emmanuel" }],
    ["campo extra", { groupSlug: "emmanuel", extra: true }],
    ["groupSlug vazio", { groupSlug: "" }],
    ["groupSlug em branco", { groupSlug: "   " }],
    ["groupSlug numerico", { groupSlug: 123 }],
    ["groupSlug booleano", { groupSlug: true }],
    ["groupSlug array", { groupSlug: ["emmanuel"] }],
  ])("rejeita %s", async (_label, body) => {
    const token = await loginAsAdmin();
    let requestBuilder = request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`);

    if (body !== undefined) {
      requestBuilder = requestBuilder.send(body);
    }

    const response = await requestBuilder;

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_GROUP_INPUT");
  });

  it("aceita groupSlug null como entrada valida para remocao", async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .patch("/api/admin/users/user-aluno-demo/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: null });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ADMIN_USER_GROUP_ALREADY_EMPTY");
  });

  it("rejeita path param vazio ou invalido", async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .patch("/api/admin/users/%20/group")
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "emmanuel" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_GROUP_INPUT");
  });

  it("rejeita path param acima do limite", async () => {
    const token = await loginAsAdmin();
    const invalidId = "u".repeat(161);
    const response = await request(app)
      .patch(`/api/admin/users/${invalidId}/group`)
      .set("Authorization", `Bearer ${token}`)
      .send({ groupSlug: "emmanuel" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_USER_GROUP_INPUT");
  });
});
