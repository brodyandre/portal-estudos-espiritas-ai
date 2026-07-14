import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import { createMemoryAuthRepository, type AuthRepository } from "../src/modules/auth/auth.repository";
import { maskAdminUserEmail } from "../src/modules/admin/users/presenter";
import { resetAuthStore } from "../src/modules/auth/auth.service";

const forbiddenFields = [
  "email",
  "passwordHash",
  "mustChangePassword",
  "tokenHash",
  "token",
  "jwt",
  "ipHash",
  "userAgentSummary",
  "sessionId",
  "authSessions",
  "accountInvitations",
  "auditLog",
  "adminNote",
  "lastLoginAt",
];

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });

  return response.body.data.token as string;
};

const seedResponseUsers = async (repository: AuthRepository) => {
  let nextTimestamp = Date.parse("2026-07-14T11:00:00.000Z");
  const dateNowMock = vi.spyOn(Date, "now").mockImplementation(() => {
    nextTimestamp += 1;
    return nextTimestamp;
  });

  try {
    await repository.prepareInvitedEnrollmentUser({
      enrollmentId: "enrollment-luiz-mask",
      fullName: "Luiz Mascara",
      email: "LUIZ@EXEMPLO.COM",
      whatsapp: "11999999999",
      groupName: "Emmanuel",
      groupSlug: "emmanuel",
      actorName: "Admin Demonstrativo",
      actorRole: "admin",
      passwordHash: "hash",
    });
    await repository.prepareInvitedEnrollmentUser({
      enrollmentId: "enrollment-sem-grupo",
      fullName: "Sem Grupo",
      email: "sem.grupo@example.com",
      whatsapp: "11999999999",
      groupName: null,
      groupSlug: null,
      actorName: "Admin Demonstrativo",
      actorRole: "admin",
      passwordHash: "hash",
    });
    await repository.prepareInvitedEnrollmentUser({
      enrollmentId: "enrollment-grupo-parcial",
      fullName: "Grupo Parcial",
      email: "grupo.parcial@example.com",
      whatsapp: "11999999999",
      groupName: "Grupo Parcial",
      groupSlug: null,
      actorName: "Admin Demonstrativo",
      actorRole: "admin",
      passwordHash: "hash",
    });
  } finally {
    dateNowMock.mockRestore();
  }
};

describe("admin users list response", () => {
  let token: string;

  beforeEach(async () => {
    resetAuthStore();
    await seedResponseUsers(createMemoryAuthRepository());
    token = await loginAsAdmin();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna somente campos publicos permitidos", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .query({ search: "luiz", sortBy: "name", sortOrder: "asc" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const item = response.body.data.items[0];

    expect(Object.keys(item).sort()).toEqual([
      "activationStatus",
      "createdAt",
      "emailMasked",
      "group",
      "id",
      "name",
      "role",
      "status",
    ]);
    for (const field of forbiddenFields) {
      expect(item[field]).toBeUndefined();
    }
  });

  it("serializa data, ativacao e grupo completo", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .query({ search: "luiz" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toEqual(
      expect.objectContaining({
        name: "Luiz Mascara",
        emailMasked: "lu***@exemplo.com",
        activationStatus: "not_activated",
        group: {
          name: "Emmanuel",
          slug: "emmanuel",
        },
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it("retorna activationStatus activated para contas ativadas", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .query({ search: "admin.demo@example.com" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].activationStatus).toBe("activated");
  });

  it("retorna grupo null quando ausente", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .query({ search: "sem.grupo@example.com" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].group).toBeNull();
  });

  it("retorna grupo null quando somente nome ou slug esta persistido", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .query({ search: "grupo.parcial@example.com" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].group).toBeNull();
  });

  it("nao retorna campos sensiveis em nenhum item", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);
    const serialized = JSON.stringify(response.body.data.items);

    expect(response.status).toBe(200);
    for (const forbiddenField of forbiddenFields) {
      expect(serialized).not.toContain(`"${forbiddenField}"`);
    }
    expect(serialized).not.toContain("admin.demo@example.com");
    expect(serialized).not.toContain("LUIZ@EXEMPLO.COM");
  });

  it.each([
    ["luiz@exemplo.com", "lu***@exemplo.com"],
    ["ab@exemplo.com", "ab***@exemplo.com"],
    ["x@exemplo.com", "x***@exemplo.com"],
    ["LUIZ@EXEMPLO.COM", "lu***@exemplo.com"],
    ["entrada inesperada", "*"],
  ])("mascara %s como %s", (email, masked) => {
    expect(maskAdminUserEmail(email)).toBe(masked);
  });
});
