import type { UserRole, UserStatus } from "../../../auth/types";
import type { AdminUserActivationStatus, AdminUserGroupSummary, AdminUserListItem } from "./types";

const normalizeGroupValue = (value?: string | null) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

export const maskAdminUserEmail = (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const [localPart, domain] = normalizedEmail.split("@");

  if (!localPart || !domain) {
    return "*";
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
};

export const buildAdminUserGroupSummary = (
  name?: string | null,
  slug?: string | null,
): AdminUserGroupSummary | null => {
  const normalizedName = normalizeGroupValue(name);
  const normalizedSlug = normalizeGroupValue(slug);

  if (!normalizedName || !normalizedSlug) {
    return null;
  }

  return {
    name: normalizedName,
    slug: normalizedSlug,
  };
};

export const buildAdminUserListItem = (input: {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  groupName?: string | null;
  groupSlug?: string | null;
  accountActivatedAt?: string | Date | null;
  createdAt: string | Date;
}): AdminUserListItem => {
  const activationStatus: AdminUserActivationStatus = input.accountActivatedAt
    ? "activated"
    : "not_activated";

  return {
    id: input.id,
    name: input.fullName,
    emailMasked: maskAdminUserEmail(input.email),
    role: input.role,
    status: input.status,
    activationStatus,
    group: buildAdminUserGroupSummary(input.groupName, input.groupSlug),
    createdAt: new Date(input.createdAt),
  };
};
