import type {
  AccountInvitationCancelResult,
  AccountInvitationDeliveryStatus,
  AccountInvitationListItem,
  AccountInvitationListMeta,
  AccountInvitationListParams,
  AccountInvitationListResult,
  AccountInvitationLifecycleStatus,
  AccountInvitationResendResult,
  AccountInvitationType,
} from "../types/adminAccountInvitations";
import { ServiceRequestError, requestJson } from "./api";

interface ApiAccountInvitationListData {
  items: unknown;
}

interface ApiAccountInvitationCancelData {
  canceled?: unknown;
}

interface ApiAccountInvitationResendData {
  invitation?: unknown;
}

const ACCOUNT_INVITATIONS_PATH = "/api/admin/account-invitations";
const invalidEnvelopeError = () =>
  new ServiceRequestError({
    kind: "api",
    message: "Resposta inválida do servidor para convites administrativos.",
  });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0;
};

const isString = (value: unknown): value is string => {
  return typeof value === "string";
};

const isOptionalStringOrNull = (value: unknown): value is string | null => {
  return typeof value === "string" || value === null;
};

const isDeliveryStatus = (value: unknown): value is AccountInvitationDeliveryStatus => {
  return value === "pending" || value === "sent" || value === "failed" || value === "not_configured";
};

const isLifecycleStatus = (value: unknown): value is AccountInvitationLifecycleStatus => {
  return value === "pending" || value === "accepted" || value === "expired" || value === "canceled";
};

const isInvitationType = (value: unknown): value is AccountInvitationType => {
  return value === "enrollment_approval" || value === "admin_reinvite";
};

const isValidInteger = (value: unknown, minimum: number): value is number => {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= minimum;
};

const mapAccountInvitationListItem = (item: unknown): AccountInvitationListItem => {
  if (!isRecord(item)) {
    throw invalidEnvelopeError();
  }

  const {
    id,
    recipientName,
    recipientEmailMasked,
    invitationType,
    deliveryStatus,
    lifecycleStatus,
    createdAt,
    expiresAt,
    deliveredAt,
    deliveryFailedAt,
    acceptedAt,
    invalidatedAt,
    invitedByName,
  } = item;

  if (
    !isNonEmptyString(id) ||
    !isString(recipientName) ||
    !isNonEmptyString(recipientEmailMasked) ||
    !isInvitationType(invitationType) ||
    !isDeliveryStatus(deliveryStatus) ||
    !isLifecycleStatus(lifecycleStatus) ||
    !isNonEmptyString(createdAt) ||
    !isNonEmptyString(expiresAt) ||
    !isOptionalStringOrNull(deliveredAt) ||
    !isOptionalStringOrNull(deliveryFailedAt) ||
    !isOptionalStringOrNull(acceptedAt) ||
    !isOptionalStringOrNull(invalidatedAt) ||
    !isOptionalStringOrNull(invitedByName)
  ) {
    throw invalidEnvelopeError();
  }

  return {
    id,
    recipientName,
    recipientEmailMasked,
    invitationType,
    deliveryStatus,
    lifecycleStatus,
    createdAt,
    expiresAt,
    deliveredAt,
    deliveryFailedAt,
    acceptedAt,
    invalidatedAt,
    invitedByName,
  };
};

const mapListMeta = (meta: unknown): AccountInvitationListMeta => {
  if (!isRecord(meta)) {
    throw invalidEnvelopeError();
  }

  const { page, pageSize, total, totalPages } = meta;

  if (
    !isValidInteger(page, 1) ||
    !isValidInteger(pageSize, 1) ||
    !isValidInteger(total, 0) ||
    !isValidInteger(totalPages, 0)
  ) {
    throw invalidEnvelopeError();
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
  };
};

const appendParam = (
  params: URLSearchParams,
  key: string,
  value: number | string | null | undefined,
) => {
  if (value === undefined || value === null) {
    return;
  }

  const serialized = typeof value === "string" ? value.trim() : String(value);

  if (!serialized) {
    return;
  }

  params.set(key, serialized);
};

const buildAccountInvitationsPath = (params: AccountInvitationListParams = {}) => {
  const query = new URLSearchParams();

  appendParam(query, "page", params.page);
  appendParam(query, "pageSize", params.pageSize);
  appendParam(query, "deliveryStatus", params.deliveryStatus);
  appendParam(query, "lifecycleStatus", params.lifecycleStatus);
  appendParam(query, "invitationType", params.invitationType);
  appendParam(query, "search", params.search);
  appendParam(query, "sortBy", params.sortBy);
  appendParam(query, "sortOrder", params.sortOrder);

  const serializedQuery = query.toString();

  return serializedQuery ? `${ACCOUNT_INVITATIONS_PATH}?${serializedQuery}` : ACCOUNT_INVITATIONS_PATH;
};

export const listAdminAccountInvitations = async (
  params: AccountInvitationListParams = {},
): Promise<AccountInvitationListResult> => {
  const payload = await requestJson<ApiAccountInvitationListData>({
    path: buildAccountInvitationsPath(params),
  });

  if (!payload.data || !Array.isArray(payload.data.items) || !payload.meta) {
    throw invalidEnvelopeError();
  }

  return {
    items: payload.data.items.map(mapAccountInvitationListItem),
    meta: mapListMeta(payload.meta),
  };
};

export const cancelAdminAccountInvitation = async (
  invitationId: string,
): Promise<AccountInvitationCancelResult> => {
  const payload = await requestJson<ApiAccountInvitationCancelData>({
    path: `${ACCOUNT_INVITATIONS_PATH}/${encodeURIComponent(invitationId)}/cancel`,
    init: {
      method: "POST",
      body: JSON.stringify({}),
    },
  });

  if (!payload.data || payload.data.canceled !== true) {
    throw invalidEnvelopeError();
  }

  return {
    canceled: true,
  };
};

export const resendAdminAccountInvitation = async (
  invitationId: string,
): Promise<AccountInvitationResendResult> => {
  const payload = await requestJson<ApiAccountInvitationResendData>({
    path: `${ACCOUNT_INVITATIONS_PATH}/${encodeURIComponent(invitationId)}/resend`,
    init: {
      method: "POST",
      body: JSON.stringify({}),
    },
  });

  if (!payload.data || !isRecord(payload.data.invitation)) {
    throw invalidEnvelopeError();
  }

  const invitation = payload.data.invitation;
  const { expiresAt, deliveryStatus, invitationType } = invitation;

  if (
    !isNonEmptyString(expiresAt) ||
    !isDeliveryStatus(deliveryStatus) ||
    invitationType !== "admin_reinvite"
  ) {
    throw invalidEnvelopeError();
  }

  return {
    invitation: {
      expiresAt,
      deliveryStatus,
      invitationType,
    },
  };
};
