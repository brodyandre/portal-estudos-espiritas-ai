import { hasRole } from "../../auth/roles";
import { type UserRole } from "../../auth/types";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import type { AuthUser } from "../auth/auth.types";
import {
  DEFAULT_MEMORY_GROUPS,
  StudyMeetingsTransactionConflictError,
  assertValidTimeRange,
  createMemoryStudyMeetingGroupsRepository,
  createMemoryStudyMeetingsAuditRepository,
  createMemoryStudyMeetingsRepository,
  createMemoryStudyMeetingsState,
  createMemoryStudyMeetingsTransactionRunner,
  createPrismaStudyMeetingGroupsRepository,
  createPrismaStudyMeetingsAuditRepository,
  createPrismaStudyMeetingsRepository,
  createPrismaStudyMeetingsTransactionRunner,
  getMemoryStudyMeetingsAuditLogs,
  normalizeOptionalText,
  normalizeTitle,
  type MemoryStudyMeetingsState,
  type StudyMeetingAuditLogEntry,
  type StudyMeetingGroupRecord,
  type StudyMeetingGroupsRepository,
  type StudyMeetingsRepository,
  type StudyMeetingsTransactionalContext,
  type StudyMeetingsTransactionRunner,
} from "./study-meetings.repository";
import type {
  CancelAdminStudyMeetingInput,
  CreateAdminStudyMeetingInput,
  GetAdminStudyMeetingInput,
  StudyMeetingListInput,
  StudyMeetingListResult,
  StudyMeetingRecord,
  UpdateAdminStudyMeetingInput,
} from "./study-meetings.types";
import {
  InvalidStudyMeetingListInputError,
  InvalidStudyMeetingTimeRangeError,
  STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH,
  STUDY_MEETING_DESCRIPTION_MAX_LENGTH,
  STUDY_MEETING_ID_MAX_LENGTH,
  StudyMeetingGroupNotFoundError,
  STUDY_MEETING_TITLE_MAX_LENGTH,
} from "./study-meetings.types";

const AUTH_REQUIRED_MESSAGE = "Faça login no ambiente local para continuar.";
const FORBIDDEN_MESSAGE = "Seu perfil não tem acesso a este recurso.";
const ADMIN_STUDY_MEETING_ACTION_CREATE = "Encontro criado por admin";
const ADMIN_STUDY_MEETING_ACTION_UPDATE = "Encontro atualizado por admin";
const ADMIN_STUDY_MEETING_ACTION_CANCEL = "Encontro cancelado por admin";

export interface StudyMeetingsAdminServiceDependencies {
  readContext: StudyMeetingsTransactionalContext;
  transactionRunner: StudyMeetingsTransactionRunner;
  nowProvider: () => Date;
  memoryState?: MemoryStudyMeetingsState;
}

export interface StudyMeetingsAdminService {
  listMeetings(
    authUser: AuthUser | undefined,
    input: StudyMeetingListInput,
  ): Promise<StudyMeetingListResult>;
  getMeeting(
    authUser: AuthUser | undefined,
    input: GetAdminStudyMeetingInput,
  ): Promise<StudyMeetingRecord>;
  createMeeting(
    authUser: AuthUser | undefined,
    input: CreateAdminStudyMeetingInput,
  ): Promise<StudyMeetingRecord>;
  updateMeeting(
    authUser: AuthUser | undefined,
    input: UpdateAdminStudyMeetingInput,
  ): Promise<StudyMeetingRecord>;
  cancelMeeting(
    authUser: AuthUser | undefined,
    input: CancelAdminStudyMeetingInput,
  ): Promise<StudyMeetingRecord>;
}

type StudyMeetingActor = {
  id: string;
  fullName: string;
  role: UserRole;
};

type NormalizedMeetingMutation = {
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
};

const buildAppError = (
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) => new AppError({ statusCode, code, message, details });

const normalizeIdentifier = (value: string, field: "groupId" | "meetingId") => {
  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.length > STUDY_MEETING_ID_MAX_LENGTH) {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_INPUT",
      "Revise os dados do encontro para continuar.",
      { field },
    );
  }

  return trimmedValue;
};

const normalizeMeetingTitle = (value: string) => {
  let normalizedValue: string;

  try {
    normalizedValue = normalizeTitle(value);
  } catch {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_INPUT",
      "Informe um título válido para o encontro.",
      { field: "title" },
    );
  }

  if (normalizedValue.length > STUDY_MEETING_TITLE_MAX_LENGTH) {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_INPUT",
      `O título do encontro deve ter no máximo ${STUDY_MEETING_TITLE_MAX_LENGTH} caracteres.`,
      { field: "title" },
    );
  }

  return normalizedValue;
};

const normalizeMeetingDescription = (value?: string | null) => {
  const normalizedValue = normalizeOptionalText(value);

  if (
    normalizedValue !== null &&
    normalizedValue.length > STUDY_MEETING_DESCRIPTION_MAX_LENGTH
  ) {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_INPUT",
      `A descrição do encontro deve ter no máximo ${STUDY_MEETING_DESCRIPTION_MAX_LENGTH} caracteres.`,
      { field: "description" },
    );
  }

  return normalizedValue;
};

const normalizeCancellationReason = (value: string | null) => {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_CANCEL_INPUT",
      "Informe um motivo válido para cancelar o encontro.",
      { field: "cancellationReason" },
    );
  }

  if (normalizedValue.length > STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH) {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_CANCEL_INPUT",
      `O motivo do cancelamento deve ter no máximo ${STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH} caracteres.`,
      { field: "cancellationReason" },
    );
  }

  return normalizedValue;
};

const normalizeMeetingTimeRange = (
  startsAt: string | Date,
  endsAt: string | Date,
) => {
  try {
    const normalizedRange = assertValidTimeRange(startsAt, endsAt);

    return {
      startsAt: normalizedRange.startsAt.toISOString(),
      endsAt: normalizedRange.endsAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof InvalidStudyMeetingTimeRangeError || error instanceof TypeError) {
      throw buildAppError(
        400,
        "INVALID_STUDY_MEETING_INPUT",
        "O horário final precisa ser posterior ao horário inicial.",
      );
    }

    throw error;
  }
};

const assertFutureMeetingStart = (startsAtIso: string, now: Date) => {
  if (new Date(startsAtIso).getTime() <= now.getTime()) {
    throw buildAppError(
      409,
      "STUDY_MEETING_STARTS_IN_PAST",
      "O encontro precisa começar em um horário futuro.",
    );
  }
};

const assertAdminActor = (authUser: AuthUser | undefined): StudyMeetingActor => {
  if (!authUser) {
    throw buildAppError(401, "AUTH_REQUIRED", AUTH_REQUIRED_MESSAGE);
  }

  if (!hasRole(authUser, "admin")) {
    throw buildAppError(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  return {
    id: authUser.id,
    fullName: authUser.fullName,
    role: authUser.role,
  };
};

const getRequiredGroup = async (
  groupsRepository: StudyMeetingGroupsRepository,
  groupId: string,
) => {
  const group = await groupsRepository.findById(groupId);

  if (!group) {
    throw buildAppError(
      404,
      "STUDY_GROUP_NOT_FOUND",
      "Grupo não encontrado para este encontro.",
    );
  }

  return group;
};

const assertGroupIsActiveForMutation = (
  group: StudyMeetingGroupRecord,
  operation: "create" | "update",
) => {
  if (group.status !== "active") {
    throw buildAppError(
      409,
      "STUDY_GROUP_INACTIVE",
      operation === "create"
        ? "Grupo inativo não pode receber novos encontros."
        : "Grupo inativo não pode ter encontros atualizados.",
    );
  }
};

const getRequiredMeeting = async (
  meetingsRepository: StudyMeetingsRepository,
  groupId: string,
  meetingId: string,
) => {
  const meeting = await meetingsRepository.findByIdAndGroupId(meetingId, groupId);

  if (!meeting) {
    throw buildAppError(
      404,
      "STUDY_MEETING_NOT_FOUND",
      "Encontro não encontrado para este grupo.",
    );
  }

  return meeting;
};

const buildCreateAuditEntry = (
  actor: StudyMeetingActor,
  meeting: StudyMeetingRecord,
): StudyMeetingAuditLogEntry => ({
  actorName: actor.fullName,
  actorRole: actor.role,
  action: ADMIN_STUDY_MEETING_ACTION_CREATE,
  entity: `StudyMeeting ${meeting.id}`,
  note: `Encontro criado para o grupo ${meeting.groupId}. Inicio em ${meeting.startsAt}. Termino em ${meeting.endsAt}.`,
});

const buildUpdateAuditEntry = (
  actor: StudyMeetingActor,
  meeting: StudyMeetingRecord,
  changedFields: string[],
): StudyMeetingAuditLogEntry => ({
  actorName: actor.fullName,
  actorRole: actor.role,
  action: ADMIN_STUDY_MEETING_ACTION_UPDATE,
  entity: `StudyMeeting ${meeting.id}`,
  note: `Campos alterados no grupo ${meeting.groupId}: ${changedFields.join(", ")}.`,
});

const buildCancelAuditEntry = (
  actor: StudyMeetingActor,
  meeting: StudyMeetingRecord,
): StudyMeetingAuditLogEntry => ({
  actorName: actor.fullName,
  actorRole: actor.role,
  action: ADMIN_STUDY_MEETING_ACTION_CANCEL,
  entity: `StudyMeeting ${meeting.id}`,
  note: `Encontro cancelado no grupo ${meeting.groupId} em ${meeting.canceledAt}. Motivo informado sem expor detalhes sensíveis.`,
});

const normalizeCreateMeetingInput = (
  input: CreateAdminStudyMeetingInput,
  now: Date,
): CreateAdminStudyMeetingInput => {
  const normalizedGroupId = normalizeIdentifier(input.groupId, "groupId");
  const normalizedTitle = normalizeMeetingTitle(input.title);
  const normalizedDescription = normalizeMeetingDescription(input.description);
  const normalizedRange = normalizeMeetingTimeRange(input.startsAt, input.endsAt);

  assertFutureMeetingStart(normalizedRange.startsAt, now);

  return {
    groupId: normalizedGroupId,
    title: normalizedTitle,
    description: normalizedDescription,
    startsAt: normalizedRange.startsAt,
    endsAt: normalizedRange.endsAt,
  };
};

const getUpdateFieldsPresence = (input: UpdateAdminStudyMeetingInput) => ({
  hasTitle: Object.prototype.hasOwnProperty.call(input, "title") && input.title !== undefined,
  hasDescription:
    Object.prototype.hasOwnProperty.call(input, "description") &&
    input.description !== undefined,
  hasStartsAt:
    Object.prototype.hasOwnProperty.call(input, "startsAt") && input.startsAt !== undefined,
  hasEndsAt:
    Object.prototype.hasOwnProperty.call(input, "endsAt") && input.endsAt !== undefined,
});

const normalizeUpdateMeetingInput = (
  input: UpdateAdminStudyMeetingInput,
  currentMeeting: StudyMeetingRecord,
  now: Date,
) => {
  const normalizedGroupId = normalizeIdentifier(input.groupId, "groupId");
  const normalizedMeetingId = normalizeIdentifier(input.meetingId, "meetingId");
  const presence = getUpdateFieldsPresence(input);

  if (!presence.hasTitle && !presence.hasDescription && !presence.hasStartsAt && !presence.hasEndsAt) {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_UPDATE_INPUT",
      "Informe ao menos um campo para atualizar o encontro.",
    );
  }

  const title = presence.hasTitle ? normalizeMeetingTitle(input.title ?? "") : currentMeeting.title;
  const description = presence.hasDescription
    ? normalizeMeetingDescription(input.description)
    : currentMeeting.description;
  const startsAt = presence.hasStartsAt ? input.startsAt ?? currentMeeting.startsAt : currentMeeting.startsAt;
  const endsAt = presence.hasEndsAt ? input.endsAt ?? currentMeeting.endsAt : currentMeeting.endsAt;
  const normalizedRange = normalizeMeetingTimeRange(startsAt, endsAt);

  if (new Date(currentMeeting.startsAt).getTime() <= now.getTime()) {
    throw buildAppError(
      409,
      "STUDY_MEETING_ALREADY_STARTED",
      "Encontro já iniciado não pode ser alterado.",
    );
  }

  if (new Date(normalizedRange.startsAt).getTime() <= now.getTime()) {
    throw buildAppError(
      409,
      "STUDY_MEETING_STARTS_IN_PAST",
      "O encontro precisa começar em um horário futuro.",
    );
  }

  const changedFields: string[] = [];

  if (title !== currentMeeting.title) {
    changedFields.push("title");
  }

  if (description !== currentMeeting.description) {
    changedFields.push("description");
  }

  if (normalizedRange.startsAt !== currentMeeting.startsAt) {
    changedFields.push("startsAt");
  }

  if (normalizedRange.endsAt !== currentMeeting.endsAt) {
    changedFields.push("endsAt");
  }

  if (changedFields.length === 0) {
    throw buildAppError(
      409,
      "STUDY_MEETING_NO_CHANGES",
      "Informe ao menos uma alteração diferente da versão atual do encontro.",
    );
  }

  return {
    input: {
      groupId: normalizedGroupId,
      meetingId: normalizedMeetingId,
      title,
      description,
      startsAt: normalizedRange.startsAt,
      endsAt: normalizedRange.endsAt,
    },
    changedFields,
  };
};

const normalizeCancelMeetingInput = (
  input: CancelAdminStudyMeetingInput,
) => {
  return {
    groupId: normalizeIdentifier(input.groupId, "groupId"),
    meetingId: normalizeIdentifier(input.meetingId, "meetingId"),
    cancellationReason: normalizeCancellationReason(input.cancellationReason),
  };
};

const createDefaultStudyMeetingsAdminServiceDependencies =
  (): StudyMeetingsAdminServiceDependencies => {
    const nowProvider = () => new Date(Date.now());

    if (env.nodeEnv === "test" || !env.databaseUrl) {
      const memoryState = createMemoryStudyMeetingsState({
        groups: DEFAULT_MEMORY_GROUPS,
        meetings: [],
      });

      return {
        readContext: {
          meetingsRepository: createMemoryStudyMeetingsRepository({
            state: memoryState,
            nowProvider,
          }),
          groupsRepository: createMemoryStudyMeetingGroupsRepository({
            state: memoryState,
          }),
          auditRepository: createMemoryStudyMeetingsAuditRepository(memoryState),
        },
        transactionRunner: createMemoryStudyMeetingsTransactionRunner(memoryState, {
          nowProvider,
        }),
        nowProvider,
        memoryState,
      };
    }

    return {
      readContext: {
        meetingsRepository: createPrismaStudyMeetingsRepository(),
        groupsRepository: createPrismaStudyMeetingGroupsRepository(),
        auditRepository: createPrismaStudyMeetingsAuditRepository(),
      },
      transactionRunner: createPrismaStudyMeetingsTransactionRunner(),
      nowProvider,
    };
  };

const mapServiceError = (error: unknown): never => {
  if (error instanceof AppError) {
    throw error;
  }

  if (
    error instanceof StudyMeetingGroupNotFoundError ||
    error instanceof InvalidStudyMeetingListInputError
  ) {
    throw buildAppError(
      error instanceof StudyMeetingGroupNotFoundError ? 404 : 400,
      error instanceof StudyMeetingGroupNotFoundError
        ? "STUDY_GROUP_NOT_FOUND"
        : "INVALID_STUDY_MEETING_LIST_INPUT",
      error instanceof StudyMeetingGroupNotFoundError
        ? "Grupo não encontrado para este encontro."
        : "Revise os filtros da agenda para continuar.",
    );
  }

  if (
    error instanceof InvalidStudyMeetingTimeRangeError ||
    error instanceof TypeError
  ) {
    throw buildAppError(
      400,
      "INVALID_STUDY_MEETING_INPUT",
      "Revise os dados do encontro para continuar.",
    );
  }

  if (error instanceof StudyMeetingsTransactionConflictError) {
    throw buildAppError(
      409,
      "STUDY_MEETING_CONFLICT",
      "Não foi possível concluir a operação do encontro agora.",
    );
  }

  throw error;
};

export const createStudyMeetingsAdminService = (
  dependencies: StudyMeetingsAdminServiceDependencies = createDefaultStudyMeetingsAdminServiceDependencies(),
): StudyMeetingsAdminService => {
  return {
    async listMeetings(authUser, input) {
      assertAdminActor(authUser);

      try {
        const normalizedGroupId = normalizeIdentifier(input.groupId, "groupId");
        await getRequiredGroup(dependencies.readContext.groupsRepository, normalizedGroupId);

        return await dependencies.readContext.meetingsRepository.listByGroupId({
          ...input,
          groupId: normalizedGroupId,
        });
      } catch (error) {
        return mapServiceError(error);
      }
    },

    async getMeeting(authUser, input) {
      assertAdminActor(authUser);

      try {
        const normalizedGroupId = normalizeIdentifier(input.groupId, "groupId");
        const normalizedMeetingId = normalizeIdentifier(input.meetingId, "meetingId");

        await getRequiredGroup(dependencies.readContext.groupsRepository, normalizedGroupId);

        return await getRequiredMeeting(
          dependencies.readContext.meetingsRepository,
          normalizedGroupId,
          normalizedMeetingId,
        );
      } catch (error) {
        return mapServiceError(error);
      }
    },

    async createMeeting(authUser, input) {
      const actor = assertAdminActor(authUser);
      const now = dependencies.nowProvider();

      try {
        const normalizedInput = normalizeCreateMeetingInput(input, now);

        return await dependencies.transactionRunner.run(async (context) => {
          const group = await getRequiredGroup(context.groupsRepository, normalizedInput.groupId);
          assertGroupIsActiveForMutation(group, "create");

          const createdMeeting = await context.meetingsRepository.create(normalizedInput);
          await context.auditRepository.create(
            buildCreateAuditEntry(actor, createdMeeting),
          );

          return createdMeeting;
        });
      } catch (error) {
        return mapServiceError(error);
      }
    },

    async updateMeeting(authUser, input) {
      const actor = assertAdminActor(authUser);
      const now = dependencies.nowProvider();

      try {
        return await dependencies.transactionRunner.run(async (context) => {
          const normalizedGroupId = normalizeIdentifier(input.groupId, "groupId");
          const normalizedMeetingId = normalizeIdentifier(input.meetingId, "meetingId");
          const group = await getRequiredGroup(context.groupsRepository, normalizedGroupId);
          assertGroupIsActiveForMutation(group, "update");
          const currentMeeting = await getRequiredMeeting(
            context.meetingsRepository,
            normalizedGroupId,
            normalizedMeetingId,
          );

          if (currentMeeting.canceledAt) {
            throw buildAppError(
              409,
              "STUDY_MEETING_ALREADY_CANCELED",
              "Encontro já cancelado não pode ser alterado.",
            );
          }

          const normalizedUpdate = normalizeUpdateMeetingInput(
            {
              ...input,
              groupId: normalizedGroupId,
              meetingId: normalizedMeetingId,
            },
            currentMeeting,
            now,
          );
          const updatedMeeting = await context.meetingsRepository.update(
            normalizedUpdate.input,
          );

          if (!updatedMeeting) {
            throw buildAppError(
              409,
              "STUDY_MEETING_CONFLICT",
              "Não foi possível concluir a atualização do encontro agora.",
            );
          }

          if (updatedMeeting.canceledAt) {
            throw buildAppError(
              409,
              "STUDY_MEETING_ALREADY_CANCELED",
              "Encontro já cancelado não pode ser alterado.",
            );
          }

          await context.auditRepository.create(
            buildUpdateAuditEntry(actor, updatedMeeting, normalizedUpdate.changedFields),
          );

          return updatedMeeting;
        });
      } catch (error) {
        return mapServiceError(error);
      }
    },

    async cancelMeeting(authUser, input) {
      const actor = assertAdminActor(authUser);
      const now = dependencies.nowProvider();

      try {
        const normalizedInput = normalizeCancelMeetingInput(input);

        return await dependencies.transactionRunner.run(async (context) => {
          await getRequiredGroup(context.groupsRepository, normalizedInput.groupId);
          const currentMeeting = await getRequiredMeeting(
            context.meetingsRepository,
            normalizedInput.groupId,
            normalizedInput.meetingId,
          );

          if (currentMeeting.canceledAt) {
            throw buildAppError(
              409,
              "STUDY_MEETING_ALREADY_CANCELED",
              "Encontro já cancelado não pode ser cancelado novamente.",
            );
          }

          if (new Date(currentMeeting.endsAt).getTime() <= now.getTime()) {
            throw buildAppError(
              409,
              "STUDY_MEETING_ALREADY_ENDED",
              "Encontro encerrado não pode ser cancelado.",
            );
          }

          const canceledMeeting = await context.meetingsRepository.cancel({
            meetingId: normalizedInput.meetingId,
            groupId: normalizedInput.groupId,
            canceledAt: now.toISOString(),
            cancellationReason: normalizedInput.cancellationReason,
          });

          if (!canceledMeeting) {
            throw buildAppError(
              409,
              "STUDY_MEETING_CONFLICT",
              "Não foi possível concluir o cancelamento do encontro agora.",
            );
          }

          if (canceledMeeting.canceledAt !== now.toISOString()) {
            throw buildAppError(
              409,
              "STUDY_MEETING_ALREADY_CANCELED",
              "Encontro já cancelado não pode ser cancelado novamente.",
            );
          }

          await context.auditRepository.create(
            buildCancelAuditEntry(actor, canceledMeeting),
          );

          return canceledMeeting;
        });
      } catch (error) {
        return mapServiceError(error);
      }
    },
  };
};

let studyMeetingsAdminServiceDependencies =
  createDefaultStudyMeetingsAdminServiceDependencies();
let studyMeetingsAdminService = createStudyMeetingsAdminService(
  studyMeetingsAdminServiceDependencies,
);

export const listAdminStudyMeetings = (
  authUser: AuthUser | undefined,
  input: StudyMeetingListInput,
) => {
  return studyMeetingsAdminService.listMeetings(authUser, input);
};

export const getAdminStudyMeeting = (
  authUser: AuthUser | undefined,
  input: GetAdminStudyMeetingInput,
) => {
  return studyMeetingsAdminService.getMeeting(authUser, input);
};

export const createAdminStudyMeeting = (
  authUser: AuthUser | undefined,
  input: CreateAdminStudyMeetingInput,
) => {
  return studyMeetingsAdminService.createMeeting(authUser, input);
};

export const updateAdminStudyMeeting = (
  authUser: AuthUser | undefined,
  input: UpdateAdminStudyMeetingInput,
) => {
  return studyMeetingsAdminService.updateMeeting(authUser, input);
};

export const cancelAdminStudyMeeting = (
  authUser: AuthUser | undefined,
  input: CancelAdminStudyMeetingInput,
) => {
  return studyMeetingsAdminService.cancelMeeting(authUser, input);
};

export const setStudyMeetingsAdminServiceDependenciesForTesting = (
  dependencies: StudyMeetingsAdminServiceDependencies,
) => {
  studyMeetingsAdminServiceDependencies = dependencies;
  studyMeetingsAdminService = createStudyMeetingsAdminService(
    studyMeetingsAdminServiceDependencies,
  );
};

export const resetStudyMeetingsAdminServiceDependenciesForTesting = () => {
  studyMeetingsAdminServiceDependencies =
    createDefaultStudyMeetingsAdminServiceDependencies();
  studyMeetingsAdminService = createStudyMeetingsAdminService(
    studyMeetingsAdminServiceDependencies,
  );
};

export const getMemoryStudyMeetingsAuditLogsForTesting = () => {
  if (!studyMeetingsAdminServiceDependencies.memoryState) {
    return [];
  }

  return getMemoryStudyMeetingsAuditLogs(
    studyMeetingsAdminServiceDependencies.memoryState,
  );
};
