import type { AppUser, UserRole, UserStatus } from "../../auth/types";

export interface AuthUser extends AppUser {
  email: string;
  passwordChangedAt?: string | null;
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

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface AuthTokenPayload {
  sub: string;
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

export interface ChangePasswordPersistenceInput {
  userId: string;
  passwordHash: string;
  actorName: string;
  actorRole: UserRole;
}
