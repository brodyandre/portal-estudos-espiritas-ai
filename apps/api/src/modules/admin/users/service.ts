import { hasRole } from "../../../auth/roles";
import {
  assertAdminUserGroupRateLimit,
  assertAdminUserStatusRateLimit,
  recordAdminUserGroupAttempt,
  recordAdminUserStatusAttempt,
} from "../../../security/auth-rate-limit";
import { AppError } from "../../../lib/app-error";
import {
  createAuthRepository,
  type AdminUserGroupUpdateResult as RepositoryAdminUserGroupUpdateResult,
  type AuthRepository,
} from "../../auth/auth.repository";
import type { AuthUser } from "../../auth/auth.types";
import { buildAdminUserGroupSummary, buildAdminUserListItem } from "./presenter";
import type {
  ListAdminUsersInput,
  ListAdminUsersResult,
  UpdateAdminUserGroupInput,
  UpdateAdminUserGroupResult,
  UpdateAdminUserStatusInput,
  UpdateAdminUserStatusResult,
} from "./types";

let authRepository: AuthRepository = createAuthRepository();

const assertUnhandledAdminUserGroupResult = (
  result: never,
): never => {
  throw new Error(`Resultado administrativo de grupo não tratado: ${JSON.stringify(result)}`);
};

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

export const updateAdminUserStatus = async (
  authUser: AuthUser | undefined,
  targetUserId: string,
  input: UpdateAdminUserStatusInput,
): Promise<UpdateAdminUserStatusResult> => {
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
      code: "ADMIN_USER_STATUS_ACTOR_NOT_AUTHORIZED",
      message: "Seu perfil não pode alterar o status administrativo deste usuário.",
    });
  }

  assertAdminUserStatusRateLimit(authUser.id, targetUserId);
  recordAdminUserStatusAttempt(authUser.id, targetUserId);

  const result = await authRepository.updateAdminUserStatus({
    actorUserId: authUser.id,
    actorName: authUser.fullName,
    actorRole: authUser.role,
    targetUserId,
    nextStatus: input.status,
  });

  if (result.status === "updated") {
    return {
      user: {
        id: result.userId,
        status: result.currentStatus,
      },
      revokedSessions: result.revokedSessions,
    };
  }

  if (result.status === "actor_not_authorized") {
    throw new AppError({
      statusCode: 403,
      code: "ADMIN_USER_STATUS_ACTOR_NOT_AUTHORIZED",
      message: "Seu perfil não pode alterar o status administrativo deste usuário.",
    });
  }

  if (result.status === "not_found") {
    throw new AppError({
      statusCode: 404,
      code: "ADMIN_USER_NOT_FOUND",
      message: "Usuário não encontrado para atualização administrativa de status.",
    });
  }

  if (result.status === "already_set") {
    throw new AppError({
      statusCode: 409,
      code: "ADMIN_USER_STATUS_ALREADY_SET",
      message: "O usuário já está com este status administrativo.",
    });
  }

  if (result.status === "transition_not_allowed") {
    throw new AppError({
      statusCode: 409,
      code: "ADMIN_USER_STATUS_TRANSITION_NOT_ALLOWED",
      message: "Esta transição administrativa de status não é permitida.",
    });
  }

  if (result.status === "account_not_activated") {
    throw new AppError({
      statusCode: 409,
      code: "ADMIN_USER_ACCOUNT_NOT_ACTIVATED",
      message: "A conta ainda não foi ativada e não pode ser habilitada por este endpoint.",
    });
  }

  if (result.status === "self_deactivation_not_allowed") {
    throw new AppError({
      statusCode: 409,
      code: "ADMIN_USER_SELF_DEACTIVATION_NOT_ALLOWED",
      message: "Você não pode inativar a própria conta administrativa.",
    });
  }

  throw new AppError({
    statusCode: 409,
    code: "ADMIN_USER_STATUS_CONFLICT",
    message: "Não foi possível concluir a alteração administrativa de status agora.",
  });
};

export const updateAdminUserGroup = async (
  authUser: AuthUser | undefined,
  targetUserId: string,
  input: UpdateAdminUserGroupInput,
): Promise<UpdateAdminUserGroupResult> => {
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
      code: "ADMIN_USER_GROUP_ACTOR_NOT_AUTHORIZED",
      message: "Seu perfil não pode alterar o grupo administrativo deste usuário.",
    });
  }

  assertAdminUserGroupRateLimit(authUser.id, targetUserId);
  recordAdminUserGroupAttempt(authUser.id, targetUserId);

  const result = await authRepository.updateAdminUserGroup({
    actorUserId: authUser.id,
    actorName: authUser.fullName,
    actorRole: authUser.role,
    targetUserId,
    nextGroupSlug: input.groupSlug,
  });

  return mapAdminUserGroupUpdateResult(result);
};

const mapAdminUserGroupUpdateResult = (
  result: RepositoryAdminUserGroupUpdateResult,
): UpdateAdminUserGroupResult => {
  switch (result.status) {
    case "updated":
      return {
        user: {
          id: result.userId,
          group: buildAdminUserGroupSummary(result.groupName, result.groupSlug),
        },
      };
    case "actor_not_authorized":
      throw new AppError({
        statusCode: 403,
        code: "ADMIN_USER_GROUP_ACTOR_NOT_AUTHORIZED",
        message: "Seu perfil não pode alterar o grupo administrativo deste usuário.",
      });
    case "not_found":
      throw new AppError({
        statusCode: 404,
        code: "ADMIN_USER_NOT_FOUND",
        message: "Usuário não encontrado para atualização administrativa de grupo.",
      });
    case "group_not_found":
      throw new AppError({
        statusCode: 404,
        code: "ADMIN_USER_GROUP_NOT_FOUND",
        message: "Grupo não encontrado para atualização administrativa.",
      });
    case "group_inactive":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_GROUP_INACTIVE",
        message: "Grupo inativo não pode ser associado ao usuário.",
      });
    case "already_set":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_GROUP_ALREADY_SET",
        message: "O usuário já está associado a este grupo.",
      });
    case "already_empty":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_GROUP_ALREADY_EMPTY",
        message: "O usuário já está sem grupo vinculado.",
      });
    case "conflict":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_GROUP_CONFLICT",
        message: "Não foi possível concluir a alteração administrativa de grupo agora.",
      });
    default:
      return assertUnhandledAdminUserGroupResult(result);
  }
};

export const setAdminUsersAuthRepositoryForTesting = (repository: AuthRepository) => {
  authRepository = repository;
};

export const resetAdminUsersAuthRepositoryForTesting = () => {
  authRepository = createAuthRepository();
};
