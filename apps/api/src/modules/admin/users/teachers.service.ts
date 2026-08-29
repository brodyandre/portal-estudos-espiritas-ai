import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { hasRole } from "../../../auth/roles";
import { AppError } from "../../../lib/app-error";
import {
  assertAdminTeacherProvisioningRateLimit,
  recordAdminTeacherProvisioningAttempt,
} from "../../../security/auth-rate-limit";
import {
  createAuthRepository,
  type AdminTeacherCreateResult as RepositoryAdminTeacherCreateResult,
  type AuthRepository,
} from "../../auth/auth.repository";
import type { AuthUser } from "../../auth/auth.types";
import type {
  CreateAdminTeacherInput,
  CreateAdminTeacherResult,
} from "./types";

let authRepository: AuthRepository = createAuthRepository();

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
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  return authUser;
};

const buildPlaceholderPasswordHash = async () => {
  const placeholder = randomBytes(48).toString("base64url");
  return bcrypt.hash(placeholder, 10);
};

const mapCreateTeacherResult = (
  result: RepositoryAdminTeacherCreateResult,
): CreateAdminTeacherResult => {
  switch (result.status) {
    case "created":
      return {
        user: {
          id: result.user.id,
          fullName: result.user.fullName,
          role: "teacher",
          status: "active",
          accountActivated: false,
        },
        groups: result.groups,
      };
    case "actor_not_authorized":
      throw new AppError({
        statusCode: 403,
        code: "FORBIDDEN",
        message: "Seu perfil não tem acesso a este recurso.",
      });
    case "email_conflict":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_TEACHER_EMAIL_CONFLICT",
        message: "Já existe usuário cadastrado com este e-mail.",
      });
    case "group_not_found":
      throw new AppError({
        statusCode: 404,
        code: "ADMIN_PEDAGOGICAL_GROUP_NOT_FOUND",
        message: "Grupo pedagógico não encontrado.",
      });
    case "group_inactive":
      throw new AppError({
        statusCode: 409,
        code: "ADMIN_PEDAGOGICAL_GROUP_INACTIVE",
        message: "Grupo pedagógico inativo não pode ser atribuído.",
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
        code: "ADMIN_TEACHER_PROVISIONING_CONFLICT",
        message: "Não foi possível criar o professor agora.",
      });
  }
};

export const createAdminTeacher = async (
  authUser: AuthUser | undefined,
  input: CreateAdminTeacherInput,
): Promise<CreateAdminTeacherResult> => {
  const actor = assertAdminActor(authUser);

  assertAdminTeacherProvisioningRateLimit(actor.id, input.email);
  recordAdminTeacherProvisioningAttempt(actor.id, input.email);

  return mapCreateTeacherResult(
    await authRepository.createAdminTeacher({
      actorUserId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      fullName: input.fullName,
      email: input.email,
      groupIds: input.groupIds,
      placeholderPasswordHash: await buildPlaceholderPasswordHash(),
    }),
  );
};

export const setAdminTeachersAuthRepositoryForTesting = (
  repository: AuthRepository,
) => {
  authRepository = repository;
};

export const resetAdminTeachersAuthRepositoryForTesting = () => {
  authRepository = createAuthRepository();
};
