export type AccountInvitationDeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "not_configured";

export type AccountInvitationLifecycleStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "canceled";

export type AccountInvitationType =
  | "enrollment_approval"
  | "admin_reinvite";

export type AccountInvitationSortBy =
  | "createdAt"
  | "expiresAt"
  | "recipient";

export type SortOrder = "asc" | "desc";

export interface AccountInvitationListItem {
  id: string;
  recipientName: string;
  recipientEmailMasked: string;
  invitationType: AccountInvitationType;
  deliveryStatus: AccountInvitationDeliveryStatus;
  lifecycleStatus: AccountInvitationLifecycleStatus;
  createdAt: string;
  expiresAt: string;
  deliveredAt: string | null;
  deliveryFailedAt: string | null;
  acceptedAt: string | null;
  invalidatedAt: string | null;
  invitedByName: string | null;
}

export interface AccountInvitationListParams {
  page?: number | null;
  pageSize?: number | null;
  deliveryStatus?: AccountInvitationDeliveryStatus | null;
  lifecycleStatus?: AccountInvitationLifecycleStatus | null;
  invitationType?: AccountInvitationType | null;
  search?: string | null;
  sortBy?: AccountInvitationSortBy | null;
  sortOrder?: SortOrder | null;
}

export interface AccountInvitationListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AccountInvitationListResult {
  items: AccountInvitationListItem[];
  meta: AccountInvitationListMeta;
}

export interface AccountInvitationCancelResult {
  canceled: true;
}

export interface AccountInvitationResendResult {
  invitation: {
    expiresAt: string;
    deliveryStatus: AccountInvitationDeliveryStatus;
    invitationType: "admin_reinvite";
  };
}
