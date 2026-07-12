import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import {
  resetAuthStore,
  setAuthRepositoryForTesting,
} from "../src/modules/auth/auth.service";
import { createMemoryAuthRepository } from "../src/modules/auth/auth.repository";
import { resetEnrollmentStore } from "../src/modules/enrollments/enrollments.service";

const loginAsTeacher = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "professor.demo@example.com",
    password: "ProfessorDemo@123",
  });

  return response.body.data.token as string;
};

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });

  return response.body.data.token as string;
};

describe("enrollments endpoints", () => {
  beforeEach(() => {
    resetAuthStore();
    resetEnrollmentStore();
  });

  describe("POST /api/enrollments", () => {
    it("cria um cadastro com status pending", async () => {
      const response = await request(app).post("/api/enrollments").send({
        fullName: "Bianca Ferreira",
        email: "bianca.ferreira.demo@example.com",
        whatsapp: "+55 00 90000-0099",
        groupInterest: "Emmanuel",
        alreadyParticipates: "Não",
        message: "Gostaria de conhecer o grupo com tranquilidade.",
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Sua solicitação foi recebida. Os professores revisarão seu cadastro.",
      );
      expect(response.body.data).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          fullName: "Bianca Ferreira",
          email: "bianca.ferreira.demo@example.com",
          whatsapp: "+55 00 90000-0099",
          groupInterest: "Emmanuel",
          alreadyParticipates: "Não",
          status: "pending",
          reviewedAt: null,
          reviewedBy: null,
          teacherNote: "",
        }),
      );
      expect(response.body.data.meetUrl).toBeUndefined();
    });

    it("retorna erro amigavel quando os campos obrigatorios estao invalidos", async () => {
      const response = await request(app).post("/api/enrollments").send({
        fullName: "",
        email: "email-invalido",
        whatsapp: "",
        groupInterest: "",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_ENROLLMENT_INPUT");
      expect(response.body.error.message).toBe("Revise os dados informados para continuar.");
      expect(response.body.error.details).toEqual(
        expect.objectContaining({
          fullName: expect.any(String),
          email: expect.any(String),
          whatsapp: expect.any(String),
          groupInterest: expect.any(String),
        }),
      );
    });
  });

  describe("GET /api/enrollments", () => {
    it("lista os interessados e permite filtrar por status", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .get("/api/enrollments")
        .set("Authorization", `Bearer ${token}`)
        .query({ status: "approved" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.status).toBe("approved");
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(
        response.body.data.every((item: { status: string }) => item.status === "approved"),
      ).toBe(true);
      expect(
        response.body.data.every((item: Record<string, unknown>) => !("meetUrl" in item)),
      ).toBe(true);
    });

    it("permite filtrar por groupInterest", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .get("/api/enrollments")
        .set("Authorization", `Bearer ${token}`)
        .query({ groupInterest: "A Caminho da Luz" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.groupInterest).toBe("A Caminho da Luz");
      expect(
        response.body.data.every(
          (item: { groupInterest: string }) => item.groupInterest === "A Caminho da Luz",
        ),
      ).toBe(true);
    });

    it("retorna erro amigavel para filtro invalido", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .get("/api/enrollments")
        .set("Authorization", `Bearer ${token}`)
        .query({ status: "waiting" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_ENROLLMENT_STATUS");
    });

    it("exige login local para listar interessados", async () => {
      const response = await request(app).get("/api/enrollments");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("GET /api/enrollments/:id", () => {
    it("retorna um cadastro especifico", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .get("/api/enrollments/enrollment-001")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          id: "enrollment-001",
          fullName: "Mariana Souza",
        }),
      );
    });

    it("retorna 404 amigavel quando o cadastro nao existe", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .get("/api/enrollments/enrollment-inexistente")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("ENROLLMENT_NOT_FOUND");
    });
  });

  describe("PATCH /api/enrollments/:id/status", () => {
    it("aprova a inscricao e cria acesso de aluno com senha temporaria", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "approved",
          teacherNote: "Aprovado para acompanhar o proximo encontro.",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          enrollment: expect.objectContaining({
            id: "enrollment-001",
            status: "approved",
            teacherNote: "Aprovado para acompanhar o proximo encontro.",
            reviewedBy: "Professor Demonstrativo",
          }),
          studentAccess: expect.objectContaining({
            email: "mariana.souza.demo@example.com",
            temporaryPassword: expect.any(String),
            mustChangePassword: true,
          }),
        }),
      );
      expect(typeof response.body.data.enrollment.reviewedAt).toBe("string");
      expect(response.body.data.enrollment.passwordHash).toBeUndefined();
      expect(response.body.data.studentAccess.passwordHash).toBeUndefined();
      expect(response.body.data.token).toBeUndefined();

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: response.body.data.studentAccess.email,
        password: response.body.data.studentAccess.temporaryPassword,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.role).toBe("student");
    });

    it("aprovar novamente o mesmo interessado nao duplica o acesso e renova a senha", async () => {
      const token = await loginAsTeacher();
      const firstApproval = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "approved",
        });

      const firstLoginResponse = await request(app).post("/api/auth/login").send({
        email: firstApproval.body.data.studentAccess.email,
        password: firstApproval.body.data.studentAccess.temporaryPassword,
      });

      expect(firstLoginResponse.status).toBe(200);

      const previousToken = firstLoginResponse.body.data.token as string;
      const previousCredentialTimestamp =
        firstLoginResponse.body.data.user.passwordChangedAt;

      const secondApproval = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "approved",
        });

      expect(firstApproval.status).toBe(200);
      expect(secondApproval.status).toBe(200);
      expect(secondApproval.body.data.studentAccess.email).toBe(
        firstApproval.body.data.studentAccess.email,
      );
      expect(secondApproval.body.data.studentAccess.mustChangePassword).toBe(true);
      expect(secondApproval.body.data.studentAccess.temporaryPassword).not.toBe(
        firstApproval.body.data.studentAccess.temporaryPassword,
      );

      const staleTokenResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${previousToken}`);

      expect(staleTokenResponse.status).toBe(401);
      expect(staleTokenResponse.body.error.code).toBe("AUTH_REQUIRED");

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: secondApproval.body.data.studentAccess.email,
        password: secondApproval.body.data.studentAccess.temporaryPassword,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.mustChangePassword).toBe(true);
      expect(loginResponse.body.data.user.passwordChangedAt).toEqual(expect.any(String));
      expect(loginResponse.body.data.user.passwordChangedAt).not.toBe(
        previousCredentialTimestamp,
      );
    }, 10000);

    it("reativa usuario inativo existente ao aprovar a inscricao", async () => {
      const createdEnrollment = await request(app).post("/api/enrollments").send({
        fullName: "Aluno Inativo Demonstrativo",
        email: "aluno.inativo.demo@example.com",
        whatsapp: "+55 00 90000-0111",
        groupInterest: "Emmanuel",
        alreadyParticipates: "Já participei antes",
        message: "Gostaria de retomar os estudos.",
      });

      const token = await loginAsTeacher();
      const response = await request(app)
        .patch(`/api/enrollments/${createdEnrollment.body.data.id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "approved",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.studentAccess).toEqual(
        expect.objectContaining({
          email: "aluno.inativo.demo@example.com",
          mustChangePassword: true,
        }),
      );

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "aluno.inativo.demo@example.com",
        password: response.body.data.studentAccess.temporaryPassword,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.status).toBe("active");
    });

    it("faz rollback da aprovacao quando o provisionamento falha", async () => {
      const baseRepository = createMemoryAuthRepository();

      setAuthRepositoryForTesting({
        async getByEmail(email) {
          return baseRepository.getByEmail(email);
        },
        async getById(id) {
          return baseRepository.getById(id);
        },
        async getSessionById(sessionId) {
          return baseRepository.getSessionById(sessionId);
        },
        async createSession(input) {
          return baseRepository.createSession(input);
        },
        async touchSession(sessionId) {
          return baseRepository.touchSession(sessionId);
        },
        async revokeSession(input) {
          return baseRepository.revokeSession(input);
        },
        async revokeAllSessionsForUser(input) {
          return baseRepository.revokeAllSessionsForUser(input);
        },
        async listSessionsForUser(input) {
          return baseRepository.listSessionsForUser(input);
        },
        async revokeSessionForUser(input) {
          return baseRepository.revokeSessionForUser(input);
        },
        async revokeOtherSessionsForUser(input) {
          return baseRepository.revokeOtherSessionsForUser(input);
        },
        async provisionStudentAccess() {
          throw new Error("Falha simulada no provisionamento");
        },
      async changePassword(input) {
        return baseRepository.changePassword(input);
      },
      async replacePasswordResetToken(input) {
        return baseRepository.replacePasswordResetToken(input);
      },
      async invalidatePasswordResetToken(input) {
        return baseRepository.invalidatePasswordResetToken(input);
      },
      async resetPasswordWithRecoveryToken(input) {
        return baseRepository.resetPasswordWithRecoveryToken(input);
      },
      async resetPasswordByAdmin(input) {
        return baseRepository.resetPasswordByAdmin(input);
      },
      });

      const token = await loginAsTeacher();
      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "approved",
        });

      expect(response.status).toBe(500);

      const enrollmentResponse = await request(app)
        .get("/api/enrollments/enrollment-001")
        .set("Authorization", `Bearer ${token}`);

      expect(enrollmentResponse.status).toBe(200);
      expect(enrollmentResponse.body.data.status).toBe("pending");
    });

    it("rejected nao cria acesso de aluno", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "rejected",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.studentAccess).toBeNull();
    });

    it("needs_contact nao cria acesso de aluno", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "needs_contact",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.studentAccess).toBeNull();
    });

    it("retorna erro amigavel para status invalido", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "pending",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_ENROLLMENT_STATUS");
    });

    it("retorna 404 quando o cadastro nao existe", async () => {
      const token = await loginAsTeacher();
      const response = await request(app)
        .patch("/api/enrollments/enrollment-inexistente/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "rejected",
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("ENROLLMENT_NOT_FOUND");
    });

    it("falha sem token de autenticacao", async () => {
      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .send({
          status: "approved",
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_REQUIRED");
    });

    it("bloqueia visitante autenticado sem papel permitido", async () => {
      const visitorLogin = await request(app).post("/api/auth/login").send({
        email: "aluno.demo@example.com",
        password: "AlunoDemo@123",
      });

      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${visitorLogin.body.data.token}`)
        .send({
          status: "approved",
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("permite aprovacao por admin", async () => {
      const token = await loginAsAdmin();
      const response = await request(app)
        .patch("/api/enrollments/enrollment-001/status")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "approved",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.enrollment.reviewedBy).toBe("Admin Demonstrativo");
      expect(response.body.data.studentAccess).toEqual(
        expect.objectContaining({
          email: "mariana.souza.demo@example.com",
        }),
      );
    });
  });
});
