import bcrypt from "bcryptjs";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import {
  createMemoryAuthRepository,
  getMemoryAccountInvitations,
  getMemoryAuthAuditLogs,
  getMemoryAuthUsersForTesting,
  getMemoryTeacherStudyGroupsForTesting,
  resetMemoryAuthRepositoryStore,
  setMemoryStudyGroupsForTesting,
} from "../src/modules/auth/auth.repository";
import {
  resetAuthStore,
  setAuthRepositoryForTesting,
} from "../src/modules/auth/auth.service";
import {
  listAccountInvitationPreviews,
  resetAccountInvitationNotifier,
} from "../src/modules/auth/account-invitation.notifier";
import {
  resetAdminTeachersAuthRepositoryForTesting,
  setAdminTeachersAuthRepositoryForTesting,
} from "../src/modules/admin/users/teachers.service";
import { resetAuthRateLimitStore } from "../src/security/auth-rate-limit";

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const postTeacher = (token: string | undefined, body: unknown) => {
  const agent = request(app).post("/api/admin/teachers").send(body);
  return token ? agent.set("Authorization", `Bearer ${token}`) : agent;
};

describe("POST /api/admin/teachers", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAuthRateLimitStore();
    resetMemoryAuthRepositoryStore();
    resetAccountInvitationNotifier();
    const repository = createMemoryAuthRepository();
    setAuthRepositoryForTesting(repository);
    setAdminTeachersAuthRepositoryForTesting(repository);
  });

  afterEach(() => {
    resetAuthStore();
    resetAdminTeachersAuthRepositoryForTesting();
    resetAccountInvitationNotifier();
  });

  it("exige ADMIN autenticado", async () => {
    const studentToken = await loginAs("aluno.demo@example.com", "AlunoDemo@123");

    const anonymous = await postTeacher(undefined, {
      fullName: "Professor Teste",
      email: "professor.novo@example.invalid",
      groupIds: ["emmanuel"],
    });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("AUTH_REQUIRED");

    const forbidden = await postTeacher(studentToken, {
      fullName: "Professor Teste",
      email: "professor.novo@example.invalid",
      groupIds: ["emmanuel"],
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  it("rejeita payload invalido, campos extras e grupos duplicados", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    for (const body of [
      {},
      { fullName: "Professor", email: "invalido", groupIds: ["emmanuel"] },
      { fullName: "Professor", email: "professor.novo@example.invalid", groupIds: [] },
      { fullName: "Professor", email: "professor.novo@example.invalid", groupIds: ["emmanuel", "emmanuel"] },
      {
        fullName: "Professor",
        email: "professor.novo@example.invalid",
        groupIds: ["emmanuel"],
        role: "admin",
      },
      {
        fullName: "Professor",
        email: "professor.novo@example.invalid",
        groupIds: ["emmanuel"],
        password: "Senha@123",
      },
    ]) {
      const response = await postTeacher(token, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_ADMIN_TEACHER_INPUT");
    }
  });

  it("falha fechado para grupo inexistente, inativo e livro indisponivel", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const missing = await postTeacher(token, {
      fullName: "Professor Teste",
      email: "professor.missing@example.invalid",
      groupIds: ["fantasma"],
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("ADMIN_PEDAGOGICAL_GROUP_NOT_FOUND");

    setMemoryStudyGroupsForTesting([
      { id: "emmanuel", name: "Emmanuel", status: "inactive" },
    ]);
    const inactive = await postTeacher(token, {
      fullName: "Professor Teste",
      email: "professor.inactive@example.invalid",
      groupIds: ["emmanuel"],
    });
    expect(inactive.status).toBe(409);
    expect(inactive.body.error.code).toBe("ADMIN_PEDAGOGICAL_GROUP_INACTIVE");

    setMemoryStudyGroupsForTesting([
      { id: "emmanuel", name: "Emmanuel", status: "active", knowledgeBook: null },
    ]);
    const withoutBook = await postTeacher(token, {
      fullName: "Professor Teste",
      email: "professor.bookless@example.invalid",
      groupIds: ["emmanuel"],
    });
    expect(withoutBook.status).toBe(503);
    expect(withoutBook.body.error.code).toBe("ADMIN_PEDAGOGICAL_BOOK_ACCESS_UNAVAILABLE");
  });

  it("rejeita email existente sem promover ou sobrescrever usuario", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await postTeacher(token, {
      fullName: "Outro Nome",
      email: "ALUNO.DEMO@example.com",
      groupIds: ["emmanuel"],
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ADMIN_TEACHER_EMAIL_CONFLICT");
    expect(getMemoryAuthUsersForTesting().find((user) => user.email === "aluno.demo@example.com")?.role).toBe("student");
  });

  it("cria professor ativo nao ativado, com grupos exatos, auditoria e sem convite automatico", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");

    const response = await postTeacher(token, {
      fullName: "  Professor Sintetico  ",
      email: "PROFESSOR.SINTETICO@example.invalid",
      groupIds: ["emmanuel", "a-caminho-da-luz"],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        fullName: "Professor Sintetico",
        role: "teacher",
        status: "active",
        accountActivated: false,
      }),
    );
    expect(response.body.data.user).not.toHaveProperty("password");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.user).not.toHaveProperty("token");
    expect(response.body.data.groups.map((group: { slug: string }) => group.slug)).toEqual([
      "a-caminho-da-luz",
      "emmanuel",
    ]);

    const createdUser = getMemoryAuthUsersForTesting().find(
      (user) => user.email === "professor.sintetico@example.invalid",
    );
    expect(createdUser).toEqual(
      expect.objectContaining({
        role: "teacher",
        status: "active",
        accountActivatedAt: null,
        groupName: null,
        groupSlug: null,
        enrollmentId: null,
        mustChangePassword: false,
        temporaryPasswordGeneratedAt: null,
        passwordChangedAt: null,
      }),
    );
    expect(createdUser?.passwordHash).toBeTruthy();
    expect(await bcrypt.compare("ProfessorSintetico@123", createdUser?.passwordHash ?? "")).toBe(false);
    expect(getMemoryTeacherStudyGroupsForTesting().filter((item) => item.userId === createdUser?.id)).toEqual([
      { userId: createdUser?.id, groupId: "a-caminho-da-luz" },
      { userId: createdUser?.id, groupId: "emmanuel" },
    ]);
    expect(getMemoryAuthAuditLogs()[0]).toEqual(
      expect.objectContaining({
        action: "Professor criado por admin",
        entity: `User ${createdUser?.id}`,
      }),
    );
    expect(getMemoryAccountInvitations()).toHaveLength(0);
    expect(listAccountInvitationPreviews()).toHaveLength(0);
  });

  it("reutiliza o fluxo existente de convite e preserva role/grupos ao ativar", async () => {
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    const created = await postTeacher(token, {
      fullName: "Professor Convite",
      email: "professor.convite@example.invalid",
      groupIds: ["emmanuel"],
    });
    const userId = created.body.data.user.id as string;

    const invitation = await request(app)
      .post(`/api/admin/users/${userId}/send-invitation`)
      .set("Authorization", `Bearer ${token}`);
    expect(invitation.status).toBe(200);
    expect(getMemoryAccountInvitations()).toHaveLength(1);

    const preview = listAccountInvitationPreviews()[0];
    expect(preview?.token).toBeTruthy();

    const accepted = await request(app).post("/api/auth/accept-invitation").send({
      token: preview.token,
      password: "ProfessorConvite@123",
      confirmPassword: "ProfessorConvite@123",
    });
    expect(accepted.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({
      email: "professor.convite@example.invalid",
      password: "ProfessorConvite@123",
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe("teacher");

    const activatedUser = getMemoryAuthUsersForTesting().find((user) => user.id === userId);
    expect(activatedUser?.accountActivatedAt).toBeTruthy();
    expect(getMemoryTeacherStudyGroupsForTesting()).toContainEqual({
      userId,
      groupId: "emmanuel",
    });
  });
});
