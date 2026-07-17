import { Router } from "express";

import { AppError } from "../../lib/app-error";
import { sendSuccess } from "../../lib/api-response";
import { asyncHandler } from "../../lib/async-handler";
import { governedCorpusService } from "../../knowledge/governedCorpus";
import {
  assertAdminKnowledgeRateLimit,
  assertAdminStudyMeetingRateLimit,
  recordAdminKnowledgeAttempt,
  recordAdminStudyMeetingAttempt,
} from "../../security/auth-rate-limit";
import { requireRole } from "../auth/auth.middleware";
import type { AuthUser } from "../auth/auth.types";
import {
  cancelAdminStudyMeeting,
  createAdminStudyMeeting,
  getAdminStudyMeeting,
  listAdminStudyMeetings,
  updateAdminStudyMeeting,
} from "../study-meetings/study-meetings.service";
import {
  parseCancelStudyMeetingBody,
  parseCreateStudyMeetingBody,
  parseUpdateStudyMeetingBody,
} from "../study-meetings/study-meetings.input";
import {
  presentStudyMeeting,
  presentStudyMeetingList,
} from "../study-meetings/study-meetings.presenter";
import {
  parseStudyMeetingRouteParam,
  parseStudyMeetingsListQuery,
} from "../study-meetings/study-meetings.query";
import { parseAdminGroupsListQuery } from "./groups/query";
import { listAdminGroups } from "./groups/service";
import {
  parseCreateKnowledgeBookBody,
  parseCreateKnowledgeDocumentBody,
  parseKnowledgeBooksListQuery,
  parseKnowledgeDocumentsListQuery,
  parseKnowledgeRouteParam,
  parseTransitionKnowledgeDocumentBody,
  parseUpdateKnowledgeBookBody,
  parseUpdateKnowledgeDocumentBody,
} from "./knowledge/query";
import {
  presentGovernedCorpusOperationalStatus,
  presentKnowledgeBook,
  presentKnowledgeBookList,
  presentKnowledgeDocument,
  presentKnowledgeDocumentList,
} from "./knowledge/presenter";
import {
  createKnowledgeBook,
  createKnowledgeDocument,
  getKnowledgeBook,
  getKnowledgeDocument,
  listKnowledgeBooks,
  listKnowledgeDocuments,
  transitionKnowledgeDocument,
  updateKnowledgeBook,
  updateKnowledgeDocument,
} from "./knowledge/service";
import {
  parseAdminUserGroupBody,
  parseAdminUserGroupPathParam,
  parseAdminUserStatusBody,
  parseAdminUserStatusPathParam,
  parseAdminUsersListQuery,
} from "./users/query";
import { listAdminUsers, updateAdminUserGroup, updateAdminUserStatus } from "./users/service";
import type {
  AccountInvitationDeliveryStatus,
  AccountInvitationLifecycleStatus,
  AccountInvitationType,
} from "../auth/auth.types";
import {
  cancelAdminAccountInvitation,
  listAdminAccountInvitations,
  resendAdminAccountInvitation,
  resetPasswordByAdmin,
  sendAccountInvitationByAdmin,
  type ListAdminAccountInvitationsInput,
} from "../auth/auth.service";

const getRouteParam = (value: string | string[] | undefined): string => {
  return Array.isArray(value) ? value[0] ?? "" : (value ?? "");
};

const ACCOUNT_INVITATION_LIST_QUERY_KEYS = new Set([
  "page",
  "pageSize",
  "deliveryStatus",
  "lifecycleStatus",
  "invitationType",
  "search",
  "sortBy",
  "sortOrder",
]);
const ACCOUNT_INVITATION_DELIVERY_STATUSES: AccountInvitationDeliveryStatus[] = [
  "pending",
  "sent",
  "failed",
  "not_configured",
];
const ACCOUNT_INVITATION_LIFECYCLE_STATUSES: AccountInvitationLifecycleStatus[] = [
  "pending",
  "accepted",
  "expired",
  "canceled",
];
const ACCOUNT_INVITATION_TYPES: AccountInvitationType[] = [
  "enrollment_approval",
  "admin_reinvite",
];
const ACCOUNT_INVITATION_SORT_FIELDS = ["createdAt", "expiresAt", "recipient"] as const;
const ACCOUNT_INVITATION_SORT_ORDERS = ["asc", "desc"] as const;

const buildInvalidListQueryError = () =>
  new AppError({
    statusCode: 400,
    code: "INVALID_ACCOUNT_INVITATION_LIST_QUERY",
    message: "Parâmetros inválidos para consultar convites.",
  });

const getOptionalQueryString = (query: Record<string, unknown>, key: string) => {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== "string") {
    throw buildInvalidListQueryError();
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
};

const parsePositiveIntegerQuery = (
  query: Record<string, unknown>,
  key: "page" | "pageSize",
) => {
  const value = getOptionalQueryString(query, key);

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    throw buildInvalidListQueryError();
  }

  return Number(value);
};

const parseEnumQuery = <T extends string>(
  query: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
) => {
  const value = getOptionalQueryString(query, key);

  if (value === undefined) {
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    throw buildInvalidListQueryError();
  }

  return value as T;
};

const parseAccountInvitationListQuery = (
  query: Record<string, unknown>,
): ListAdminAccountInvitationsInput => {
  for (const key of Object.keys(query)) {
    if (!ACCOUNT_INVITATION_LIST_QUERY_KEYS.has(key)) {
      throw buildInvalidListQueryError();
    }
  }

  const search = getOptionalQueryString(query, "search");

  if (search && search.length > 120) {
    throw buildInvalidListQueryError();
  }

  return {
    page: parsePositiveIntegerQuery(query, "page"),
    pageSize: parsePositiveIntegerQuery(query, "pageSize"),
    deliveryStatus: parseEnumQuery(query, "deliveryStatus", ACCOUNT_INVITATION_DELIVERY_STATUSES),
    lifecycleStatus: parseEnumQuery(query, "lifecycleStatus", ACCOUNT_INVITATION_LIFECYCLE_STATUSES),
    invitationType: parseEnumQuery(query, "invitationType", ACCOUNT_INVITATION_TYPES),
    search,
    sortBy: parseEnumQuery(query, "sortBy", ACCOUNT_INVITATION_SORT_FIELDS),
    sortOrder: parseEnumQuery(query, "sortOrder", ACCOUNT_INVITATION_SORT_ORDERS),
  };
};

const assertNoUnexpectedBody = (
  body: unknown,
  error: {
    code: string;
    message: string;
  },
) => {
  if (body === undefined) {
    return;
  }

  const isPlainObject =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.getPrototypeOf(body) === Object.prototype;

  if (!isPlainObject || Object.keys(body).length > 0) {
    throw new AppError({
      statusCode: 400,
      code: error.code,
      message: error.message,
    });
  }
};

const requireAuthenticatedAdminRequestUser = (
  authUser: AuthUser | undefined,
) => {
  if (!authUser) {
    throw new AppError({
      statusCode: 401,
      code: "AUTH_REQUIRED",
      message: "Faça login no ambiente local para continuar.",
    });
  }

  return authUser;
};

export const adminRouter = Router();

adminRouter.get(
  "/knowledge/corpus/status",
  ...requireRole(["admin"]),
  asyncHandler(async (_request, response) => {
    return sendSuccess(response, {
      message: "Estado operacional do corpus governado consultado com sucesso.",
      data: presentGovernedCorpusOperationalStatus(
        governedCorpusService.getOperationalStatus(),
      ),
    });
  }),
);

adminRouter.get(
  "/knowledge/books",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const result = await listKnowledgeBooks(
      requireAuthenticatedAdminRequestUser(request.authUser),
      parseKnowledgeBooksListQuery(request.query),
    );
    const presented = presentKnowledgeBookList(result);

    return sendSuccess(response, {
      message: "Livros da base de conhecimento consultados com sucesso.",
      data: { items: presented.items },
      meta: presented.meta,
    });
  }),
);

adminRouter.post(
  "/knowledge/books",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    assertAdminKnowledgeRateLimit(authUser.id, "book:create");
    recordAdminKnowledgeAttempt(authUser.id, "book:create");
    const book = await createKnowledgeBook(authUser, parseCreateKnowledgeBookBody(request.body));

    return sendSuccess(response, {
      status: 201,
      message: "Livro da base de conhecimento criado com sucesso.",
      data: presentKnowledgeBook(book),
    });
  }),
);

adminRouter.get(
  "/knowledge/books/:bookId",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const result = await getKnowledgeBook(
      requireAuthenticatedAdminRequestUser(request.authUser),
      parseKnowledgeRouteParam(request.params.bookId),
    );

    return sendSuccess(response, {
      message: "Livro da base de conhecimento consultado com sucesso.",
      data: presentKnowledgeBook(result.book, result.aggregate),
    });
  }),
);

adminRouter.patch(
  "/knowledge/books/:bookId",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const bookId = parseKnowledgeRouteParam(request.params.bookId);
    assertAdminKnowledgeRateLimit(authUser.id, `book:${bookId}`);
    recordAdminKnowledgeAttempt(authUser.id, `book:${bookId}`);
    const book = await updateKnowledgeBook(authUser, bookId, parseUpdateKnowledgeBookBody(request.body));

    return sendSuccess(response, {
      message: "Livro da base de conhecimento atualizado com sucesso.",
      data: presentKnowledgeBook(book),
    });
  }),
);

adminRouter.get(
  "/knowledge/documents",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const result = await listKnowledgeDocuments(
      requireAuthenticatedAdminRequestUser(request.authUser),
      parseKnowledgeDocumentsListQuery(request.query),
    );
    const presented = presentKnowledgeDocumentList(result);

    return sendSuccess(response, {
      message: "Documentos da base de conhecimento consultados com sucesso.",
      data: { items: presented.items },
      meta: presented.meta,
    });
  }),
);

adminRouter.post(
  "/knowledge/documents",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    assertAdminKnowledgeRateLimit(authUser.id, "document:create");
    recordAdminKnowledgeAttempt(authUser.id, "document:create");
    const document = await createKnowledgeDocument(
      authUser,
      parseCreateKnowledgeDocumentBody(request.body),
    );

    return sendSuccess(response, {
      status: 201,
      message: "Documento da base de conhecimento criado com sucesso.",
      data: presentKnowledgeDocument(document),
    });
  }),
);

adminRouter.get(
  "/knowledge/documents/:documentId",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const result = await getKnowledgeDocument(
      requireAuthenticatedAdminRequestUser(request.authUser),
      parseKnowledgeRouteParam(request.params.documentId),
    );

    return sendSuccess(response, {
      message: "Documento da base de conhecimento consultado com sucesso.",
      data: presentKnowledgeDocument(result.document, { fileExists: result.fileExists }),
    });
  }),
);

adminRouter.patch(
  "/knowledge/documents/:documentId",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const documentId = parseKnowledgeRouteParam(request.params.documentId);
    assertAdminKnowledgeRateLimit(authUser.id, `document:${documentId}`);
    recordAdminKnowledgeAttempt(authUser.id, `document:${documentId}`);
    const document = await updateKnowledgeDocument(
      authUser,
      documentId,
      parseUpdateKnowledgeDocumentBody(request.body),
    );

    return sendSuccess(response, {
      message: "Documento da base de conhecimento atualizado com sucesso.",
      data: presentKnowledgeDocument(document),
    });
  }),
);

adminRouter.patch(
  "/knowledge/documents/:documentId/editorial-status",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const documentId = parseKnowledgeRouteParam(request.params.documentId);
    assertAdminKnowledgeRateLimit(authUser.id, `document:${documentId}:editorial-status`);
    recordAdminKnowledgeAttempt(authUser.id, `document:${documentId}:editorial-status`);
    const document = await transitionKnowledgeDocument(
      authUser,
      documentId,
      parseTransitionKnowledgeDocumentBody(request.body),
    );

    return sendSuccess(response, {
      message: "Estado editorial do documento atualizado com sucesso.",
      data: presentKnowledgeDocument(document),
    });
  }),
);

adminRouter.get(
  "/account-invitations",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await listAdminAccountInvitations(
      request.authUser,
      parseAccountInvitationListQuery(request.query),
    );

    return sendSuccess(response, {
      message: "Convites administrativos consultados com sucesso.",
      data: {
        items: result.items,
      },
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }),
);

adminRouter.get(
  "/groups",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await listAdminGroups(request.authUser, parseAdminGroupsListQuery(request.query));

    return sendSuccess(response, {
      message: "Grupos administrativos listados com sucesso.",
      data: {
        items: result.items,
      },
    });
  }),
);

adminRouter.get(
  "/groups/:groupId/meetings",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const groupId = parseStudyMeetingRouteParam(request.params.groupId, "groupId");
    const result = await listAdminStudyMeetings(
      authUser,
      parseStudyMeetingsListQuery(groupId, request.query),
    );
    const presentedResult = presentStudyMeetingList(result);

    return sendSuccess(response, {
      message: "Encontros listados com sucesso.",
      data: {
        items: presentedResult.items,
      },
      meta: presentedResult.meta,
    });
  }),
);

adminRouter.post(
  "/groups/:groupId/meetings",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const groupId = parseStudyMeetingRouteParam(request.params.groupId, "groupId");
    const input = parseCreateStudyMeetingBody(groupId, request.body);

    assertAdminStudyMeetingRateLimit(authUser.id, groupId);
    recordAdminStudyMeetingAttempt(authUser.id, groupId);

    const meeting = await createAdminStudyMeeting(authUser, input);

    return sendSuccess(response, {
      status: 201,
      message: "Encontro criado com sucesso.",
      data: presentStudyMeeting(meeting),
    });
  }),
);

adminRouter.get(
  "/groups/:groupId/meetings/:meetingId",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const groupId = parseStudyMeetingRouteParam(request.params.groupId, "groupId");
    const meetingId = parseStudyMeetingRouteParam(request.params.meetingId, "meetingId");
    const meeting = await getAdminStudyMeeting(authUser, { groupId, meetingId });

    return sendSuccess(response, {
      message: "Encontro consultado com sucesso.",
      data: presentStudyMeeting(meeting),
    });
  }),
);

adminRouter.patch(
  "/groups/:groupId/meetings/:meetingId",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const groupId = parseStudyMeetingRouteParam(request.params.groupId, "groupId");
    const meetingId = parseStudyMeetingRouteParam(request.params.meetingId, "meetingId");
    const input = parseUpdateStudyMeetingBody(groupId, meetingId, request.body);

    assertAdminStudyMeetingRateLimit(authUser.id, `${groupId}:${meetingId}`);
    recordAdminStudyMeetingAttempt(authUser.id, `${groupId}:${meetingId}`);

    const meeting = await updateAdminStudyMeeting(authUser, input);

    return sendSuccess(response, {
      message: "Encontro atualizado com sucesso.",
      data: presentStudyMeeting(meeting),
    });
  }),
);

adminRouter.post(
  "/groups/:groupId/meetings/:meetingId/cancel",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    const authUser = requireAuthenticatedAdminRequestUser(request.authUser);
    const groupId = parseStudyMeetingRouteParam(request.params.groupId, "groupId");
    const meetingId = parseStudyMeetingRouteParam(request.params.meetingId, "meetingId");
    const input = parseCancelStudyMeetingBody(groupId, meetingId, request.body);

    assertAdminStudyMeetingRateLimit(authUser.id, `${groupId}:${meetingId}:cancel`);
    recordAdminStudyMeetingAttempt(authUser.id, `${groupId}:${meetingId}:cancel`);

    const meeting = await cancelAdminStudyMeeting(authUser, input);

    return sendSuccess(response, {
      message: "Encontro cancelado com sucesso.",
      data: presentStudyMeeting(meeting),
    });
  }),
);

adminRouter.get(
  "/users",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await listAdminUsers(request.authUser, parseAdminUsersListQuery(request.query));

    return sendSuccess(response, {
      message: "Usuários administrativos consultados com sucesso.",
      data: {
        items: result.items,
      },
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }),
);

adminRouter.patch(
  "/users/:userId/status",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await updateAdminUserStatus(
      request.authUser,
      parseAdminUserStatusPathParam(request.params.userId),
      parseAdminUserStatusBody(request.body),
    );

    return sendSuccess(response, {
      message: "Status do usuário atualizado com sucesso.",
      data: result,
    });
  }),
);

adminRouter.patch(
  "/users/:userId/group",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await updateAdminUserGroup(
      request.authUser,
      parseAdminUserGroupPathParam(request.params.userId),
      parseAdminUserGroupBody(request.body),
    );

    return sendSuccess(response, {
      message: "Grupo do usuário atualizado com sucesso.",
      data: result,
    });
  }),
);

adminRouter.post(
  "/account-invitations/:invitationId/cancel",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    assertNoUnexpectedBody(request.body, {
      code: "INVALID_ACCOUNT_INVITATION_CANCEL_INPUT",
      message: "Informe um convite válido para cancelar.",
    });
    const result = await cancelAdminAccountInvitation(
      request.authUser,
      getRouteParam(request.params.invitationId),
    );

    return sendSuccess(response, {
      message: "Convite cancelado com sucesso.",
      data: result,
    });
  }),
);

adminRouter.post(
  "/account-invitations/:invitationId/resend",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    assertNoUnexpectedBody(request.body, {
      code: "INVALID_ACCOUNT_INVITATION_RESEND_INPUT",
      message: "Informe um convite válido para reenviar.",
    });
    const result = await resendAdminAccountInvitation(
      request.authUser,
      getRouteParam(request.params.invitationId),
    );

    return sendSuccess(response, {
      message: "Reenvio de convite processado com sucesso.",
      data: result,
    });
  }),
);

adminRouter.post(
  "/users/:userId/send-invitation",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await sendAccountInvitationByAdmin(
      request.authUser,
      getRouteParam(request.params.userId),
    );

    return sendSuccess(response, {
      message: "Convite de acesso processado.",
      data: result,
    });
  }),
);

adminRouter.post(
  "/users/:userId/reset-password",
  ...requireRole(["admin"]),
  asyncHandler(async (request, response) => {
    if (!request.authUser) {
      throw new AppError({
        statusCode: 401,
        code: "AUTH_REQUIRED",
        message: "Faça login no ambiente local para continuar.",
      });
    }

    const result = await resetPasswordByAdmin(request.authUser, getRouteParam(request.params.userId));

    return sendSuccess(response, {
      message: "Senha temporária redefinida com sucesso.",
      data: result,
    });
  }),
);
