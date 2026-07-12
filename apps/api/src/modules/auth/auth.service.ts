import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { buildTemporaryPassword } from "../enrollments/student-access.service";
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
  StudentAccessProvisionInput,
  StudentAccessProvisionResult,
} from "./auth.types";

let authRepository: AuthRepository = createAuthRepository();

const INVALID_LOGIN_MESSAGE = "E-mail ou senha inválidos.";
export const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_POLICY_MESSAGE =
  "Use pelo menos 8 caracteres, com letra maiúscula, letra minúscula e número.";

const normalizeLoginInput = (input: LoginInput): LoginInput => {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
};

const buildTokenPayload = (user: AuthUser): AuthTokenPayload => {
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

export const signAuthToken = (user: AuthUser) => {
  return jwt.sign(buildTokenPayload(user), env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "8h",
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
};

export const loginUser = async (input: LoginInput): Promise<LoginResponse> => {
  const normalizedInput = normalizeLoginInput(input);
  const storedUser = await authRepository.getByEmail(normalizedInput.email);

  if (!storedUser) {
    throw new AppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: INVALID_LOGIN_MESSAGE,
    });
  }

  const isValidPassword = await bcrypt.compare(normalizedInput.password, storedUser.passwordHash);

  if (!isValidPassword) {
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

  return {
    token: signAuthToken(user),
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
): Promise<AuthUser | null> => {
  const storedUser = await authRepository.getById(payload.sub);

  if (!storedUser || storedUser.status !== "active") {
    return null;
  }

  const currentPasswordChangedAt = storedUser.passwordChangedAt ?? null;
  const tokenPasswordChangedAt = payload.passwordChangedAt ?? null;

  if (currentPasswordChangedAt !== tokenPasswordChangedAt) {
    return null;
  }

  return toAuthUser(storedUser);
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
  input: ChangePasswordInput,
): Promise<LoginResponse> => {
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
  const persistedUser = await authRepository.changePassword({
    userId: storedUser.id,
    passwordHash,
    actorName: storedUser.fullName,
    actorRole: storedUser.role,
  } satisfies ChangePasswordPersistenceInput);

  if (!persistedUser) {
    throw new AppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "Não foi possível localizar este usuário no ambiente local.",
    });
  }

  const user = toAuthUser(persistedUser);

  return {
    token: signAuthToken(user),
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

export const provisionStudentAccess = (
  input: StudentAccessProvisionInput,
): Promise<StudentAccessProvisionResult> => {
  return authRepository.provisionStudentAccess(input);
};

export const resetAuthStore = () => {
  resetMemoryAuthRepositoryStore();
  authRepository = createMemoryAuthRepository();
};

export const setAuthRepositoryForTesting = (repository: AuthRepository) => {
  authRepository = repository;
};
