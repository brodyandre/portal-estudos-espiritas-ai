import bcrypt from "bcryptjs";
import {
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
  type AuthSession as PrismaAuthSession,
  type PasswordResetToken as PrismaPasswordResetToken,
  type Prisma,
  type User as PrismaUser,
} from "@prisma/client";

import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import { getRolePermissions } from "../../auth/roles";
import type { UserRole, UserStatus } from "../../auth/types";
import type {
  AdminResetPasswordPersistenceInput,
  AuthUser,
  ChangePasswordPersistenceInput,
  ChangePasswordPersistenceResult,
  CreateAuthSessionInput,
  ListAuthSessionsInput,
  PasswordResetPersistenceInput,
  PasswordResetPersistenceResult,
  PasswordResetRequestPersistenceInput,
  RevokeAllAuthSessionsInput,
  RevokeAuthSessionInput,
  RevokeOtherSessionsForUserInput,
  RevokeSessionForUserInput,
  StoredAuthSession,
  StoredPasswordResetToken,
  StoredAuthUser,
  StudentAccessProvisionInput,
  StudentAccessProvisionResult,
} from "./auth.types";

export interface AuthRepository {
  getByEmail(email: string): Promise<StoredAuthUser | null>;
  getById(id: string): Promise<StoredAuthUser | null>;
  getSessionById(sessionId: string): Promise<StoredAuthSession | null>;
  createSession(input: CreateAuthSessionInput): Promise<StoredAuthSession>;
  touchSession(sessionId: string): Promise<void>;
  revokeSession(input: RevokeAuthSessionInput): Promise<boolean>;
  revokeAllSessionsForUser(input: RevokeAllAuthSessionsInput): Promise<number>;
  listSessionsForUser(input: ListAuthSessionsInput): Promise<StoredAuthSession[]>;
  revokeSessionForUser(input: RevokeSessionForUserInput): Promise<"revoked" | "already_revoked" | "not_found">;
  revokeOtherSessionsForUser(input: RevokeOtherSessionsForUserInput): Promise<number>;
  provisionStudentAccess(input: StudentAccessProvisionInput): Promise<StudentAccessProvisionResult>;
  changePassword(input: ChangePasswordPersistenceInput): Promise<ChangePasswordPersistenceResult | null>;
  resetPasswordByAdmin(input: AdminResetPasswordPersistenceInput): Promise<StoredAuthUser | null>;
  replacePasswordResetToken(input: PasswordResetRequestPersistenceInput): Promise<void>;
  resetPasswordWithRecoveryToken(
    input: PasswordResetPersistenceInput,
  ): Promise<PasswordResetPersistenceResult>;
}

type AuthPersistenceClient = Pick<
  Prisma.TransactionClient,
  "user" | "auditLog" | "authSession" | "passwordResetToken"
>;

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
    mustChangePassword: user.mustChangePassword ?? false,
    temporaryPasswordGeneratedAt: user.temporaryPasswordGeneratedAt
      ? user.temporaryPasswordGeneratedAt.toISOString()
      : null,
    passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
  };
};

const mapPrismaSession = (session: PrismaAuthSession): StoredAuthSession => {
  return {
    id: session.id,
    userId: session.userId,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
    lastSeenAt: session.lastSeenAt ? session.lastSeenAt.toISOString() : null,
    userAgentSummary: session.userAgentSummary ?? null,
    ipHash: session.ipHash ?? null,
  };
};

const mapPrismaPasswordResetToken = (token: PrismaPasswordResetToken): StoredPasswordResetToken => {
  return {
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    createdAt: token.createdAt.toISOString(),
    expiresAt: token.expiresAt.toISOString(),
    usedAt: token.usedAt ? token.usedAt.toISOString() : null,
    invalidatedAt: token.invalidatedAt ? token.invalidatedAt.toISOString() : null,
    requestedIpHash: token.requestedIpHash ?? null,
  };
};

const buildAuthUser = (user: StoredAuthUser): AuthUser => {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword ?? false,
    passwordChangedAt: user.passwordChangedAt ?? null,
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

const createSessionPayload = (input: CreateAuthSessionInput) => {
  const sessionTimestamp = new Date();

  return {
    id: input.sessionId,
    userId: input.userId,
    expiresAt: new Date(input.expiresAt),
    lastSeenAt: sessionTimestamp,
    userAgentSummary: input.userAgentSummary ?? null,
    ipHash: input.ipHash ?? null,
  };
};

const revokeActiveSessionsWithPrisma = async (
  transaction: AuthPersistenceClient,
  userId: string,
  revokedAt = new Date(),
) => {
  const result = await transaction.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt,
    },
  });

  return result.count;
};

export const provisionStudentAccessWithPrisma = async (
  transaction: AuthPersistenceClient,
  input: StudentAccessProvisionInput,
): Promise<StudentAccessProvisionResult> => {
  const normalizedEmail = input.email.trim().toLowerCase();
  const credentialChangedAt = new Date(input.temporaryPasswordGeneratedAt);
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
    temporaryPasswordGeneratedAt: credentialChangedAt,
    passwordChangedAt: credentialChangedAt,
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
    await revokeActiveSessionsWithPrisma(transaction, existingUser.id, credentialChangedAt);
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

const cloneStoredSession = (session: StoredAuthSession): StoredAuthSession => ({
  ...session,
});

const cloneStoredPasswordResetToken = (token: StoredPasswordResetToken): StoredPasswordResetToken => ({
  ...token,
});

let memoryAuthUsers: StoredAuthUser[] = [];
let memoryAuthSessions: StoredAuthSession[] = [];
let memoryPasswordResetTokens: StoredPasswordResetToken[] = [];
type MemoryAuthAuditEntry = {
  actorName: string;
  actorRole: UserRole;
  action: string;
  entity: string;
  note: string;
};
let memoryAuthAuditLogs: MemoryAuthAuditEntry[] = [];

const demoUsers: StoredAuthUser[] = [
  {
    id: "user-admin-demo",
    fullName: "Admin Demonstrativo",
    email: "admin.demo@example.com",
    passwordHash: createPasswordHash("AdminDemo@123"),
    role: "admin",
    status: "active",
    mustChangePassword: false,
    passwordChangedAt: null,
  },
  {
    id: "user-professor-demo",
    fullName: "Professor Demonstrativo",
    email: "professor.demo@example.com",
    passwordHash: createPasswordHash("ProfessorDemo@123"),
    role: "teacher",
    status: "active",
    mustChangePassword: false,
    passwordChangedAt: null,
  },
  {
    id: "user-aluno-demo",
    fullName: "Aluno Demonstrativo",
    email: "aluno.demo@example.com",
    passwordHash: createPasswordHash("AlunoDemo@123"),
    role: "student",
    status: "active",
    mustChangePassword: false,
    passwordChangedAt: null,
  },
  {
    id: "user-aluno-inativo-demo",
    fullName: "Aluno Inativo Demonstrativo",
    email: "aluno.inativo.demo@example.com",
    passwordHash: createPasswordHash("AlunoInativo@123"),
    role: "student",
    status: "inactive",
    mustChangePassword: false,
    passwordChangedAt: null,
  },
];

const revokeActiveSessionsInMemory = (userId: string, revokedAt: string, exceptSessionId?: string) => {
  let revokedCount = 0;

  for (const session of memoryAuthSessions) {
    if (session.userId !== userId || session.revokedAt || session.id === exceptSessionId) {
      continue;
    }

    session.revokedAt = revokedAt;
    revokedCount += 1;
  }

  return revokedCount;
};

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
    async getSessionById(sessionId) {
      const session = memoryAuthSessions.find((item) => item.id === sessionId);
      return session ? cloneStoredSession(session) : null;
    },
    async createSession(input) {
      const createdAt = new Date().toISOString();
      const session: StoredAuthSession = {
        id: input.sessionId,
        userId: input.userId,
        createdAt,
        expiresAt: input.expiresAt,
        revokedAt: null,
        lastSeenAt: createdAt,
        userAgentSummary: input.userAgentSummary ?? null,
        ipHash: input.ipHash ?? null,
      };

      memoryAuthSessions.unshift(session);
      return cloneStoredSession(session);
    },
    async touchSession(sessionId) {
      const session = memoryAuthSessions.find((item) => item.id === sessionId);

      if (!session || session.revokedAt) {
        return;
      }

      session.lastSeenAt = new Date().toISOString();
    },
    async revokeSession(input) {
      const session = memoryAuthSessions.find((item) => item.id === input.sessionId);

      if (!session) {
        return false;
      }

      if (!session.revokedAt) {
        session.revokedAt = new Date().toISOString();
        memoryAuthAuditLogs.unshift({
          actorName: input.actorName,
          actorRole: input.actorRole,
          action: input.action,
          entity: `User ${session.userId}`,
          note: input.note,
        });
      }

      return true;
    },
    async revokeAllSessionsForUser(input) {
      const revokedAt = new Date().toISOString();
      const revokedCount = revokeActiveSessionsInMemory(input.userId, revokedAt);

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: input.action,
        entity: `User ${input.userId}`,
        note: input.note,
      });

      return revokedCount;
    },
    async listSessionsForUser(input) {
      return memoryAuthSessions
        .filter((session) => {
          if (session.userId !== input.userId) {
            return false;
          }

          if (input.includeInactive) {
            return true;
          }

          return !session.revokedAt && new Date(session.expiresAt).getTime() > Date.now();
        })
        .map(cloneStoredSession);
    },
    async revokeSessionForUser(input) {
      const session = memoryAuthSessions.find(
        (item) => item.id === input.sessionId && item.userId === input.userId,
      );

      if (!session) {
        return "not_found";
      }

      if (session.revokedAt) {
        return "already_revoked";
      }

      session.revokedAt = new Date().toISOString();
      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Sessão encerrada",
        entity: `User ${input.userId}`,
        note: "Outra sessão ativa foi encerrada pelo próprio usuário.",
      });

      return "revoked";
    },
    async revokeOtherSessionsForUser(input) {
      const revokedAt = new Date().toISOString();
      const revokedCount = revokeActiveSessionsInMemory(input.userId, revokedAt, input.currentSessionId);

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Outras sessões encerradas",
        entity: `User ${input.userId}`,
        note: "As demais sessões ativas foram encerradas pelo próprio usuário.",
      });

      return revokedCount;
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
        existingUser.passwordChangedAt = input.temporaryPasswordGeneratedAt;
        revokeActiveSessionsInMemory(existingUser.id, input.temporaryPasswordGeneratedAt);

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
        passwordChangedAt: input.temporaryPasswordGeneratedAt,
      };

      memoryAuthUsers.unshift(createdUser);

      return {
        user: buildAuthUser(createdUser),
        action: "created",
        mustChangePassword: input.mustChangePassword,
      };
    },
    async changePassword(input) {
      const existingUser = memoryAuthUsers.find((user) => user.id === input.userId);

      if (!existingUser) {
        return null;
      }

      existingUser.passwordHash = input.passwordHash;
      existingUser.mustChangePassword = false;
      existingUser.passwordChangedAt = input.passwordChangedAt;
      existingUser.temporaryPasswordGeneratedAt = null;
      revokeActiveSessionsInMemory(existingUser.id, input.passwordChangedAt);

      const newSession: StoredAuthSession = {
        id: input.newSessionId,
        userId: existingUser.id,
        createdAt: new Date().toISOString(),
        expiresAt: input.newSessionExpiresAt,
        revokedAt: null,
        lastSeenAt: new Date().toISOString(),
        userAgentSummary: input.newSessionUserAgentSummary ?? null,
        ipHash: input.newSessionIpHash ?? null,
      };

      memoryAuthSessions.unshift(newSession);
      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Senha alterada",
        entity: `User ${existingUser.id}`,
        note: "Senha local alterada com sucesso e sessões anteriores encerradas.",
      });

      return {
        user: cloneStoredUser(existingUser),
        session: cloneStoredSession(newSession),
      };
    },
    async resetPasswordByAdmin(input) {
      const existingUser = memoryAuthUsers.find((user) => user.id === input.userId);

      if (!existingUser) {
        return null;
      }

      existingUser.passwordHash = input.passwordHash;
      existingUser.mustChangePassword = true;
      existingUser.temporaryPasswordGeneratedAt = input.temporaryPasswordGeneratedAt;
      existingUser.passwordChangedAt = input.passwordChangedAt;
      revokeActiveSessionsInMemory(existingUser.id, input.passwordChangedAt);

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Senha redefinida por admin",
        entity: `User ${existingUser.id}`,
        note: `Nova credencial temporária emitida para ${existingUser.email}.`,
      });

      return cloneStoredUser(existingUser);
    },
    async replacePasswordResetToken(input) {
      const now = new Date().toISOString();

      memoryPasswordResetTokens = memoryPasswordResetTokens.map((token) => {
        if (
          token.userId !== input.userId ||
          token.usedAt ||
          token.invalidatedAt ||
          new Date(token.expiresAt).getTime() <= Date.now()
        ) {
          return token;
        }

        return {
          ...token,
          invalidatedAt: now,
        };
      });

      memoryPasswordResetTokens.unshift({
        id: `password-reset-${Date.now()}`,
        userId: input.userId,
        tokenHash: input.tokenHash,
        createdAt: now,
        expiresAt: input.expiresAt,
        usedAt: null,
        invalidatedAt: null,
        requestedIpHash: input.requestedIpHash ?? null,
      });

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Recuperação de senha solicitada",
        entity: `User ${input.userId}`,
        note: "Um novo pedido de recuperação de senha foi registrado no ambiente local.",
      });
    },
    async resetPasswordWithRecoveryToken(input) {
      const now = new Date();
      const activeToken = memoryPasswordResetTokens.find(
        (token) =>
          token.tokenHash === input.tokenHash &&
          !token.usedAt &&
          !token.invalidatedAt &&
          new Date(token.expiresAt).getTime() > now.getTime(),
      );

      if (!activeToken) {
        return { status: "invalid_token" };
      }

      const existingUser = memoryAuthUsers.find((user) => user.id === activeToken.userId);

      if (!existingUser) {
        return { status: "invalid_token" };
      }

      const isReusedPassword = await bcrypt.compare(input.newPassword, existingUser.passwordHash);

      if (isReusedPassword) {
        return { status: "password_reuse" };
      }

      const nextUsers = memoryAuthUsers.map((user) =>
        user.id === existingUser.id
          ? {
              ...user,
              passwordHash: input.passwordHash,
              mustChangePassword: false,
              passwordChangedAt: input.passwordChangedAt,
              temporaryPasswordGeneratedAt: null,
            }
          : user,
      );

      const nextTokens = memoryPasswordResetTokens.map((token) => {
        if (token.id === activeToken.id) {
          return {
            ...token,
            usedAt: input.passwordChangedAt,
          };
        }

        if (
          token.userId === activeToken.userId &&
          !token.usedAt &&
          !token.invalidatedAt &&
          new Date(token.expiresAt).getTime() > now.getTime()
        ) {
          return {
            ...token,
            invalidatedAt: input.passwordChangedAt,
          };
        }

        return token;
      });

      const nextSessions = memoryAuthSessions.map((session) =>
        session.userId === activeToken.userId && !session.revokedAt
          ? {
              ...session,
              revokedAt: input.passwordChangedAt,
            }
          : session,
      );

      memoryAuthUsers = nextUsers;
      memoryPasswordResetTokens = nextTokens;
      memoryAuthSessions = nextSessions;
      memoryAuthAuditLogs = [
        {
          actorName: input.actorName,
          actorRole: input.actorRole,
          action: "Senha redefinida por recuperação",
          entity: `User ${existingUser.id}`,
          note: "A senha foi redefinida com token temporário e as sessões anteriores foram encerradas.",
        },
        ...memoryAuthAuditLogs,
      ];

      const updatedUser = nextUsers.find((user) => user.id === existingUser.id);

      return updatedUser ? { status: "updated", user: cloneStoredUser(updatedUser) } : { status: "invalid_token" };
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
    async getSessionById(sessionId) {
      const session = await prisma.authSession.findUnique({
        where: {
          id: sessionId,
        },
      });

      return session ? mapPrismaSession(session) : null;
    },
    async createSession(input) {
      const createdSession = await prisma.authSession.create({
        data: createSessionPayload(input),
      });

      return mapPrismaSession(createdSession);
    },
    async touchSession(sessionId) {
      await prisma.authSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
        },
        data: {
          lastSeenAt: new Date(),
        },
      });
    },
    async revokeSession(input) {
      const revokedSession = await prisma.$transaction(async (transaction) => {
        const existingSession = await transaction.authSession.findUnique({
          where: {
            id: input.sessionId,
          },
        });

        if (!existingSession) {
          return null;
        }

        if (!existingSession.revokedAt) {
          await transaction.authSession.update({
            where: {
              id: input.sessionId,
            },
            data: {
              revokedAt: new Date(),
            },
          });

          await transaction.auditLog.create({
            data: {
              actorName: input.actorName,
              actorRole: toPrismaUserRole(input.actorRole),
              action: input.action,
              entity: `User ${existingSession.userId}`,
              note: input.note,
            },
          });
        }

        return existingSession;
      });

      return Boolean(revokedSession);
    },
    async revokeAllSessionsForUser(input) {
      return prisma.$transaction(async (transaction) => {
        const revokedCount = await revokeActiveSessionsWithPrisma(transaction, input.userId, new Date());

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: input.action,
            entity: `User ${input.userId}`,
            note: input.note,
          },
        });

        return revokedCount;
      });
    },
    async listSessionsForUser(input) {
      const sessions = await prisma.authSession.findMany({
        where: {
          userId: input.userId,
          ...(input.includeInactive
            ? {}
            : {
                revokedAt: null,
                expiresAt: {
                  gt: new Date(),
                },
              }),
        },
      });

      return sessions.map(mapPrismaSession);
    },
    async revokeSessionForUser(input) {
      return prisma.$transaction(async (transaction) => {
        const existingSession = await transaction.authSession.findFirst({
          where: {
            id: input.sessionId,
            userId: input.userId,
          },
        });

        if (!existingSession) {
          return "not_found";
        }

        if (existingSession.revokedAt) {
          return "already_revoked";
        }

        await transaction.authSession.update({
          where: {
            id: existingSession.id,
          },
          data: {
            revokedAt: new Date(),
          },
        });

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Sessão encerrada",
            entity: `User ${input.userId}`,
            note: "Outra sessão ativa foi encerrada pelo próprio usuário.",
          },
        });

        return "revoked";
      });
    },
    async revokeOtherSessionsForUser(input) {
      return prisma.$transaction(async (transaction) => {
        const revokedAt = new Date();
        const result = await transaction.authSession.updateMany({
          where: {
            userId: input.userId,
            revokedAt: null,
            NOT: {
              id: input.currentSessionId,
            },
          },
          data: {
            revokedAt,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Outras sessões encerradas",
            entity: `User ${input.userId}`,
            note: "As demais sessões ativas foram encerradas pelo próprio usuário.",
          },
        });

        return result.count;
      });
    },
    async provisionStudentAccess(input) {
      return prisma.$transaction((transaction) =>
        provisionStudentAccessWithPrisma(transaction, input),
      );
    },
    async changePassword(input) {
      const changedUser = await prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findUnique({
          where: {
            id: input.userId,
          },
        });

        if (!existingUser) {
          return null;
        }

        const passwordChangedAt = new Date(input.passwordChangedAt);

        const updatedUser = await transaction.user.update({
          where: {
            id: input.userId,
          },
          data: {
            passwordHash: input.passwordHash,
            mustChangePassword: false,
            passwordChangedAt,
            temporaryPasswordGeneratedAt: null,
          },
        });

        await revokeActiveSessionsWithPrisma(transaction, input.userId, passwordChangedAt);

        const createdSession = await transaction.authSession.create({
          data: createSessionPayload({
            sessionId: input.newSessionId,
            userId: input.userId,
            expiresAt: input.newSessionExpiresAt,
            userAgentSummary: input.newSessionUserAgentSummary,
            ipHash: input.newSessionIpHash,
          }),
        });

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Senha alterada",
            entity: `User ${updatedUser.id}`,
            note: "Senha local alterada com sucesso e sessões anteriores encerradas.",
          },
        });

        return {
          user: updatedUser,
          session: createdSession,
        };
      });

      return changedUser
        ? {
            user: mapPrismaUser(changedUser.user),
            session: mapPrismaSession(changedUser.session),
          }
        : null;
    },
    async resetPasswordByAdmin(input) {
      const resetUser = await prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findUnique({
          where: {
            id: input.userId,
          },
        });

        if (!existingUser) {
          return null;
        }

        const credentialChangedAt = new Date(input.passwordChangedAt);
        const temporaryPasswordGeneratedAt = new Date(input.temporaryPasswordGeneratedAt);

        const updatedUser = await transaction.user.update({
          where: {
            id: input.userId,
          },
          data: {
            passwordHash: input.passwordHash,
            mustChangePassword: true,
            passwordChangedAt: credentialChangedAt,
            temporaryPasswordGeneratedAt,
          },
        });

        await revokeActiveSessionsWithPrisma(transaction, input.userId, credentialChangedAt);

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Senha redefinida por admin",
            entity: `User ${updatedUser.id}`,
            note: `Nova credencial temporária emitida para ${updatedUser.email}.`,
          },
        });

        return updatedUser;
      });

      return resetUser ? mapPrismaUser(resetUser) : null;
    },
    async replacePasswordResetToken(input) {
      await prisma.$transaction(async (transaction) => {
        const now = new Date();

        await transaction.passwordResetToken.updateMany({
          where: {
            userId: input.userId,
            usedAt: null,
            invalidatedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            invalidatedAt: now,
          },
        });

        await transaction.passwordResetToken.create({
          data: {
            userId: input.userId,
            tokenHash: input.tokenHash,
            expiresAt: new Date(input.expiresAt),
            requestedIpHash: input.requestedIpHash ?? null,
          },
        });

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Recuperação de senha solicitada",
            entity: `User ${input.userId}`,
            note: "Um novo pedido de recuperação de senha foi registrado no ambiente local.",
          },
        });
      });
    },
    async resetPasswordWithRecoveryToken(input) {
      return prisma.$transaction(async (transaction) => {
        const now = new Date();
        const token = await transaction.passwordResetToken.findUnique({
          where: {
            tokenHash: input.tokenHash,
          },
        });

        if (
          !token ||
          token.usedAt ||
          token.invalidatedAt ||
          token.expiresAt.getTime() <= now.getTime()
        ) {
          return { status: "invalid_token" } satisfies PasswordResetPersistenceResult;
        }

        const existingUser = await transaction.user.findUnique({
          where: {
            id: token.userId,
          },
        });

        if (!existingUser) {
          return { status: "invalid_token" } satisfies PasswordResetPersistenceResult;
        }

        const isReusedPassword = await bcrypt.compare(input.newPassword, existingUser.passwordHash);

        if (isReusedPassword) {
          return { status: "password_reuse" } satisfies PasswordResetPersistenceResult;
        }

        const passwordChangedAt = new Date(input.passwordChangedAt);
        const consumeResult = await transaction.passwordResetToken.updateMany({
          where: {
            id: token.id,
            usedAt: null,
            invalidatedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            usedAt: passwordChangedAt,
          },
        });

        if (consumeResult.count !== 1) {
          return { status: "invalid_token" } satisfies PasswordResetPersistenceResult;
        }

        const updatedUser = await transaction.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            passwordHash: input.passwordHash,
            mustChangePassword: false,
            passwordChangedAt,
            temporaryPasswordGeneratedAt: null,
          },
        });

        await transaction.passwordResetToken.updateMany({
          where: {
            userId: existingUser.id,
            id: {
              not: token.id,
            },
            usedAt: null,
            invalidatedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            invalidatedAt: passwordChangedAt,
          },
        });

        await revokeActiveSessionsWithPrisma(transaction, existingUser.id, passwordChangedAt);

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Senha redefinida por recuperação",
            entity: `User ${existingUser.id}`,
            note: "A senha foi redefinida com token temporário e as sessões anteriores foram encerradas.",
          },
        });

        return {
          status: "updated",
          user: mapPrismaUser(updatedUser),
        } satisfies PasswordResetPersistenceResult;
      });
    },
  };
};

export const resetMemoryAuthRepositoryStore = () => {
  memoryAuthUsers = demoUsers.map(cloneStoredUser);
  memoryAuthSessions = [];
  memoryPasswordResetTokens = [];
  memoryAuthAuditLogs = [];
};

export const getMemoryAuthAuditLogs = () => {
  return memoryAuthAuditLogs.map((entry) => ({ ...entry }));
};

export const getMemoryAuthSessions = () => {
  return memoryAuthSessions.map(cloneStoredSession);
};

export const getMemoryPasswordResetTokens = () => {
  return memoryPasswordResetTokens.map(cloneStoredPasswordResetToken);
};

export const createAuthRepository = (): AuthRepository => {
  if (env.nodeEnv === "test") {
    return createMemoryAuthRepository();
  }

  return env.databaseUrl ? createPrismaAuthRepository() : createMemoryAuthRepository();
};
