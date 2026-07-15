import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { createMemoryAuthRepository } from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import { resetStudyMeetingsAdminServiceDependenciesForTesting } from "../src/modules/study-meetings/study-meetings.service";
import { resetAuthRateLimitStore } from "../src/security/auth-rate-limit";

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const routes = [
  ["GET", "/api/admin/groups/emmanuel/meetings"],
  ["POST", "/api/admin/groups/emmanuel/meetings"],
  ["GET", "/api/admin/groups/emmanuel/meetings/meeting-future"],
  ["PATCH", "/api/admin/groups/emmanuel/meetings/meeting-future"],
  ["POST", "/api/admin/groups/emmanuel/meetings/meeting-future/cancel"],
] as const;

const sendRoute = (
  method: (typeof routes)[number][0],
  path: string,
  token?: string,
) => {
  const agent =
    method === "GET"
      ? request(app).get(path)
      : method === "PATCH"
        ? request(app).patch(path).send({ title: "Novo titulo" })
        : path.endsWith("/cancel")
          ? request(app).post(path).send({ cancellationReason: "Recesso" })
          : request(app).post(path).send({
              title: "Novo encontro",
              startsAt: "2026-07-25T20:00:00Z",
              endsAt: "2026-07-25T21:00:00Z",
            });

  return token ? agent.set("Authorization", `Bearer ${token}`) : agent;
};

describe("admin study meetings authorization", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAuthRateLimitStore();
    resetStudyMeetingsAdminServiceDependenciesForTesting();
  });

  it.each(routes)("rejeita visitante em %s %s", async (method, path) => {
    const response = await sendRoute(method, path);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it.each([
    ["aluno.demo@example.com", "AlunoDemo@123"],
    ["professor.demo@example.com", "ProfessorDemo@123"],
  ])("rejeita perfil nao admin %s", async (email, password) => {
    const token = await loginAs(email, password);
    const response = await sendRoute("GET", "/api/admin/groups/emmanuel/meetings", token);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("permite admin autenticado nas leituras", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const response = await sendRoute("GET", "/api/admin/groups/emmanuel/meetings", token);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("bloqueia admin com troca obrigatoria de senha antes do service", async () => {
    const repository = createMemoryAuthRepository();
    await repository.resetPasswordByAdmin({
      userId: "user-admin-demo",
      passwordHash: bcrypt.hashSync("AdminDemo@123", 10),
      temporaryPasswordGeneratedAt: "2026-07-14T10:00:00.000Z",
      passwordChangedAt: "2026-07-14T10:00:00.000Z",
      actorName: "Admin Demonstrativo",
      actorRole: "admin",
    });
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const response = await sendRoute("GET", "/api/admin/groups/emmanuel/meetings", token);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("rejeita token invalido", async () => {
    const response = await sendRoute("GET", "/api/admin/groups/emmanuel/meetings", "token-invalido");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });
});
