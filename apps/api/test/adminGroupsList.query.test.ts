import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAdminGroupsAuthRepositoryForTesting } from "../src/modules/admin/groups/service";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import { resetMemoryAuthRepositoryStore, setMemoryStudyGroupsForTesting } from "../src/modules/auth/auth.repository";

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });

  return response.body.data.token as string;
};

describe("admin groups list query", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminGroupsAuthRepositoryForTesting();
    resetMemoryAuthRepositoryStore();
    setMemoryStudyGroupsForTesting([
      { id: "emmanuel", name: "Emmanuel", status: "active" },
      { id: "a-caminho-da-luz", name: "A Caminho da Luz", status: "inactive" },
    ]);
  });

  it("usa active como default", async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .get("/api/admin/groups")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([
      {
        name: "Emmanuel",
        slug: "emmanuel",
        status: "active",
      },
    ]);
  });

  it("aceita status=active, inactive e all", async () => {
    const token = await loginAsAdmin();
    const activeResponse = await request(app)
      .get("/api/admin/groups?status=active")
      .set("Authorization", `Bearer ${token}`);
    const inactiveResponse = await request(app)
      .get("/api/admin/groups?status=inactive")
      .set("Authorization", `Bearer ${token}`);
    const allResponse = await request(app)
      .get("/api/admin/groups?status=all")
      .set("Authorization", `Bearer ${token}`);

    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.data.items).toHaveLength(1);
    expect(inactiveResponse.status).toBe(200);
    expect(inactiveResponse.body.data.items).toHaveLength(1);
    expect(allResponse.status).toBe(200);
    expect(allResponse.body.data.items).toHaveLength(2);
  });

  it.each([
    ["status vazio", "/api/admin/groups?status="],
    ["status com whitespace", "/api/admin/groups?status=%20"],
    ["status inválido", "/api/admin/groups?status=archived"],
    ["query repetida", "/api/admin/groups?status=active&status=inactive"],
    ["query em formato array", "/api/admin/groups?status[]=active"],
    ["query extra", "/api/admin/groups?unknown=value"],
  ])("retorna 400 para %s", async (_label, path) => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ADMIN_GROUPS_QUERY");
  });
});
