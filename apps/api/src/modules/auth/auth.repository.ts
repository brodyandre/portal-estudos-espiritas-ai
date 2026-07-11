import bcrypt from "bcryptjs";
import {
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
  type User as PrismaUser,
} from "@prisma/client";

import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import { getRolePermissions } from "../../auth/roles";
import type { UserRole, UserStatus } from "../../auth/types";
import type { AuthUser, StoredAuthUser } from "./auth.types";

export interface AuthRepository {
  getByEmail(email: string): Promise<StoredAuthUser | null>;
  getById(id: string): Promise<StoredAuthUser | null>;
}

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
    role: prismaRoleToRole[user.role],
    status: prismaStatusToStatus[user.status],
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
  seedUsers = demoUsers.map((user) => ({ ...user })),
): AuthRepository => {
  return {
    async getByEmail(email) {
      const normalizedEmail = email.trim().toLowerCase();
      return seedUsers.find((user) => user.email === normalizedEmail) ?? null;
    },
    async getById(id) {
      return seedUsers.find((user) => user.id === id) ?? null;
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
  };
};

export const createAuthRepository = (): AuthRepository => {
  if (env.nodeEnv === "test") {
    return createMemoryAuthRepository();
  }

  return env.databaseUrl ? createPrismaAuthRepository() : createMemoryAuthRepository();
};
