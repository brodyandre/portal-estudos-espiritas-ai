import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  DeliveryStatus as PrismaDeliveryStatus,
  InvitationType as PrismaInvitationType,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
  type AccountInvitation as PrismaAccountInvitation,
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
  AcceptAccountInvitationPersistenceInput,
  AcceptAccountInvitationResult,
  AdminResetPasswordPersistenceInput,
  CreateAccountInvitationInput,
  EnrollmentInvitationProvisionInput,
  EnrollmentInvitationProvisionResult,
  InvitedEnrollmentUserInput,
  InvitedEnrollmentUserResult,
  AuthUser,
  ChangePasswordPersistenceInput,
  ChangePasswordPersistenceResult,
  CreateAuthSessionInput,
  InvalidatePasswordResetTokenInput,
  ListAuthSessionsInput,
  MarkAccountInvitationDeliveredInput,
  MarkAccountInvitationFailedInput,
  PasswordResetPersistenceInput,
  PasswordResetPersistenceResult,
  PasswordResetRequestPersistenceInput,
  RevokeAllAuthSessionsInput,
  RevokeAuthSessionInput,
  RevokeOtherSessionsForUserInput,
  RevokeSessionForUserInput,
  StoredAccountInvitation,
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
  prepareInvitedEnrollmentUser(input: InvitedEnrollmentUserInput): Promise<InvitedEnrollmentUserResult>;
  changePassword(input: ChangePasswordPersistenceInput): Promise<ChangePasswordPersistenceResult | null>;
  resetPasswordByAdmin(input: AdminResetPasswordPersistenceInput): Promise<StoredAuthUser | null>;
  replacePasswordResetToken(input: PasswordResetRequestPersistenceInput): Promise<void>;
  replaceAccountInvitation(input: CreateAccountInvitationInput): Promise<StoredAccountInvitation>;
  markAccountInvitationDelivered(input: MarkAccountInvitationDeliveredInput): Promise<boolean>;
  markAccountInvitationFailed(input: MarkAccountInvitationFailedInput): Promise<boolean>;
  invalidatePasswordResetToken(input: InvalidatePasswordResetTokenInput): Promise<boolean>;
  acceptAccountInvitation(input: AcceptAccountInvitationPersistenceInput): Promise<AcceptAccountInvitationResult>;
  resetPasswordWithRecoveryToken(
    input: PasswordResetPersistenceInput,
  ): Promise<PasswordResetPersistenceResult>;
}

type AuthPersistenceClient = Pick<
  Prisma.TransactionClient,
  "user" | "auditLog" | "authSession" | "passwordResetToken" | "accountInvitation"
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

const invitationTypeToPrisma: Record<StoredAccountInvitation["invitationType"], PrismaInvitationType> = {
  enrollment_approval: PrismaInvitationType.ENROLLMENT_APPROVAL,
  admin_reinvite: PrismaInvitationType.ADMIN_REINVITE,
};

const prismaInvitationTypeToInvitationType: Record<
  PrismaInvitationType,
  StoredAccountInvitation["invitationType"]
> = {
  ENROLLMENT_APPROVAL: "enrollment_approval",
  ADMIN_REINVITE: "admin_reinvite",
};

const prismaDeliveryStatusToDeliveryStatus: Record<
  PrismaDeliveryStatus,
  StoredAccountInvitation["deliveryStatus"]
> = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  NOT_CONFIGURED: "not_configured",
};

const deliveryStatusToPrisma: Record<
  StoredAccountInvitation["deliveryStatus"],
  PrismaDeliveryStatus
> = {
  pending: PrismaDeliveryStatus.PENDING,
  sent: PrismaDeliveryStatus.SENT,
  failed: PrismaDeliveryStatus.FAILED,
  not_configured: PrismaDeliveryStatus.NOT_CONFIGURED,
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
    accountActivatedAt: user.accountActivatedAt ? user.accountActivatedAt.toISOString() : null,
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

const mapPrismaAccountInvitation = (invitation: PrismaAccountInvitation): StoredAccountInvitation => {
  return {
    id: invitation.id,
    userId: invitation.userId,
    tokenHash: invitation.tokenHash,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
    invalidatedAt: invitation.invalidatedAt ? invitation.invalidatedAt.toISOString() : null,
    invitedByUserId: invitation.invitedByUserId ?? null,
    invitationType: prismaInvitationTypeToInvitationType[invitation.invitationType],
    recipientEmailSnapshot: invitation.recipientEmailSnapshot,
    deliveryStatus: prismaDeliveryStatusToDeliveryStatus[invitation.deliveryStatus],
    deliveredAt: invitation.deliveredAt ? invitation.deliveredAt.toISOString() : null,
    deliveryFailedAt: invitation.deliveryFailedAt ? invitation.deliveryFailedAt.toISOString() : null,
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

export const prepareInvitedEnrollmentUserWithPrisma = async (
  transaction: AuthPersistenceClient,
  input: InvitedEnrollmentUserInput,
): Promise<InvitedEnrollmentUserResult> => {
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

  const basePayload = {
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    whatsapp: input.whatsapp.trim(),
    role: roleToPersist,
    status: PrismaUserStatus.ACTIVE,
    groupName: input.groupName,
    groupSlug: input.groupSlug,
    enrollmentId: input.enrollmentId,
    adminNote: "Acesso local preparado para ativação por convite.",
  };

  if (existingUser) {
    const updatedUser = await transaction.user.update({
      where: { id: existingUser.id },
      data: {
        ...basePayload,
        ...(input.passwordHash
          ? {
              passwordHash: input.passwordHash,
              mustChangePassword: false,
              accountActivatedAt: null,
              temporaryPasswordGeneratedAt: null,
            }
          : {}),
      },
    });

    await transaction.auditLog.create({
      data: {
        actorName: input.actorName,
        actorRole: toPrismaUserRole(input.actorRole),
        action: "Acesso preparado para convite",
        entity: `User ${updatedUser.id}`,
        note: "Cadastro associado a convite de ativação sem expor credencial temporária.",
      },
    });

    return {
      user: buildAuthUser(mapPrismaUser(updatedUser)),
      action: existingUser.status === PrismaUserStatus.ACTIVE ? "updated" : "activated",
    };
  }

  const createdUser = await transaction.user.create({
    data: {
      ...basePayload,
      passwordHash: input.passwordHash ?? createPasswordHash(randomBytes(32).toString("base64url")),
      accountActivatedAt: null,
      mustChangePassword: false,
      temporaryPasswordGeneratedAt: null,
    },
  });

  await transaction.auditLog.create({
    data: {
      actorName: input.actorName,
      actorRole: toPrismaUserRole(input.actorRole),
      action: "Acesso preparado para convite",
      entity: `User ${createdUser.id}`,
      note: "Novo cadastro criado com senha ainda não definida pelo participante.",
    },
  });

  return {
    user: buildAuthUser(mapPrismaUser(createdUser)),
    action: "created",
  };
};

export const provisionEnrollmentInvitationWithPrisma = async (
  transaction: AuthPersistenceClient,
  input: EnrollmentInvitationProvisionInput,
): Promise<EnrollmentInvitationProvisionResult> => {
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
  const basePayload = {
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    whatsapp: input.whatsapp.trim(),
    role: roleToPersist,
    status: PrismaUserStatus.ACTIVE,
    groupName: input.groupName,
    groupSlug: input.groupSlug,
    enrollmentId: input.enrollmentId,
    adminNote: "Acesso local preparado para ativação por convite.",
  };

  let action: EnrollmentInvitationProvisionResult["action"] = "created";
  let persistedUser: PrismaUser;

  if (existingUser) {
    action = existingUser.status === PrismaUserStatus.ACTIVE ? "updated" : "activated";
    persistedUser = await transaction.user.update({
      where: { id: existingUser.id },
      data: {
        ...basePayload,
      },
    });
  } else {
    persistedUser = await transaction.user.create({
      data: {
        ...basePayload,
        passwordHash: input.placeholderPasswordHash,
        accountActivatedAt: null,
        mustChangePassword: false,
        temporaryPasswordGeneratedAt: null,
      },
    });
  }

  await transaction.auditLog.create({
    data: {
      actorName: input.actorName,
      actorRole: toPrismaUserRole(input.actorRole),
      action: "Acesso preparado para convite",
      entity: `User ${persistedUser.id}`,
      note:
        action === "created"
          ? "Novo cadastro criado com senha ainda não definida pelo participante."
          : "Cadastro associado a convite de ativação sem expor credencial temporária.",
    },
  });

  const invitation = await replaceAccountInvitationWithPrisma(transaction, {
    userId: persistedUser.id,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    invitedByUserId: input.invitedByUserId ?? null,
    invitationType: "enrollment_approval",
    recipientEmailSnapshot: normalizedEmail,
    actorName: input.actorName,
    actorRole: input.actorRole,
  });

  return {
    user: buildAuthUser(mapPrismaUser(persistedUser)),
    action,
    invitation,
  };
};

const replaceAccountInvitationWithPrisma = async (
  transaction: AuthPersistenceClient,
  input: CreateAccountInvitationInput,
) => {
  const now = new Date();

  await transaction.accountInvitation.updateMany({
    where: {
      userId: input.userId,
      invitationType: invitationTypeToPrisma[input.invitationType],
      acceptedAt: null,
      invalidatedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    data: {
      invalidatedAt: now,
    },
  });

  const invitation = await transaction.accountInvitation.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.expiresAt),
      invitedByUserId: input.invitedByUserId ?? null,
      invitationType: invitationTypeToPrisma[input.invitationType],
      recipientEmailSnapshot: input.recipientEmailSnapshot,
      deliveryStatus: PrismaDeliveryStatus.PENDING,
    },
  });

  await transaction.auditLog.create({
    data: {
      actorName: input.actorName,
      actorRole: toPrismaUserRole(input.actorRole),
      action: "Convite de acesso criado",
      entity: `User ${input.userId}`,
      note: "Novo convite de ativação registrado no ambiente local.",
    },
  });

  return mapPrismaAccountInvitation(invitation);
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

const cloneStoredAccountInvitation = (invitation: StoredAccountInvitation): StoredAccountInvitation => ({
  ...invitation,
});

let memoryAuthUsers: StoredAuthUser[] = [];
let memoryAuthSessions: StoredAuthSession[] = [];
let memoryPasswordResetTokens: StoredPasswordResetToken[] = [];
let memoryAccountInvitations: StoredAccountInvitation[] = [];
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
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
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
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
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
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
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
    accountActivatedAt: "2026-07-12T09:00:00.000Z",
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

const updateExistingEnrollmentUser = (
  existingUser: StoredAuthUser,
  input: InvitedEnrollmentUserInput,
) => {
  existingUser.fullName = input.fullName.trim();
  existingUser.whatsapp = input.whatsapp.trim();
  existingUser.status = "active";
  existingUser.groupName = input.groupName;
  existingUser.groupSlug = input.groupSlug;
  existingUser.enrollmentId = input.enrollmentId;
  existingUser.adminNote = "Acesso local preparado para ativação por convite.";

  if (existingUser.role !== "admin" && existingUser.role !== "teacher") {
    existingUser.role = "student";
  }

  if (input.passwordHash) {
    existingUser.passwordHash = input.passwordHash;
    existingUser.accountActivatedAt = null;
    existingUser.mustChangePassword = false;
    existingUser.temporaryPasswordGeneratedAt = null;
  }
};

const prepareInvitedEnrollmentUserInMemory = async (
  input: InvitedEnrollmentUserInput,
): Promise<InvitedEnrollmentUserResult> => {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = memoryAuthUsers.find((user) => user.email === normalizedEmail);
  const previousStatus = existingUser?.status;

  if (existingUser) {
    updateExistingEnrollmentUser(existingUser, input);

    memoryAuthAuditLogs.unshift({
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: "Acesso preparado para convite",
      entity: `User ${existingUser.id}`,
      note: "Cadastro associado a convite de ativação sem expor credencial temporária.",
    });

    return {
      user: buildAuthUser(existingUser),
      action: previousStatus === "active" ? "updated" : "activated",
    };
  }

  const createdUser: StoredAuthUser = {
    id: `user-student-${Date.now()}`,
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    passwordHash: input.passwordHash ?? createPasswordHash(randomBytes(32).toString("base64url")),
    whatsapp: input.whatsapp.trim(),
    role: "student",
    status: "active",
    groupName: input.groupName,
    groupSlug: input.groupSlug,
    enrollmentId: input.enrollmentId,
    accountActivatedAt: null,
    mustChangePassword: false,
    temporaryPasswordGeneratedAt: null,
    passwordChangedAt: null,
    adminNote: "Acesso local preparado para ativação por convite.",
  };

  memoryAuthUsers.unshift(createdUser);
  memoryAuthAuditLogs.unshift({
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: "Acesso preparado para convite",
    entity: `User ${createdUser.id}`,
    note: "Novo cadastro criado com senha ainda não definida pelo participante.",
  });

  return {
    user: buildAuthUser(createdUser),
    action: "created",
  };
};

export const provisionEnrollmentInvitationInMemory = async (
  input: EnrollmentInvitationProvisionInput,
): Promise<EnrollmentInvitationProvisionResult> => {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = memoryAuthUsers.find((user) => user.email === normalizedEmail);
  const now = new Date().toISOString();

  const nextUsers = memoryAuthUsers.map(cloneStoredUser);
  const nextInvitations = memoryAccountInvitations.map(cloneStoredAccountInvitation);
  const nextAuditLogs = memoryAuthAuditLogs.map((entry) => ({ ...entry }));

  let action: EnrollmentInvitationProvisionResult["action"] = "created";
  let targetUser: StoredAuthUser;

  if (existingUser) {
    targetUser = nextUsers.find((user) => user.id === existingUser.id)!;
    action = existingUser.status === "active" ? "updated" : "activated";
    targetUser.fullName = input.fullName.trim();
    targetUser.whatsapp = input.whatsapp.trim();
    targetUser.status = "active";
    targetUser.groupName = input.groupName;
    targetUser.groupSlug = input.groupSlug;
    targetUser.enrollmentId = input.enrollmentId;
    targetUser.adminNote = "Acesso local preparado para ativação por convite.";

    if (targetUser.role !== "admin" && targetUser.role !== "teacher") {
      targetUser.role = "student";
    }
  } else {
    targetUser = {
      id: `user-student-${Date.now()}`,
      fullName: input.fullName.trim(),
      email: normalizedEmail,
      passwordHash: input.placeholderPasswordHash,
      whatsapp: input.whatsapp.trim(),
      role: "student",
      status: "active",
      groupName: input.groupName,
      groupSlug: input.groupSlug,
      enrollmentId: input.enrollmentId,
      accountActivatedAt: null,
      mustChangePassword: false,
      temporaryPasswordGeneratedAt: null,
      passwordChangedAt: null,
      adminNote: "Acesso local preparado para ativação por convite.",
    };
    nextUsers.unshift(targetUser);
  }

  nextAuditLogs.unshift({
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: "Acesso preparado para convite",
    entity: `User ${targetUser.id}`,
    note:
      action === "created"
        ? "Novo cadastro criado com senha ainda não definida pelo participante."
        : "Cadastro associado a convite de ativação sem expor credencial temporária.",
  });

  for (const invitation of nextInvitations) {
    if (
      invitation.userId === targetUser.id &&
      invitation.invitationType === "enrollment_approval" &&
      !invitation.acceptedAt &&
      !invitation.invalidatedAt &&
      new Date(invitation.expiresAt).getTime() > Date.now()
    ) {
      invitation.invalidatedAt = now;
    }
  }

  const createdInvitation: StoredAccountInvitation = {
    id: `account-invitation-${Date.now()}`,
    userId: targetUser.id,
    tokenHash: input.tokenHash,
    createdAt: now,
    expiresAt: input.expiresAt,
    acceptedAt: null,
    invalidatedAt: null,
    invitedByUserId: input.invitedByUserId ?? null,
    invitationType: "enrollment_approval",
    recipientEmailSnapshot: normalizedEmail,
    deliveryStatus: "pending",
    deliveredAt: null,
    deliveryFailedAt: null,
  };

  nextInvitations.unshift(createdInvitation);
  nextAuditLogs.unshift({
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: "Convite de acesso criado",
    entity: `User ${targetUser.id}`,
    note: "Novo convite de ativação registrado no ambiente local.",
  });

  memoryAuthUsers = nextUsers;
  memoryAccountInvitations = nextInvitations;
  memoryAuthAuditLogs = nextAuditLogs;

  return {
    user: buildAuthUser(targetUser),
    action,
    invitation: cloneStoredAccountInvitation(createdInvitation),
  };
};

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
    async prepareInvitedEnrollmentUser(input) {
      return prepareInvitedEnrollmentUserInMemory(input);
    },
    async changePassword(input) {
      const existingUser = memoryAuthUsers.find((user) => user.id === input.userId);

      if (!existingUser) {
        return null;
      }

      existingUser.passwordHash = input.passwordHash;
      existingUser.accountActivatedAt = input.passwordChangedAt;
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
    async replaceAccountInvitation(input) {
      const now = new Date().toISOString();

      memoryAccountInvitations = memoryAccountInvitations.map((invitation) => {
        if (
          invitation.userId !== input.userId ||
          invitation.invitationType !== input.invitationType ||
          invitation.acceptedAt ||
          invitation.invalidatedAt ||
          new Date(invitation.expiresAt).getTime() <= Date.now()
        ) {
          return invitation;
        }

        return {
          ...invitation,
          invalidatedAt: now,
        };
      });

      const createdInvitation: StoredAccountInvitation = {
        id: `account-invitation-${Date.now()}`,
        userId: input.userId,
        tokenHash: input.tokenHash,
        createdAt: now,
        expiresAt: input.expiresAt,
        acceptedAt: null,
        invalidatedAt: null,
        invitedByUserId: input.invitedByUserId ?? null,
        invitationType: input.invitationType,
        recipientEmailSnapshot: input.recipientEmailSnapshot,
        deliveryStatus: "pending",
        deliveredAt: null,
        deliveryFailedAt: null,
      };

      memoryAccountInvitations.unshift(createdInvitation);
      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Convite de acesso criado",
        entity: `User ${input.userId}`,
        note: "Novo convite de ativação registrado no ambiente local.",
      });

      return cloneStoredAccountInvitation(createdInvitation);
    },
    async markAccountInvitationDelivered(input) {
      const invitationIndex = memoryAccountInvitations.findIndex(
        (item) =>
          item.id === input.invitationId &&
          item.deliveryStatus === "pending" &&
          !item.acceptedAt &&
          !item.invalidatedAt,
      );

      if (invitationIndex === -1) {
        return false;
      }

      const currentInvitation = memoryAccountInvitations[invitationIndex];
      memoryAccountInvitations[invitationIndex] = {
        ...currentInvitation,
        deliveryStatus: "sent",
        deliveredAt: input.deliveredAt,
      };

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Convite de acesso enviado",
        entity: `User ${currentInvitation.userId}`,
        note: input.note,
      });

      return true;
    },
    async markAccountInvitationFailed(input) {
      const invitationIndex = memoryAccountInvitations.findIndex(
        (item) =>
          item.id === input.invitationId &&
          item.deliveryStatus === "pending" &&
          !item.acceptedAt &&
          !item.invalidatedAt,
      );

      if (invitationIndex === -1) {
        return false;
      }

      const currentInvitation = memoryAccountInvitations[invitationIndex];
      memoryAccountInvitations[invitationIndex] = {
        ...currentInvitation,
        deliveryStatus: "failed",
        deliveryFailedAt: input.failedAt,
        invalidatedAt: input.invalidatedAt,
      };

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Convite de acesso invalidado",
        entity: `User ${currentInvitation.userId}`,
        note: input.note,
      });

      return true;
    },
    async invalidatePasswordResetToken(input) {
      const tokenIndex = memoryPasswordResetTokens.findIndex(
        (item) => item.tokenHash === input.tokenHash && !item.usedAt && !item.invalidatedAt,
      );

      if (tokenIndex === -1) {
        return false;
      }

      const token = memoryPasswordResetTokens[tokenIndex];

      memoryPasswordResetTokens[tokenIndex] = {
        ...token,
        invalidatedAt: input.invalidatedAt,
      };

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Recuperação de senha invalidada",
        entity: `User ${token.userId}`,
        note: input.note,
      });

      return true;
    },
    async acceptAccountInvitation(input) {
      const now = new Date();
      const activeInvitationIndex = memoryAccountInvitations.findIndex(
        (invitation) =>
          invitation.tokenHash === input.tokenHash &&
          !invitation.acceptedAt &&
          !invitation.invalidatedAt &&
          new Date(invitation.expiresAt).getTime() > now.getTime(),
      );

      if (activeInvitationIndex === -1) {
        return { status: "invalid_invitation" };
      }

      const activeInvitation = memoryAccountInvitations[activeInvitationIndex];
      const existingUser = memoryAuthUsers.find((user) => user.id === activeInvitation.userId);

      if (!existingUser) {
        return { status: "invalid_invitation" };
      }

      existingUser.passwordHash = input.passwordHash;
      existingUser.accountActivatedAt = input.passwordChangedAt;
      existingUser.mustChangePassword = false;
      existingUser.passwordChangedAt = input.passwordChangedAt;
      existingUser.temporaryPasswordGeneratedAt = null;

      memoryAccountInvitations = memoryAccountInvitations.map((invitation) => {
        if (invitation.id === activeInvitation.id) {
          return {
            ...invitation,
            acceptedAt: input.passwordChangedAt,
            deliveryStatus:
              invitation.deliveryStatus === "pending" ? "sent" : invitation.deliveryStatus,
          };
        }

        if (
          invitation.userId === activeInvitation.userId &&
          !invitation.acceptedAt &&
          !invitation.invalidatedAt &&
          new Date(invitation.expiresAt).getTime() > now.getTime()
        ) {
          return {
            ...invitation,
            invalidatedAt: input.passwordChangedAt,
          };
        }

        return invitation;
      });

      revokeActiveSessionsInMemory(existingUser.id, input.passwordChangedAt);

      memoryAuthAuditLogs.unshift({
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: "Convite de acesso aceito",
        entity: `User ${existingUser.id}`,
        note: "Conta ativada com nova senha definida pelo participante.",
      });

      return {
        status: "updated",
        user: cloneStoredUser(existingUser),
      };
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
    async prepareInvitedEnrollmentUser(input) {
      return prisma.$transaction((transaction) =>
        prepareInvitedEnrollmentUserWithPrisma(transaction, input),
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
    async replaceAccountInvitation(input) {
      return prisma.$transaction((transaction) =>
        replaceAccountInvitationWithPrisma(transaction, input),
      );
    },
    async markAccountInvitationDelivered(input) {
      const deliveredAt = new Date(input.deliveredAt);

      return prisma.$transaction(async (transaction) => {
        const result = await transaction.accountInvitation.updateMany({
          where: {
            id: input.invitationId,
            deliveryStatus: PrismaDeliveryStatus.PENDING,
            acceptedAt: null,
            invalidatedAt: null,
          },
          data: {
            deliveryStatus: PrismaDeliveryStatus.SENT,
            deliveredAt,
          },
        });

        if (result.count !== 1) {
          return false;
        }

        const invitation = await transaction.accountInvitation.findUnique({
          where: {
            id: input.invitationId,
          },
          select: {
            userId: true,
          },
        });

        if (!invitation) {
          return false;
        }

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Convite de acesso enviado",
            entity: `User ${invitation.userId}`,
            note: input.note,
          },
        });

        return true;
      });
    },
    async markAccountInvitationFailed(input) {
      const failedAt = new Date(input.failedAt);
      const invalidatedAt = new Date(input.invalidatedAt);

      return prisma.$transaction(async (transaction) => {
        const invitation = await transaction.accountInvitation.findUnique({
          where: {
            id: input.invitationId,
          },
          select: {
            userId: true,
            acceptedAt: true,
            invalidatedAt: true,
          },
        });

        if (!invitation || invitation.acceptedAt || invitation.invalidatedAt) {
          return false;
        }

        const result = await transaction.accountInvitation.updateMany({
          where: {
            id: input.invitationId,
            deliveryStatus: PrismaDeliveryStatus.PENDING,
            acceptedAt: null,
            invalidatedAt: null,
          },
          data: {
            deliveryStatus: PrismaDeliveryStatus.FAILED,
            deliveryFailedAt: failedAt,
            invalidatedAt,
          },
        });

        if (result.count !== 1) {
          return false;
        }

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Convite de acesso invalidado",
            entity: `User ${invitation.userId}`,
            note: input.note,
          },
        });

        return true;
      });
    },
    async invalidatePasswordResetToken(input) {
      const invalidatedAt = new Date(input.invalidatedAt);

      return prisma.$transaction(async (transaction) => {
        const token = await transaction.passwordResetToken.findUnique({
          where: {
            tokenHash: input.tokenHash,
          },
          select: {
            userId: true,
            usedAt: true,
            invalidatedAt: true,
          },
        });

        if (!token || token.usedAt || token.invalidatedAt) {
          return false;
        }

        const updateResult = await transaction.passwordResetToken.updateMany({
          where: {
            tokenHash: input.tokenHash,
            usedAt: null,
            invalidatedAt: null,
          },
          data: {
            invalidatedAt,
          },
        });

        if (updateResult.count !== 1) {
          return false;
        }

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Recuperação de senha invalidada",
            entity: `User ${token.userId}`,
            note: input.note,
          },
        });

        return true;
      });
    },
    async acceptAccountInvitation(input) {
      return prisma.$transaction(async (transaction) => {
        const now = new Date();
        const invitation = await transaction.accountInvitation.findUnique({
          where: {
            tokenHash: input.tokenHash,
          },
        });

        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.invalidatedAt ||
          invitation.expiresAt.getTime() <= now.getTime()
        ) {
          return { status: "invalid_invitation" } satisfies AcceptAccountInvitationResult;
        }

        const acceptedAt = new Date(input.passwordChangedAt);
        const consumeResult = await transaction.accountInvitation.updateMany({
          where: {
            tokenHash: input.tokenHash,
            acceptedAt: null,
            invalidatedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            acceptedAt,
          },
        });

        if (consumeResult.count !== 1) {
          return { status: "invalid_invitation" } satisfies AcceptAccountInvitationResult;
        }

        const updatedUser = await transaction.user.update({
          where: {
            id: invitation.userId,
          },
          data: {
            passwordHash: input.passwordHash,
            accountActivatedAt: acceptedAt,
            mustChangePassword: false,
            passwordChangedAt: acceptedAt,
            temporaryPasswordGeneratedAt: null,
          },
        });

        await transaction.accountInvitation.updateMany({
          where: {
            userId: invitation.userId,
            id: {
              not: invitation.id,
            },
            acceptedAt: null,
            invalidatedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            invalidatedAt: acceptedAt,
          },
        });

        await revokeActiveSessionsWithPrisma(transaction, invitation.userId, acceptedAt);

        await transaction.auditLog.create({
          data: {
            actorName: input.actorName,
            actorRole: toPrismaUserRole(input.actorRole),
            action: "Convite de acesso aceito",
            entity: `User ${updatedUser.id}`,
            note: "Conta ativada com nova senha definida pelo participante.",
          },
        });

        return {
          status: "updated",
          user: mapPrismaUser(updatedUser),
        } satisfies AcceptAccountInvitationResult;
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
  memoryAccountInvitations = [];
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

export const getMemoryAccountInvitations = () => {
  return memoryAccountInvitations.map(cloneStoredAccountInvitation);
};

export const createAuthRepository = (): AuthRepository => {
  if (env.nodeEnv === "test") {
    return createMemoryAuthRepository();
  }

  return env.databaseUrl ? createPrismaAuthRepository() : createMemoryAuthRepository();
};
