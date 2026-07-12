import type { AppUser, UserRole, UserStatus } from "../../auth/types";

export interface AuthUser extends AppUser {
  email: string;
  passwordChangedAt?: string | null;
}

export interface StoredAuthSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  lastSeenAt?: string | null;
  userAgentSummary?: string | null;
  ipHash?: string | null;
}

export type AuthSessionStatus = "active" | "revoked" | "expired";

export interface AuthSessionListItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  isCurrent: boolean;
  status: AuthSessionStatus;
  device: {
    label: string;
    userAgentSummary?: string | null;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface AuthTokenPayload {
  sub: string;
  jti?: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  passwordChangedAt?: string | null;
  mustChangePassword?: boolean;
  iat?: number;
}

export interface StoredAuthUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  whatsapp?: string | null;
  role: UserRole;
  status: UserStatus;
  groupName?: string | null;
  groupSlug?: string | null;
  enrollmentId?: string | null;
  mustChangePassword?: boolean;
  temporaryPasswordGeneratedAt?: string | null;
  passwordChangedAt?: string | null;
}

export interface StoredPasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
  invalidatedAt?: string | null;
  requestedIpHash?: string | null;
}

export interface StudentAccessProvisionInput {
  enrollmentId: string;
  fullName: string;
  email: string;
  whatsapp: string;
  groupName: string | null;
  groupSlug: string | null;
  passwordHash: string;
  temporaryPasswordGeneratedAt: string;
  mustChangePassword: boolean;
  actorName: string;
  actorRole: UserRole;
}

export interface StudentAccessProvisionResult {
  user: AuthUser;
  action: "created" | "activated" | "updated";
  mustChangePassword: boolean;
}

export interface CreateAuthSessionInput {
  sessionId: string;
  userId: string;
  expiresAt: string;
  userAgentSummary?: string | null;
  ipHash?: string | null;
}

export interface RevokeAuthSessionInput {
  sessionId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  note: string;
}

export interface RevokeAllAuthSessionsInput {
  userId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  note: string;
}

export interface ChangePasswordPersistenceResult {
  user: StoredAuthUser;
  session: StoredAuthSession;
}

export interface ChangePasswordPersistenceInput {
  userId: string;
  passwordHash: string;
  passwordChangedAt: string;
  actorName: string;
  actorRole: UserRole;
  currentSessionId: string;
  newSessionId: string;
  newSessionExpiresAt: string;
  newSessionUserAgentSummary?: string | null;
  newSessionIpHash?: string | null;
}

export interface AdminResetPasswordPersistenceInput {
  userId: string;
  passwordHash: string;
  temporaryPasswordGeneratedAt: string;
  passwordChangedAt: string;
  actorName: string;
  actorRole: UserRole;
}

export interface PasswordResetRequestPersistenceInput {
  userId: string;
  tokenHash: string;
  expiresAt: string;
  requestedIpHash?: string | null;
  actorName: string;
  actorRole: UserRole;
}

export interface PasswordResetPersistenceInput {
  tokenHash: string;
  newPassword: string;
  passwordHash: string;
  passwordChangedAt: string;
  actorName: string;
  actorRole: UserRole;
}

export type PasswordResetPersistenceResult =
  | { status: "updated"; user: StoredAuthUser }
  | { status: "invalid_token" }
  | { status: "password_reuse" };

export interface ListAuthSessionsInput {
  userId: string;
  currentSessionId: string;
  includeInactive?: boolean;
}

export interface RevokeSessionForUserInput {
  userId: string;
  sessionId: string;
  actorName: string;
  actorRole: UserRole;
}

export interface RevokeOtherSessionsForUserInput {
  userId: string;
  currentSessionId: string;
  actorName: string;
  actorRole: UserRole;
}

export interface PasswordRecoveryPreview {
  id: string;
  email: string;
  fullName: string;
  token: string;
  resetUrl: string;
  createdAt: string;
  expiresAt: string;
}
