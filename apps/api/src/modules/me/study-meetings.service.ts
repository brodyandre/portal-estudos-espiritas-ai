import { AppError } from "../../lib/app-error";
import type { AuthUser } from "../auth/auth.types";
import {
  createUserStudyMeetingsRepository,
  type UserStudyMeetingsRepository,
} from "./study-meetings.repository";
import type {
  ListUpcomingUserStudyMeetingsInput,
  UserStudyMeetingListItem,
  UserStudyMeetingListResult,
  UserStudyMeetingRecord,
} from "./study-meetings.types";

const AUTH_REQUIRED_MESSAGE = "Faça login no ambiente local para continuar.";
const FORBIDDEN_MESSAGE = "Seu perfil não tem acesso a este recurso.";

export interface UserStudyMeetingsServiceDependencies {
  repository: UserStudyMeetingsRepository;
  nowProvider: () => Date;
}

export interface UserStudyMeetingsService {
  listUpcomingMeetings(
    authUser: AuthUser | undefined,
    input: ListUpcomingUserStudyMeetingsInput,
  ): Promise<UserStudyMeetingListResult>;
}

const assertStudentOrTeacher = (authUser: AuthUser | undefined) => {
  if (!authUser) {
    throw new AppError({
      statusCode: 401,
      code: "AUTH_REQUIRED",
      message: AUTH_REQUIRED_MESSAGE,
    });
  }

  if (authUser.role !== "student" && authUser.role !== "teacher") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: FORBIDDEN_MESSAGE,
    });
  }

  return authUser;
};

const deriveMeetingStatus = (
  meeting: UserStudyMeetingRecord,
  now: Date,
): UserStudyMeetingListItem["status"] => {
  const startsAtTime = new Date(meeting.startsAt).getTime();
  const endsAtTime = new Date(meeting.endsAt).getTime();
  const nowTime = now.getTime();

  if (startsAtTime <= nowTime && endsAtTime > nowTime) {
    return "ongoing";
  }

  return "scheduled";
};

const createDefaultUserStudyMeetingsServiceDependencies =
  (): UserStudyMeetingsServiceDependencies => ({
    repository: createUserStudyMeetingsRepository(),
    nowProvider: () => new Date(Date.now()),
  });

export const createUserStudyMeetingsService = (
  dependencies: UserStudyMeetingsServiceDependencies =
    createDefaultUserStudyMeetingsServiceDependencies(),
): UserStudyMeetingsService => {
  return {
    async listUpcomingMeetings(authUser, input) {
      const actor = assertStudentOrTeacher(authUser);
      const userGroup = await dependencies.repository.findUserGroupByUserId(actor.id);

      if (!userGroup?.groupSlug) {
        return {
          group: null,
          items: [],
          limit: input.limit,
        };
      }

      const group = await dependencies.repository.findGroupById(userGroup.groupSlug);

      if (!group) {
        return {
          group: null,
          items: [],
          limit: input.limit,
        };
      }

      const groupSummary = {
        id: group.id,
        name: group.name,
        status: group.status,
      };

      if (group.status !== "active") {
        return {
          group: groupSummary,
          items: [],
          limit: input.limit,
        };
      }

      const now = dependencies.nowProvider();
      const meetings = await dependencies.repository.listCurrentAndFutureMeetings({
        groupId: group.id,
        now,
        limit: input.limit,
      });

      return {
        group: groupSummary,
        items: meetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          startsAt: meeting.startsAt,
          endsAt: meeting.endsAt,
          status: deriveMeetingStatus(meeting, now),
          meetUrl: group.meetUrl,
        })),
        limit: input.limit,
      };
    },
  };
};

let userStudyMeetingsServiceDependencies =
  createDefaultUserStudyMeetingsServiceDependencies();
let userStudyMeetingsService = createUserStudyMeetingsService(
  userStudyMeetingsServiceDependencies,
);

export const listUpcomingUserStudyMeetings = (
  authUser: AuthUser | undefined,
  input: ListUpcomingUserStudyMeetingsInput,
) => userStudyMeetingsService.listUpcomingMeetings(authUser, input);

export const setUserStudyMeetingsServiceDependenciesForTesting = (
  dependencies: UserStudyMeetingsServiceDependencies,
) => {
  userStudyMeetingsServiceDependencies = dependencies;
  userStudyMeetingsService = createUserStudyMeetingsService(
    userStudyMeetingsServiceDependencies,
  );
};

export const resetUserStudyMeetingsServiceDependenciesForTesting = () => {
  userStudyMeetingsServiceDependencies =
    createDefaultUserStudyMeetingsServiceDependencies();
  userStudyMeetingsService = createUserStudyMeetingsService(
    userStudyMeetingsServiceDependencies,
  );
};
