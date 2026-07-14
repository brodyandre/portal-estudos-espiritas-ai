import { hasRole } from "../../../auth/roles";
import { AppError } from "../../../lib/app-error";
import { createAuthRepository, type AuthRepository } from "../../auth/auth.repository";
import type { AuthUser } from "../../auth/auth.types";
import { buildAdminUserListItem } from "./presenter";
import type { ListAdminUsersInput, ListAdminUsersResult } from "./types";

const authRepository: AuthRepository = createAuthRepository();

export const listAdminUsers = async (
  authUser: AuthUser | undefined,
  input: ListAdminUsersInput,
): Promise<ListAdminUsersResult> => {
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

  const result = await authRepository.listAdminUsers(input);

  return {
    items: result.records.map(buildAdminUserListItem),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  };
};
