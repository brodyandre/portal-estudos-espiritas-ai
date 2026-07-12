import bcrypt from "bcryptjs";
import {
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
  type Prisma,
  type User as PrismaUser,
} from "@prisma/client";

import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import { getRolePermissions } from "../../auth/roles";
import type { UserRole, UserStatus } from "../../auth/types";
import type {
  AuthUser,
  StoredAuthUser,
  StudentAccessProvisionInput,
  StudentAccessProvisionResult,
} from "./auth.types";

export interface AuthRepository {
  getByEmail(email: string): Promise<StoredAuthUser | null>;
  getById(id: string): Promise<StoredAuthUser | null>;
  provisionStudentAccess(input: StudentAccessProvisionInput): Promise<StudentAccessProvisionResult>;
}

type StudentAccessPersistenceClient = Pick<Prisma.TransactionClient, "user" | "auditLog">;

const prismaRoleToRole: Record<PrismaUserRole, UserRole> = {
  ADMIN: "admin",
  STUDENT: "student",
  TEACHER: "teacher",
  VISITOR: "visitor",
};

const prismaStatusToStatus: Record<PrismaUserStatus, UserStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
  REJECTED: "rejected",
};

const mapPrismaUser = (user: PrismaUser): StoredAuthUser => {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    passwordHash: user.passwordHash,
    whatsapp: user.whatsapp,
    role: prismaRoleToRole[user.role],
    status: prismaStatusToStatus[user.status],
    groupName: user.groupName,
    groupSlug: user.groupSlug,
    enrollmentId: user.enrollmentId,
    mustChangePassword: user.mustChangePassword,
    temporaryPasswordGeneratedAt: user.temporaryPasswordGeneratedAt
      ? user.temporaryPasswordGeneratedAt.toISOString()
      : null,
  };
};

const buildAuthUser = (user: StoredAuthUser): AuthUser => {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: getRolePermissions(user.role),
  };
};

const createPasswordHash = (password: string) => bcrypt.hashSync(password, 10);

const toPrismaUserRole = (role: UserRole): PrismaUserRole => {
  if (role === "admin") {
    return PrismaUserRole.ADMIN;
  }

  if (role === "teacher") {
    return PrismaUserRole.TEACHER;
  }

  if (role === "student") {
    return PrismaUserRole.STUDENT;
  }

  return PrismaUserRole.VISITOR;
};

export const provisionStudentAccessWithPrisma = async (
  transaction: StudentAccessPersistenceClient,
  input: StudentAccessProvisionInput,
): Promise<StudentAccessProvisionResult> => {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = await transaction.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  const roleToPersist =
    existingUser?.role === PrismaUserRole.ADMIN || existingUser?.role === PrismaUserRole.TEACHER
      ? existingUser.role
      : PrismaUserRole.STUDENT;

  const userPayload = {
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    passwordHash: input.passwordHash,
    whatsapp: input.whatsapp.trim(),
    role: roleToPersist,
    status: PrismaUserStatus.ACTIVE,
    groupName: input.groupName,
    groupSlug: input.groupSlug,
    enrollmentId: input.enrollmentId,
    temporaryPasswordGeneratedAt: new Date(input.temporaryPasswordGeneratedAt),
    mustChangePassword: input.mustChangePassword,
    adminNote: "Acesso de aluno criado ou atualizado a partir da aprovação local.",
  };

  let action: StudentAccessProvisionResult["action"] = "created";
  let persistedUser: PrismaUser;

  if (existingUser) {
    action = existingUser.status === PrismaUserStatus.ACTIVE ? "updated" : "activated";
    persistedUser = await transaction.user.update({
      where: { id: existingUser.id },
      data: userPayload,
    });
  } else {
    persistedUser = await transaction.user.create({
      data: userPayload,
    });
  }

  await transaction.auditLog.create({
    data: {
      actorName: input.actorName,
      actorRole: toPrismaUserRole(input.actorRole),
      action: action === "created" ? "Acesso de aluno criado" : "Acesso de aluno atualizado",
      entity: `User ${persistedUser.id}`,
      note: `Acesso local ${action === "created" ? "criado" : "atualizado"} para ${normalizedEmail}.`,
    },
  });

  return {
    user: buildAuthUser(mapPrismaUser(persistedUser)),
    action,
    mustChangePassword: input.mustChangePassword,
  };
};

const cloneStoredUser = (user: StoredAuthUser): StoredAuthUser => ({
  ...user,
});

let memoryAuthUsers: StoredAuthUser[] = [];

const demoUsers: StoredAuthUser[] = [
  {
    id: "user-admin-demo",
    fullName: "Admin Demonstrativo",
    email: "admin.demo@example.com",
    passwordHash: createPasswordHash("AdminDemo@123"),
    role: "admin",
    status: "active",
  },
  {
    id: "user-professor-demo",
    fullName: "Professor Demonstrativo",
    email: "professor.demo@example.com",
    passwordHash: createPasswordHash("ProfessorDemo@123"),
    role: "teacher",
    status: "active",
  },
  {
    id: "user-aluno-demo",
    fullName: "Aluno Demonstrativo",
    email: "aluno.demo@example.com",
    passwordHash: createPasswordHash("AlunoDemo@123"),
    role: "student",
    status: "active",
  },
  {
    id: "user-aluno-inativo-demo",
    fullName: "Aluno Inativo Demonstrativo",
    email: "aluno.inativo.demo@example.com",
    passwordHash: createPasswordHash("AlunoInativo@123"),
    role: "student",
    status: "inactive",
  },
];

export const toAuthUser = buildAuthUser;

export const createMemoryAuthRepository = (
  seedUsers = demoUsers.map(cloneStoredUser),
): AuthRepository => {
  if (memoryAuthUsers.length === 0) {
    memoryAuthUsers = seedUsers.map(cloneStoredUser);
  }

  return {
    async getByEmail(email) {
      const normalizedEmail = email.trim().toLowerCase();
      return memoryAuthUsers.find((user) => user.email === normalizedEmail) ?? null;
    },
    async getById(id) {
      return memoryAuthUsers.find((user) => user.id === id) ?? null;
    },
    async provisionStudentAccess(input) {
      const normalizedEmail = input.email.trim().toLowerCase();
      const existingUser = memoryAuthUsers.find((user) => user.email === normalizedEmail);
      const previousStatus = existingUser?.status;
      const nextRole =
        existingUser?.role === "admin" || existingUser?.role === "teacher"
          ? existingUser.role
          : "student";

      if (existingUser) {
        existingUser.fullName = input.fullName.trim();
        existingUser.passwordHash = input.passwordHash;
        existingUser.whatsapp = input.whatsapp.trim();
        existingUser.status = "active";
        existingUser.role = nextRole;
        existingUser.groupName = input.groupName;
        existingUser.groupSlug = input.groupSlug;
        existingUser.enrollmentId = input.enrollmentId;
        existingUser.mustChangePassword = input.mustChangePassword;
        existingUser.temporaryPasswordGeneratedAt = input.temporaryPasswordGeneratedAt;

        return {
          user: buildAuthUser(existingUser),
          action: previousStatus === "active" ? "updated" : "activated",
          mustChangePassword: input.mustChangePassword,
        };
      }

      const createdUser: StoredAuthUser = {
        id: `user-student-${Date.now()}`,
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        passwordHash: input.passwordHash,
        whatsapp: input.whatsapp.trim(),
        role: "student",
        status: "active",
        groupName: input.groupName,
        groupSlug: input.groupSlug,
        enrollmentId: input.enrollmentId,
        mustChangePassword: input.mustChangePassword,
        temporaryPasswordGeneratedAt: input.temporaryPasswordGeneratedAt,
      };

      memoryAuthUsers.unshift(createdUser);

      return {
        user: buildAuthUser(createdUser),
        action: "created",
        mustChangePassword: input.mustChangePassword,
      };
    },
  };
};

export const createPrismaAuthRepository = (): AuthRepository => {
  const prisma = getPrismaClient();

  return {
    async getByEmail(email) {
      const user = await prisma.user.findUnique({
        where: {
          email: email.trim().toLowerCase(),
        },
      });

      return user ? mapPrismaUser(user) : null;
    },
    async getById(id) {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      return user ? mapPrismaUser(user) : null;
    },
    async provisionStudentAccess(input) {
      return prisma.$transaction((transaction) =>
        provisionStudentAccessWithPrisma(transaction, input),
      );
    },
  };
};

export const resetMemoryAuthRepositoryStore = () => {
  memoryAuthUsers = demoUsers.map(cloneStoredUser);
};

export const createAuthRepository = (): AuthRepository => {
  if (env.nodeEnv === "test") {
    return createMemoryAuthRepository();
  }

  return env.databaseUrl ? createPrismaAuthRepository() : createMemoryAuthRepository();
};
