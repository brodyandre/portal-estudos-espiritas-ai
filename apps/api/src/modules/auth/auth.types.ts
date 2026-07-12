import type { AppUser, UserRole, UserStatus } from "../../auth/types";

export interface AuthUser extends AppUser {
  email: string;
}

export interface LoginInput {
  email: string;
  password: string;
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
