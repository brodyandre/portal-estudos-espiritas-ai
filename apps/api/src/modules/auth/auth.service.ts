import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
  AuthTokenPayload,
  AuthUser,
  LoginInput,
  LoginResponse,
  StudentAccessProvisionInput,
  StudentAccessProvisionResult,
} from "./auth.types";

let authRepository: AuthRepository = createAuthRepository();

const INVALID_LOGIN_MESSAGE = "E-mail ou senha inválidos.";

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
