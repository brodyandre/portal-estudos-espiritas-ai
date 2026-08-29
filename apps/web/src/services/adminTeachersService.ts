import { appConfig } from "../config/appMode";
import type {
  AdminPedagogicalGroupsResult,
  AdminTeacherCreateResult,
  AdminTeacherInvitationResult,
  CreateAdminTeacherInput,
} from "../types/adminTeachers";
import type { AdminUserTeacherGroupSummary } from "../types/adminUsersList";
import { ServiceRequestError, requestJson } from "./api";

interface ApiCreateAdminTeacherData {
  user?: unknown;
  groups?: unknown;
}

interface ApiPedagogicalGroupsData {
  user?: unknown;
}

interface ApiInvitationData {
  user?: unknown;
  invitation?: unknown;
}

const invalidTeacherEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para professores.",
  });

const unavailableInDemoError = (message: string) =>
  new ServiceRequestError({
    kind: "api",
    code: "ADMIN_TEACHERS_UNAVAILABLE_IN_DEMO",
    message,
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isTeacherGroup = (value: unknown): value is AdminUserTeacherGroupSummary => {
  return (
    isRecord(value) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.slug) &&
    (value.status === "active" || value.status === "inactive")
  );
};

const mapTeacherGroups = (value: unknown): AdminUserTeacherGroupSummary[] => {
  if (!Array.isArray(value) || !value.every(isTeacherGroup)) {
    throw invalidTeacherEnvelopeError();
  }

  return value.map((group) => ({
    name: group.name,
    slug: group.slug,
    status: group.status,
  }));
};

const mapCreateTeacherResult = (value: ApiCreateAdminTeacherData): AdminTeacherCreateResult => {
  if (!isRecord(value.user)) {
    throw invalidTeacherEnvelopeError();
  }

  const { id, fullName, role, status, accountActivated } = value.user;

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(fullName) ||
    role !== "teacher" ||
    status !== "active" ||
    accountActivated !== false
  ) {
    throw invalidTeacherEnvelopeError();
  }

  return {
    user: {
      id,
      fullName,
      role,
      status,
      accountActivated,
    },
    groups: mapTeacherGroups(value.groups),
  };
};

const mapPedagogicalGroupsResult = (
  value: ApiPedagogicalGroupsData,
): AdminPedagogicalGroupsResult => {
  if (!isRecord(value.user) || !isNonEmptyString(value.user.id)) {
    throw invalidTeacherEnvelopeError();
  }

  return {
    user: {
      id: value.user.id,
      groups: mapTeacherGroups(value.user.groups),
    },
  };
};

const isDeliveryStatus = (
  value: unknown,
): value is AdminTeacherInvitationResult["invitation"]["deliveryStatus"] => {
  return value === "pending" || value === "sent" || value === "failed" || value === "not_configured";
};

const mapInvitationResult = (value: ApiInvitationData): AdminTeacherInvitationResult => {
  if (!isRecord(value.user) || !isRecord(value.invitation)) {
    throw invalidTeacherEnvelopeError();
  }

  const { id, fullName, email } = value.user;
  const { expiresAt, deliveryStatus, invitationType } = value.invitation;

  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(fullName) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(expiresAt) ||
    !isDeliveryStatus(deliveryStatus) ||
    invitationType !== "admin_reinvite"
  ) {
    throw invalidTeacherEnvelopeError();
  }

  return {
    user: { id, fullName, email },
    invitation: {
      expiresAt,
      deliveryStatus,
      invitationType,
    },
  };
};

const assertLiveAdminMutation = (message: string) => {
  if (appConfig.appMode === "demo" || appConfig.isGithubPages || !appConfig.canUseAdminFeatures) {
    throw unavailableInDemoError(message);
  }
};

export const createAdminTeacher = async (
  input: CreateAdminTeacherInput,
): Promise<AdminTeacherCreateResult> => {
  assertLiveAdminMutation("Cadastro de professor indisponível no modo demonstrativo.");

  const payload = await requestJson<ApiCreateAdminTeacherData>({
    path: "/api/admin/teachers",
    init: {
      method: "POST",
      body: JSON.stringify({
        fullName: input.fullName,
        email: input.email,
        groupIds: input.groupIds,
      }),
    },
  });

  if (!payload.data) {
    throw invalidTeacherEnvelopeError();
  }

  return mapCreateTeacherResult(payload.data);
};

export const getAdminUserPedagogicalGroups = async (
  userId: string,
): Promise<AdminPedagogicalGroupsResult> => {
  const payload = await requestJson<ApiPedagogicalGroupsData>({
    path: `/api/admin/users/${encodeURIComponent(userId)}/pedagogical-groups`,
  });

  if (!payload.data) {
    throw invalidTeacherEnvelopeError();
  }

  return mapPedagogicalGroupsResult(payload.data);
};

export const updateAdminUserPedagogicalGroups = async (
  userId: string,
  input: { groupIds: string[] },
): Promise<AdminPedagogicalGroupsResult> => {
  assertLiveAdminMutation("Alteração de supervisão pedagógica indisponível no modo demonstrativo.");

  const payload = await requestJson<ApiPedagogicalGroupsData>({
    path: `/api/admin/users/${encodeURIComponent(userId)}/pedagogical-groups`,
    init: {
      method: "PUT",
      body: JSON.stringify({ groupIds: input.groupIds }),
    },
  });

  if (!payload.data) {
    throw invalidTeacherEnvelopeError();
  }

  return mapPedagogicalGroupsResult(payload.data);
};

export const sendAdminTeacherInvitation = async (
  userId: string,
): Promise<AdminTeacherInvitationResult> => {
  assertLiveAdminMutation("Envio de convite indisponível no modo demonstrativo.");

  const payload = await requestJson<ApiInvitationData>({
    path: `/api/admin/users/${encodeURIComponent(userId)}/send-invitation`,
    init: {
      method: "POST",
      body: JSON.stringify({}),
    },
  });

  if (!payload.data) {
    throw invalidTeacherEnvelopeError();
  }

  return mapInvitationResult(payload.data);
};
