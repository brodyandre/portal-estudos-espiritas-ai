import { appConfig } from "../config/appMode";
import { groups as demoGroups } from "../mocks";
import { requestJson, ServiceRequestError } from "./api";
import type {
  UserBookAccessGroup,
  UserBookAccessKnowledgeBook,
  UserBookAccessResult,
} from "../types/bookAccess";

const BOOK_ACCESS_PATH = "/api/me/book-access";

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const assertKnowledgeBook = (value: unknown): UserBookAccessKnowledgeBook => {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.slug) ||
    !isNonEmptyString(value.title)
  ) {
    throw new ServiceRequestError({
      kind: "api",
      message: "Resposta inválida do servidor para vínculos de livros.",
    });
  }

  return {
    id: value.id,
    slug: value.slug,
    title: value.title,
  };
};

const assertBookAccessGroup = (value: unknown): UserBookAccessGroup => {
  if (!isObject(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    throw new ServiceRequestError({
      kind: "api",
      message: "Resposta inválida do servidor para vínculos de estudo.",
    });
  }

  return {
    id: value.id,
    name: value.name,
    knowledgeBook: assertKnowledgeBook(value.knowledgeBook),
  };
};

const assertBookAccessResponse = (value: unknown): UserBookAccessGroup[] => {
  if (!isObject(value) || !Array.isArray(value.groups)) {
    throw new ServiceRequestError({
      kind: "api",
      message: "Resposta inválida do servidor para vínculos de estudo.",
    });
  }

  return value.groups.map(assertBookAccessGroup);
};

const listDemoBookAccess = (): UserBookAccessResult => ({
  groups: demoGroups.map((group) => ({
    id: group.slug,
    name: group.name,
    knowledgeBook: {
      id: `demo-${group.slug}`,
      slug: group.slug,
      title: group.name,
    },
  })),
  count: demoGroups.length,
  source: "mock",
});

export const listUserBookAccess = async (): Promise<UserBookAccessResult> => {
  if (appConfig.appMode === "demo" || !appConfig.apiUrl) {
    return listDemoBookAccess();
  }

  const payload = await requestJson<unknown>({
    path: BOOK_ACCESS_PATH,
  });
  const groups = assertBookAccessResponse(payload.data);
  const metaCount = typeof payload.meta?.count === "number" ? payload.meta.count : groups.length;

  return {
    groups,
    count: metaCount,
    source: "api",
  };
};

export { ServiceRequestError };
