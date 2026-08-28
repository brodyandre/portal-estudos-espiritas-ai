import {
  assertAdminPedagogicalGroupRateLimit,
  assertAdminUserGroupRateLimit,
  recordAdminPedagogicalGroupAttempt,
  recordAdminUserGroupAttempt,
} from "../../../security/auth-rate-limit";
import { hasRole } from "../../../auth/roles";
import { AppError } from "../../../lib/app-error";
import type { AuthUser } from "../../auth/auth.types";
import {
  createAdminUserTeacherGroupsRepository,
  type AdminUserTeacherGroupsRepository,
  type AdminUserTeacherGroupsRepositoryResult,
  type AdminUserTeacherGroupsUpdateResult,
} from "./teacher-groups.repository";
import type {
  AdminUserTeacherGroupsResult,
  UpdateAdminUserTeacherGroupsInput,
} from "./types";

let repository: AdminUserTeacherGroupsRepository =
  createAdminUserTeacherGroupsRepository();

const assertAdminActor = (authUser: AuthUser | undefined) => {
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
      code: "ADMIN_USER_TEACHER_GROUPS_ACTOR_NOT_AUTHORIZED",
      message: "Seu perfil não pode alterar grupos de professores.",
    });
  }

  return authUser;
};

const mapRepositoryListResult = (
  result: AdminUserTeacherGroupsRepositoryResult,
): AdminUserTeacherGroupsResult => {
  switch (result.status) {
    case "found":
      return {
        user: {
          id: result.userId,
          groups: result.groups,
        },
      };
    case "actor_not_authorized":
      throw new AppError({
        statusCode: 403,
        code: "ADMIN_USER_TEACHER_GROUPS_ACTOR_NOT_AUTHORIZED",
        message: "Seu perfil não pode consultar grupos deste professor.",
      });
    case "not_found":
      throw new AppError({
        statusCode: 404,
        code: "ADMIN_USER_NOT_FOUND",
        message: "Professor não encontrado para consulta administrativa de grupos.",
      });
    case "target_not_teacher":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_TEACHER_GROUPS_TARGET_NOT_TEACHER",
        message: "Somente usuários com papel de professor podem receber múltiplos grupos.",
      });
    case "target_not_pedagogical_role":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_PEDAGOGICAL_GROUPS_TARGET_NOT_ALLOWED",
        message: "Somente professores e administradores podem receber escopo pedagógico explícito.",
      });
  }
};

const mapRepositoryUpdateResult = (
  result: AdminUserTeacherGroupsUpdateResult,
): AdminUserTeacherGroupsResult => {
  switch (result.status) {
    case "updated":
    case "unchanged":
      return {
        user: {
          id: result.userId,
          groups: result.groups,
        },
      };
    case "actor_not_authorized":
      throw new AppError({
        statusCode: 403,
        code: "ADMIN_USER_TEACHER_GROUPS_ACTOR_NOT_AUTHORIZED",
        message: "Seu perfil não pode alterar grupos deste professor.",
      });
    case "not_found":
      throw new AppError({
        statusCode: 404,
        code: "ADMIN_USER_NOT_FOUND",
        message: "Professor não encontrado para atualização administrativa de grupos.",
      });
    case "target_not_teacher":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_TEACHER_GROUPS_TARGET_NOT_TEACHER",
        message: "Somente usuários com papel de professor podem receber múltiplos grupos.",
      });
    case "target_not_pedagogical_role":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_PEDAGOGICAL_GROUPS_TARGET_NOT_ALLOWED",
        message: "Somente professores e administradores podem receber escopo pedagógico explícito.",
      });
    case "group_not_found":
      throw new AppError({
        statusCode: 404,
        code: "ADMIN_USER_TEACHER_GROUP_NOT_FOUND",
        message: "Grupo não encontrado para atualização administrativa do professor.",
      });
    case "group_inactive":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_TEACHER_GROUP_INACTIVE",
        message: "Grupo inativo não pode ser vinculado ao professor.",
      });
    case "book_access_unavailable":
      throw new AppError({
        statusCode: 503,
        code: "ADMIN_PEDAGOGICAL_BOOK_ACCESS_UNAVAILABLE",
        message: "Livro pedagógico indisponível para este grupo.",
      });
    case "conflict":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_USER_TEACHER_GROUPS_CONFLICT",
        message: "Não foi possível concluir a alteração dos grupos do professor agora.",
      });
  }
};

export const listAdminUserTeacherGroups = async (
  authUser: AuthUser | undefined,
  targetUserId: string,
): Promise<AdminUserTeacherGroupsResult> => {
  const actor = assertAdminActor(authUser);

  return mapRepositoryListResult(
    await repository.listByUserId(actor.id, targetUserId),
  );
};

export const updateAdminUserTeacherGroups = async (
  authUser: AuthUser | undefined,
  targetUserId: string,
  input: UpdateAdminUserTeacherGroupsInput,
): Promise<AdminUserTeacherGroupsResult> => {
  const actor = assertAdminActor(authUser);

  assertAdminUserGroupRateLimit(actor.id, `${targetUserId}:teacher-groups`);
  recordAdminUserGroupAttempt(actor.id, `${targetUserId}:teacher-groups`);

  return mapRepositoryUpdateResult(
    await repository.replaceForUser({
      actorUserId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      targetUserId,
      groupIds: input.groupIds,
    }),
  );
};

export const listAdminUserPedagogicalGroups = async (
  authUser: AuthUser | undefined,
  targetUserId: string,
): Promise<AdminUserTeacherGroupsResult> => {
  const actor = assertAdminActor(authUser);

  return mapRepositoryListResult(
    await repository.listByUserId(actor.id, targetUserId, {
      allowedTargetRoles: ["teacher", "admin"],
    }),
  );
};

export const updateAdminUserPedagogicalGroups = async (
  authUser: AuthUser | undefined,
  targetUserId: string,
  input: UpdateAdminUserTeacherGroupsInput,
): Promise<AdminUserTeacherGroupsResult> => {
  const actor = assertAdminActor(authUser);

  assertAdminPedagogicalGroupRateLimit(actor.id, targetUserId);
  recordAdminPedagogicalGroupAttempt(actor.id, targetUserId);

  return mapRepositoryUpdateResult(
    await repository.replaceForUser({
      actorUserId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      targetUserId,
      groupIds: input.groupIds,
      allowedTargetRoles: ["teacher", "admin"],
      auditAction: "Escopo pedagogico alterado por admin",
    }),
  );
};

export const setAdminUserTeacherGroupsRepositoryForTesting = (
  nextRepository: AdminUserTeacherGroupsRepository,
) => {
  repository = nextRepository;
};

export const resetAdminUserTeacherGroupsRepositoryForTesting = () => {
  repository = createAdminUserTeacherGroupsRepository();
};
