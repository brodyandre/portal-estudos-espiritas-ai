import { AppError } from "../../lib/app-error";
import type { AuthUser } from "../auth/auth.types";
import {
  createBookAccessRepository,
  type BookAccessRepository,
} from "./book-access.repository";
import type {
  BookAccessActorRole,
  BookAccessGroup,
  BookAccessGroupRecord,
  BookAccessScope,
} from "./book-access.types";

const AUTH_REQUIRED_MESSAGE = "Faça login no ambiente local para continuar.";
const FORBIDDEN_MESSAGE = "Seu perfil não tem acesso a este recurso.";
const BOOK_ACCESS_FORBIDDEN_MESSAGE = "Seu perfil não possui acesso a este grupo de estudo.";
const CATALOG_UNAVAILABLE_MESSAGE = "Catálogo de acesso aos livros de estudo indisponível.";

export interface BookAccessServiceDependencies {
  repository: BookAccessRepository;
}

export interface BookAccessService {
  resolveBookAccessScope(authUser: AuthUser | undefined): Promise<BookAccessScope>;
  resolveSelectedBookAccess(
    authUser: AuthUser | undefined,
    selectedGroupId: string,
  ): Promise<BookAccessGroup>;
}

const assertStudentOrTeacher = (
  authUser: AuthUser | undefined,
): AuthUser & { role: BookAccessActorRole } => {
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

  return authUser as AuthUser & { role: BookAccessActorRole };
};

const createCatalogUnavailableError = (reason: string) =>
  new AppError({
    statusCode: 503,
    code: "BOOK_ACCESS_CATALOG_UNAVAILABLE",
    message: CATALOG_UNAVAILABLE_MESSAGE,
    details: { reason },
  });

const createBookAccessForbiddenError = () =>
  new AppError({
    statusCode: 403,
    code: "BOOK_ACCESS_FORBIDDEN",
    message: BOOK_ACCESS_FORBIDDEN_MESSAGE,
  });

const toAuthorizedGroup = (group: BookAccessGroupRecord): BookAccessGroup | null => {
  if (group.status !== "active") {
    return null;
  }

  if (!group.knowledgeBook) {
    throw createCatalogUnavailableError("STUDY_GROUP_WITHOUT_KNOWLEDGE_BOOK");
  }

  if (group.knowledgeBook.status !== "active") {
    throw createCatalogUnavailableError("KNOWLEDGE_BOOK_INACTIVE");
  }

  return {
    id: group.id,
    name: group.name,
    knowledgeBook: {
      id: group.knowledgeBook.id,
      slug: group.knowledgeBook.slug,
      title: group.knowledgeBook.title,
    },
  };
};

const sortAuthorizedGroups = (groups: BookAccessGroup[]) =>
  [...groups].sort((first, second) => {
    const nameComparison = first.name.localeCompare(second.name, "pt-BR", {
      sensitivity: "base",
    });

    return nameComparison !== 0 ? nameComparison : first.id.localeCompare(second.id);
  });

const createDefaultBookAccessServiceDependencies = (): BookAccessServiceDependencies => ({
  repository: createBookAccessRepository(),
});

export const createBookAccessService = (
  dependencies: BookAccessServiceDependencies = createDefaultBookAccessServiceDependencies(),
): BookAccessService => {
  const resolveBookAccessScope = async (
    authUser: AuthUser | undefined,
  ): Promise<BookAccessScope> => {
    const actor = assertStudentOrTeacher(authUser);

    if (actor.role === "teacher") {
      const groups = await dependencies.repository.listTeacherGroupsByUserId(actor.id);
      const authorizedGroups = groups
        .map(toAuthorizedGroup)
        .filter((group): group is BookAccessGroup => Boolean(group));

      return {
        actorId: actor.id,
        role: actor.role,
        groups: sortAuthorizedGroups(authorizedGroups),
      };
    }

    const userGroup = await dependencies.repository.findUserGroupByUserId(actor.id);

    if (!userGroup?.groupSlug) {
      return {
        actorId: actor.id,
        role: actor.role,
        groups: [],
      };
    }

    const group = await dependencies.repository.findGroupById(userGroup.groupSlug);

    if (!group) {
      throw createCatalogUnavailableError("STUDY_GROUP_NOT_FOUND");
    }

    const authorizedGroup = toAuthorizedGroup(group);

    return {
      actorId: actor.id,
      role: actor.role,
      groups: authorizedGroup ? [authorizedGroup] : [],
    };
  };

  return {
    resolveBookAccessScope,

    async resolveSelectedBookAccess(authUser, selectedGroupId) {
      const scope = await resolveBookAccessScope(authUser);
      const selectedGroup = scope.groups.find((group) => group.id === selectedGroupId);

      if (!selectedGroup) {
        throw createBookAccessForbiddenError();
      }

      return selectedGroup;
    },
  };
};

let bookAccessServiceDependencies = createDefaultBookAccessServiceDependencies();
let bookAccessService = createBookAccessService(bookAccessServiceDependencies);

export const resolveBookAccessScope = (authUser: AuthUser | undefined) =>
  bookAccessService.resolveBookAccessScope(authUser);

export const resolveSelectedBookAccess = (
  authUser: AuthUser | undefined,
  selectedGroupId: string,
) => bookAccessService.resolveSelectedBookAccess(authUser, selectedGroupId);

export const setBookAccessServiceDependenciesForTesting = (
  dependencies: BookAccessServiceDependencies,
) => {
  bookAccessServiceDependencies = dependencies;
  bookAccessService = createBookAccessService(bookAccessServiceDependencies);
};

export const resetBookAccessServiceDependenciesForTesting = () => {
  bookAccessServiceDependencies = createDefaultBookAccessServiceDependencies();
  bookAccessService = createBookAccessService(bookAccessServiceDependencies);
};
