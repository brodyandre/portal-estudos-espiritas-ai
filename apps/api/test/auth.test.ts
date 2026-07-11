import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import { resetEnrollmentStore } from "../src/modules/enrollments/enrollments.service";

describe("auth endpoints", () => {
  beforeEach(() => {
    resetAuthStore();
    resetEnrollmentStore();
  });

  it("faz login local com sucesso", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin.demo@example.com",
      password: "AdminDemo@123",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        email: "admin.demo@example.com",
        role: "admin",
        status: "active",
      }),
    );
  });

  it("retorna erro seguro para senha invalida", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin.demo@example.com",
      password: "senha-incorreta",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("retorna erro seguro para usuario inexistente", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "nao.existe@example.com",
      password: "Senha@123",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("bloqueia usuario inativo", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "aluno.inativo.demo@example.com",
      password: "AlunoInativo@123",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("USER_INACTIVE");
  });

  it("retorna /me com token valido", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "professor.demo@example.com",
      password: "ProfessorDemo@123",
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        email: "professor.demo@example.com",
        role: "teacher",
      }),
    );
  });

  it("bloqueia /me sem token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });
});
