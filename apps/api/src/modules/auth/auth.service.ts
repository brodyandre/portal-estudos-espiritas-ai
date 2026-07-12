import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "node:crypto";

import { buildTemporaryPassword } from "../enrollments/student-access.service";
import {
  assertAdminPasswordResetRateLimit,
  assertLoginRateLimit,
  assertPasswordChangeRateLimit,
  clearLoginRateLimit,
  clearPasswordChangeRateLimit,
  resetAuthRateLimitStore,
  recordAdminPasswordResetAttempt,
  recordFailedLoginAttempt,
  recordFailedPasswordChangeAttempt,
} from "../../security/auth-rate-limit";
import { AppError } from "../../lib/app-error";
import { env } from "../../config/env";
import type { UserRole } from "../../auth/types";
import {
  createAuthRepository,
  createMemoryAuthRepository,
  resetMemoryAuthRepositoryStore,
  toAuthUser,
  type AuthRepository,
} from "./auth.repository";
import type {
  AdminResetPasswordPersistenceInput,
  AuthTokenPayload,
  AuthUser,
  ChangePasswordInput,
  ChangePasswordPersistenceInput,
  LoginInput,
  LoginResponse,
  StoredAuthUser,
  StoredAuthSession,
  StudentAccessProvisionInput,
  StudentAccessProvisionResult,
} from "./auth.types";

let authRepository: AuthRepository = createAuthRepository();

const INVALID_LOGIN_MESSAGE = "E-mail ou senha inválidos.";
export const PASSWORD_MAX_LENGTH = 128;
const AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60;
const PASSWORD_POLICY_MESSAGE =
  "Use pelo menos 8 caracteres, com letra maiúscula, letra minúscula e número.";

const normalizeLoginInput = (input: LoginInput): LoginInput => {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
};

const buildTokenPayload = (user: AuthUser): Omit<AuthTokenPayload, "jti" | "iat"> => {
  return {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt ?? null,
  };
};

const buildSessionExpiry = () => {
  return new Date(Date.now() + AUTH_TOKEN_TTL_SECONDS * 1000).toISOString();
};

const summarizeUserAgent = (userAgent?: string) => {
  if (!userAgent) {
    return null;
  }

  return userAgent.replace(/\s+/gu, " ").trim().slice(0, 160) || null;
};

const hashIpAddress = (ipAddress?: string) => {
  if (!ipAddress || ipAddress === "unknown") {
    return null;
  }

  return createHash("sha256").update(`${env.jwtSecret}:${ipAddress}`).digest("hex");
};

const buildSessionMetadata = (options?: {
  ipAddress?: string;
  userAgent?: string;
}) => {
  return {
    userAgentSummary: summarizeUserAgent(options?.userAgent),
    ipHash: hashIpAddress(options?.ipAddress),
  };
};

export const signAuthToken = (user: AuthUser, sessionId: string) => {
  return jwt.sign(buildTokenPayload(user), env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "8h",
    jwtid: sessionId,
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
};

const buildSessionContext = (options?: { ipAddress?: string; userAgent?: string }) => {
  return {
    sessionId: randomUUID(),
    expiresAt: buildSessionExpiry(),
    ...buildSessionMetadata(options),
  };
};

export const loginUser = async (
  input: LoginInput,
  options?: {
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<LoginResponse> => {
  const normalizedInput = normalizeLoginInput(input);
  const ipAddress = options?.ipAddress ?? "unknown";

  assertLoginRateLimit(ipAddress, normalizedInput.email);
  const storedUser = await authRepository.getByEmail(normalizedInput.email);

  if (!storedUser) {
    recordFailedLoginAttempt(ipAddress, normalizedInput.email);
    throw new AppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: INVALID_LOGIN_MESSAGE,
    });
  }

  const isValidPassword = await bcrypt.compare(normalizedInput.password, storedUser.passwordHash);

  if (!isValidPassword) {
    recordFailedLoginAttempt(ipAddress, normalizedInput.email);
    throw new AppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: INVALID_LOGIN_MESSAGE,
    });
  }

  if (storedUser.status !== "active") {
    throw new AppError({
      statusCode: 403,
      code: "USER_INACTIVE",
      message: "Este acesso local ainda não está liberado.",
    });
  }

  const user = toAuthUser(storedUser);
  clearLoginRateLimit(ipAddress, normalizedInput.email);
  const sessionContext = buildSessionContext(options);
  const token = signAuthToken(user, sessionContext.sessionId);

  await authRepository.createSession({
    sessionId: sessionContext.sessionId,
    userId: user.id,
    expiresAt: sessionContext.expiresAt,
    userAgentSummary: sessionContext.userAgentSummary,
    ipHash: sessionContext.ipHash,
  });

  return {
    token,
    user,
  };
};

export const getAuthenticatedUser = async (userId: string): Promise<AuthUser | null> => {
  const storedUser = await authRepository.getById(userId);

  if (!storedUser || storedUser.status !== "active") {
    return null;
  }

  return toAuthUser(storedUser);
};

export const getAuthenticatedUserFromTokenPayload = async (
  payload: AuthTokenPayload,
  options?: {
    allowRevokedSession?: boolean;
  },
): Promise<{ user: AuthUser; session: StoredAuthSession } | null> => {
  if (!payload.jti) {
    return null;
  }

  const session = await authRepository.getSessionById(payload.jti);

  if (
    !session ||
    session.userId !== payload.sub ||
    (session.revokedAt && !options?.allowRevokedSession)
  ) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const storedUser = await authRepository.getById(payload.sub);

  if (!storedUser || storedUser.status !== "active") {
    return null;
  }

  const currentPasswordChangedAt = storedUser.passwordChangedAt ?? null;
  const tokenPasswordChangedAt = payload.passwordChangedAt ?? null;

  if (currentPasswordChangedAt !== tokenPasswordChangedAt) {
    return null;
  }

  if (!session.revokedAt) {
    await authRepository.touchSession(session.id);
  }

  return {
    user: toAuthUser(storedUser),
    session,
  };
};

const validatePasswordPolicy = (password: string) => {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/u.test(password);
  const hasLowercase = /[a-z]/u.test(password);
  const hasDigit = /\d/u.test(password);

  return hasMinLength && hasUppercase && hasLowercase && hasDigit;
};

export const changePassword = async (
  authUser: AuthUser,
  currentSession: StoredAuthSession,
  input: ChangePasswordInput,
  options?: {
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<LoginResponse> => {
  assertPasswordChangeRateLimit(authUser.id);
  const storedUser = await authRepository.getById(authUser.id);

  if (!storedUser || storedUser.status !== "active") {
    throw new AppError({
      statusCode: 401,
      code: "AUTH_REQUIRED",
      message: "Faça login no ambiente local para continuar.",
    });
  }

  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  const confirmPassword = input.confirmPassword;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PASSWORD_CHANGE_INPUT",
      message: "Preencha a senha atual, a nova senha e a confirmação.",
    });
  }

  if (
    currentPassword.length > PASSWORD_MAX_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH ||
    confirmPassword.length > PASSWORD_MAX_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PASSWORD_CHANGE_INPUT",
      message: `Cada senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    });
  }

  if (newPassword !== confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "A confirmação da nova senha não confere.",
    });
  }

  const isValidCurrentPassword = await bcrypt.compare(currentPassword, storedUser.passwordHash);

  if (!isValidCurrentPassword) {
    recordFailedPasswordChangeAttempt(authUser.id);
    throw new AppError({
      statusCode: 401,
      code: "CURRENT_PASSWORD_INVALID",
      message: "A senha atual informada não confere.",
    });
  }

  const isReusedPassword = await bcrypt.compare(newPassword, storedUser.passwordHash);

  if (isReusedPassword) {
    throw new AppError({
      statusCode: 400,
      code: "PASSWORD_REUSE_NOT_ALLOWED",
      message: "Escolha uma nova senha diferente da atual.",
    });
  }

  if (!validatePasswordPolicy(newPassword)) {
    throw new AppError({
      statusCode: 400,
      code: "WEAK_PASSWORD",
      message: PASSWORD_POLICY_MESSAGE,
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const passwordChangedAt = new Date().toISOString();
  const nextSession = buildSessionContext(options);
  const nextUser: AuthUser = {
    ...toAuthUser(storedUser),
    mustChangePassword: false,
    passwordChangedAt,
  };
  const token = signAuthToken(nextUser, nextSession.sessionId);
  const persistedResult = await authRepository.changePassword({
    userId: storedUser.id,
    passwordHash,
    passwordChangedAt,
    actorName: storedUser.fullName,
    actorRole: storedUser.role,
    currentSessionId: currentSession.id,
    newSessionId: nextSession.sessionId,
    newSessionExpiresAt: nextSession.expiresAt,
    newSessionUserAgentSummary: nextSession.userAgentSummary,
    newSessionIpHash: nextSession.ipHash,
  } satisfies ChangePasswordPersistenceInput);

  if (!persistedResult) {
    throw new AppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "Não foi possível localizar este usuário no ambiente local.",
    });
  }

  const user = toAuthUser(persistedResult.user);
  clearPasswordChangeRateLimit(authUser.id);

  return {
    token,
    user,
  };
};

export const resetPasswordByAdmin = async (
  authUser: AuthUser,
  targetUserId: string,
): Promise<{
  user: Pick<
    StoredAuthUser,
    "id" | "fullName" | "email" | "role" | "status" | "mustChangePassword" | "temporaryPasswordGeneratedAt"
  >;
  temporaryPassword: string;
}> => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  if (authUser.id === targetUserId) {
    throw new AppError({
      statusCode: 400,
      code: "SELF_PASSWORD_RESET_NOT_ALLOWED",
      message: "Use o fluxo normal de troca de senha para atualizar o próprio acesso.",
    });
  }

  assertAdminPasswordResetRateLimit(authUser.id, targetUserId);
  recordAdminPasswordResetAttempt(authUser.id, targetUserId);

  const storedUser = await authRepository.getById(targetUserId);

  if (!storedUser) {
    throw new AppError({
      statusCode: 404,
      code: "ADMIN_USER_NOT_FOUND",
      message: "Usuário não encontrado para redefinição administrativa de senha.",
    });
  }

  const temporaryPassword = buildTemporaryPassword(storedUser.fullName);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const credentialChangedAt = new Date().toISOString();

  const persistedUser = await authRepository.resetPasswordByAdmin({
    userId: storedUser.id,
    passwordHash,
    temporaryPasswordGeneratedAt: credentialChangedAt,
    passwordChangedAt: credentialChangedAt,
    actorName: authUser.fullName,
    actorRole: authUser.role,
  } satisfies AdminResetPasswordPersistenceInput);

  if (!persistedUser) {
    throw new AppError({
      statusCode: 404,
      code: "ADMIN_USER_NOT_FOUND",
      message: "Usuário não encontrado para redefinição administrativa de senha.",
    });
  }

  return {
    user: {
      id: persistedUser.id,
      fullName: persistedUser.fullName,
      email: persistedUser.email,
      role: persistedUser.role,
      status: persistedUser.status,
      mustChangePassword: true,
      temporaryPasswordGeneratedAt: persistedUser.temporaryPasswordGeneratedAt ?? credentialChangedAt,
    },
    temporaryPassword,
  };
};

export const userHasAnyRole = (user: AuthUser, roles: UserRole[]) => {
  return roles.includes(user.role);
};

export const logoutCurrentSession = async (authUser: AuthUser, sessionId: string) => {
  await authRepository.revokeSession({
    sessionId,
    actorName: authUser.fullName,
    actorRole: authUser.role,
    action: "Sessão encerrada",
    note: "Sessão local encerrada pelo usuário.",
  });
};

export const logoutAllSessions = async (authUser: AuthUser) => {
  return authRepository.revokeAllSessionsForUser({
    userId: authUser.id,
    actorName: authUser.fullName,
    actorRole: authUser.role,
    action: "Sessões encerradas",
    note: "Todas as sessões ativas foram encerradas pelo usuário.",
  });
};

export const provisionStudentAccess = (
  input: StudentAccessProvisionInput,
): Promise<StudentAccessProvisionResult> => {
  return authRepository.provisionStudentAccess(input);
};

export const resetAuthStore = () => {
  resetMemoryAuthRepositoryStore();
  resetAuthRateLimitStore();
  authRepository = createMemoryAuthRepository();
};

export const setAuthRepositoryForTesting = (repository: AuthRepository) => {
  authRepository = repository;
};
