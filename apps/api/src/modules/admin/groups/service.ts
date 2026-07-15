import { hasRole } from "../../../auth/roles";
import { AppError } from "../../../lib/app-error";
import { createAuthRepository, type AuthRepository } from "../../auth/auth.repository";
import type { AuthUser } from "../../auth/auth.types";
import type { ListAdminGroupsInput, ListAdminGroupsResult } from "./types";

let authRepository: AuthRepository = createAuthRepository();

export const listAdminGroups = async (
  authUser: AuthUser | undefined,
  input: ListAdminGroupsInput,
): Promise<ListAdminGroupsResult> => {
  if (!authUser) {
    throw new AppError({
      statusCode: 401,
      code: "AUTH_REQUIRED",
      message: "Faça login no ambiente local para continuar.",
    });
  }

  if (!hasRole(authUser, "admin")) {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  return authRepository.listAdminGroups(input);
};

export const setAdminGroupsAuthRepositoryForTesting = (repository: AuthRepository) => {
  authRepository = repository;
};

export const resetAdminGroupsAuthRepositoryForTesting = () => {
  authRepository = createAuthRepository();
};
