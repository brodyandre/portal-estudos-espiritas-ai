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
  UserStudyMeetingGroupRecord,
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

const toGroupSummary = (group: UserStudyMeetingGroupRecord) => ({
  id: group.id,
  name: group.name,
  status: group.status,
  bookTitle: group.bookTitle,
});

const mapMeetings = (
  meetings: UserStudyMeetingRecord[],
  groups: UserStudyMeetingGroupRecord[],
  now: Date,
) => {
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  return meetings
    .map((meeting) => {
      const group = groupsById.get(meeting.groupId);

      if (!group) {
        return null;
      }

      return {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        status: deriveMeetingStatus(meeting, now),
        meetUrl: group.meetUrl,
        group: toGroupSummary(group),
      };
    })
    .filter((meeting): meeting is NonNullable<typeof meeting> => Boolean(meeting));
};

export const createUserStudyMeetingsService = (
  dependencies: UserStudyMeetingsServiceDependencies =
    createDefaultUserStudyMeetingsServiceDependencies(),
): UserStudyMeetingsService => {
  return {
    async listUpcomingMeetings(authUser, input) {
      const actor = assertStudentOrTeacher(authUser);

      if (actor.role === "teacher") {
        const teacherGroups = await dependencies.repository.listTeacherGroupsByUserId(actor.id);
        const activeTeacherGroups = teacherGroups.filter((group) => group.status === "active");

        if (teacherGroups.length === 0 || activeTeacherGroups.length === 0) {
          return {
            group: teacherGroups[0] ? toGroupSummary(teacherGroups[0]) : null,
            groups: teacherGroups.map(toGroupSummary),
            items: [],
            limit: input.limit,
          };
        }

        const now = dependencies.nowProvider();
        const meetings = await dependencies.repository.listCurrentAndFutureMeetings({
          groupIds: activeTeacherGroups.map((group) => group.id),
          now,
          limit: input.limit,
        });

        return {
          group: toGroupSummary(activeTeacherGroups[0]),
          groups: teacherGroups.map(toGroupSummary),
          items: mapMeetings(meetings, activeTeacherGroups, now),
          limit: input.limit,
        };
      }

      const userGroup = await dependencies.repository.findUserGroupByUserId(actor.id);

      if (!userGroup?.groupSlug) {
        return {
          group: null,
          groups: [],
          items: [],
          limit: input.limit,
        };
      }

      const group = await dependencies.repository.findGroupById(userGroup.groupSlug);

      if (!group) {
        return {
          group: null,
          groups: [],
          items: [],
          limit: input.limit,
        };
      }

      const groupSummary = toGroupSummary(group);

      if (group.status !== "active") {
        return {
          group: groupSummary,
          groups: [groupSummary],
          items: [],
          limit: input.limit,
        };
      }

      const now = dependencies.nowProvider();
      const meetings = await dependencies.repository.listCurrentAndFutureMeetings({
        groupIds: [group.id],
        now,
        limit: input.limit,
      });

      return {
        group: groupSummary,
        groups: [groupSummary],
        items: mapMeetings(meetings, [group], now),
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
