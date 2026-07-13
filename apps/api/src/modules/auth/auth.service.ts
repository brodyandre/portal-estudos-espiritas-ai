import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import { buildTemporaryPassword } from "../enrollments/student-access.service";
import { buildSessionDeviceLabel } from "./session-device";
import {
  createAccountInvitationNotifier,
  getAccountInvitationNotifier,
  listAccountInvitationPreviews,
  registerAccountInvitationPreview,
  resetAccountInvitationNotifier,
  setAccountInvitationNotifierForTesting,
} from "./account-invitation.notifier";
import {
  createPasswordRecoveryNotifier,
  getPasswordRecoveryNotifier,
  listPasswordRecoveryPreviews,
  registerPasswordRecoveryPreview,
  resetPasswordRecoveryNotifier,
  setPasswordRecoveryNotifierForTesting,
} from "./password-recovery.notifier";
import {
  assertAccountInvitationAcceptRateLimit,
  assertAdminInvitationCancelRateLimit,
  assertAdminInvitationRateLimit,
  assertAdminInvitationResendRateLimit,
  assertAdminPasswordResetRateLimit,
  assertLoginRateLimit,
  assertPasswordRecoveryRateLimit,
  assertPasswordChangeRateLimit,
  assertPasswordResetRateLimit,
  clearLoginRateLimit,
  clearPasswordChangeRateLimit,
  normalizeEmailForRateLimit,
  recordAccountInvitationAcceptAttempt,
  recordAdminInvitationCancelAttempt,
  recordAdminInvitationAttempt,
  recordAdminInvitationResendAttempt,
  recordPasswordRecoveryAttempt,
  recordPasswordResetAttempt,
  recordAdminPasswordResetAttempt,
  recordFailedLoginAttempt,
  recordFailedPasswordChangeAttempt,
  resetAuthRateLimitStore,
} from "../../security/auth-rate-limit";
import { AppError } from "../../lib/app-error";
import { env } from "../../config/env";
import type { UserRole } from "../../auth/types";
import {
  createAuthRepository,
  createMemoryAuthRepository,
  resetMemoryAuthRepositoryStore,
  toAuthUser,
  type AuthRepository,
} from "./auth.repository";
import type {
  AcceptAccountInvitationInput,
  AccountInvitationPreview,
  AccountInvitationDeliveryStatus,
  AccountInvitationLifecycleStatus,
  AccountInvitationType,
  AdminResetPasswordPersistenceInput,
  AuthSessionListItem,
  AuthSessionStatus,
  AuthTokenPayload,
  AuthUser,
  ChangePasswordInput,
  ChangePasswordPersistenceInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  ListAccountInvitationsInput,
  ListAccountInvitationsResult,
  PasswordRecoveryPreview,
  ResetPasswordInput,
  StoredAuthSession,
  StoredAuthUser,
  StudentAccessProvisionInput,
  StudentAccessProvisionResult,
} from "./auth.types";

let authRepository: AuthRepository = createAuthRepository();

const INVALID_LOGIN_MESSAGE = "E-mail ou senha inválidos.";
const PASSWORD_RECOVERY_SUCCESS_MESSAGE =
  "Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.";
export const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_RESET_TOKEN_MAX_LENGTH = 512;
const ACCOUNT_INVITATION_TOKEN_MAX_LENGTH = 512;
const ACCOUNT_INVITATION_ID_MAX_LENGTH = 160;
const AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60;
const ACCOUNT_INVITATION_TTL_HOURS = 48;
const PASSWORD_POLICY_MESSAGE =
  "Use pelo menos 8 caracteres, com letra maiúscula, letra minúscula e número.";
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
const ACCOUNT_INVITATION_SORT_FIELDS: ListAccountInvitationsInput["sortBy"][] = [
  "createdAt",
  "expiresAt",
  "recipient",
];
const ACCOUNT_INVITATION_SORT_ORDERS: ListAccountInvitationsInput["sortOrder"][] = [
  "asc",
  "desc",
];

export type ListAdminAccountInvitationsInput = Partial<ListAccountInvitationsInput>;

const normalizeLoginInput = (input: LoginInput): LoginInput => {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
};

const normalizeAdminAccountInvitationsListInput = (
  input: ListAdminAccountInvitationsInput = {},
): ListAccountInvitationsInput => {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const sortBy = input.sortBy ?? "createdAt";
  const sortOrder = input.sortOrder ?? "desc";
  const search = input.search?.trim();
  const invalidListQueryError = () =>
    new AppError({
      statusCode: 400,
      code: "INVALID_ACCOUNT_INVITATION_LIST_QUERY",
      message: "Parâmetros inválidos para consultar convites.",
    });

  if (!Number.isInteger(page) || page < 1) {
    throw invalidListQueryError();
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw invalidListQueryError();
  }

  if (search && search.length > 120) {
    throw invalidListQueryError();
  }

  if (
    input.deliveryStatus &&
    !ACCOUNT_INVITATION_DELIVERY_STATUSES.includes(input.deliveryStatus)
  ) {
    throw invalidListQueryError();
  }

  if (
    input.lifecycleStatus &&
    !ACCOUNT_INVITATION_LIFECYCLE_STATUSES.includes(input.lifecycleStatus)
  ) {
    throw invalidListQueryError();
  }

  if (input.invitationType && !ACCOUNT_INVITATION_TYPES.includes(input.invitationType)) {
    throw invalidListQueryError();
  }

  if (!ACCOUNT_INVITATION_SORT_FIELDS.includes(sortBy)) {
    throw invalidListQueryError();
  }

  if (!ACCOUNT_INVITATION_SORT_ORDERS.includes(sortOrder)) {
    throw invalidListQueryError();
  }

  return {
    page,
    pageSize,
    deliveryStatus: input.deliveryStatus,
    lifecycleStatus: input.lifecycleStatus,
    invitationType: input.invitationType,
    search: search || undefined,
    sortBy,
    sortOrder,
  };
};

const buildTokenPayload = (user: AuthUser): Omit<AuthTokenPayload, "jti" | "iat"> => {
  return {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt ?? null,
  };
};

const buildSessionExpiry = () => {
  return new Date(Date.now() + AUTH_TOKEN_TTL_SECONDS * 1000).toISOString();
};

const summarizeUserAgent = (userAgent?: string) => {
  if (!userAgent) {
    return null;
  }

  return userAgent.replace(/\s+/gu, " ").trim().slice(0, 160) || null;
};

const hashIpAddress = (ipAddress?: string) => {
  if (!ipAddress || ipAddress === "unknown") {
    return null;
  }

  return createHash("sha256").update(`${env.jwtSecret}:${ipAddress}`).digest("hex");
};

const hashPasswordResetToken = (token: string) => {
  return createHmac("sha256", env.jwtSecret).update(token).digest("hex");
};

const hashAccountInvitationToken = (token: string) => {
  return createHmac("sha256", env.jwtSecret).update(token).digest("hex");
};

const buildPasswordResetExpiry = () => {
  return new Date(Date.now() + env.passwordRecoveryTtlMinutes * 60 * 1000).toISOString();
};

const buildAccountInvitationExpiry = () => {
  return new Date(Date.now() + ACCOUNT_INVITATION_TTL_HOURS * 60 * 60 * 1000).toISOString();
};

export const buildPasswordResetUrl = (token: string) => {
  const baseUrl = env.appPublicUrl.replace(/\/+$/u, "");

  return `${baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
};

export const buildAccountInvitationUrl = (token: string) => {
  const baseUrl = env.appPublicUrl.replace(/\/+$/u, "");

  return `${baseUrl}/ativar-conta?token=${encodeURIComponent(token)}`;
};

const logPasswordRecoveryEvent = (
  event:
    | "delivery_started"
    | "delivery_completed"
    | "delivery_failed"
    | "delivery_preview_only"
    | "delivery_unavailable",
  details: {
    correlationId: string;
    notifierKind: string;
    tokenInvalidated?: boolean;
  },
) => {
  if (env.nodeEnv === "test") {
    return;
  }

  const message = JSON.stringify({
    scope: "password-recovery",
    event,
    correlationId: details.correlationId,
    notifierKind: details.notifierKind,
    tokenInvalidated: details.tokenInvalidated ?? false,
  });

  if (event === "delivery_failed" || event === "delivery_unavailable") {
    console.warn(`[api] ${message}`);
    return;
  }

  console.info(`[api] ${message}`);
};

const logAccountInvitationEvent = (
  event:
    | "delivery_started"
    | "delivery_completed"
    | "delivery_failed"
    | "delivery_preview_only"
    | "delivery_unavailable",
  details: {
    correlationId: string;
    notifierKind: string;
    invitationInvalidated?: boolean;
  },
) => {
  if (env.nodeEnv === "test") {
    return;
  }

  const message = JSON.stringify({
    scope: "account-invitation",
    event,
    correlationId: details.correlationId,
    notifierKind: details.notifierKind,
    invitationInvalidated: details.invitationInvalidated ?? false,
  });

  if (event === "delivery_failed" || event === "delivery_unavailable") {
    console.warn(`[api] ${message}`);
    return;
  }

  console.info(`[api] ${message}`);
};

const buildSessionMetadata = (options?: {
  ipAddress?: string;
  userAgent?: string;
}) => {
  return {
    userAgentSummary: summarizeUserAgent(options?.userAgent),
    ipHash: hashIpAddress(options?.ipAddress),
  };
};

export const signAuthToken = (user: AuthUser, sessionId: string) => {
  return jwt.sign(buildTokenPayload(user), env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "8h",
    jwtid: sessionId,
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
};

const buildSessionContext = (options?: { ipAddress?: string; userAgent?: string }) => {
  return {
    sessionId: randomUUID(),
    expiresAt: buildSessionExpiry(),
    ...buildSessionMetadata(options),
  };
};

const resolveSessionStatus = (session: StoredAuthSession): AuthSessionStatus => {
  if (session.revokedAt) {
    return "revoked";
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
};

const sortSessions = (sessions: AuthSessionListItem[]) => {
  const rank = (session: AuthSessionListItem) => {
    if (session.isCurrent) {
      return 0;
    }

    if (session.status === "active") {
      return 1;
    }

    return 2;
  };

  return [...sessions].sort((first, second) => {
    const rankDifference = rank(first) - rank(second);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const firstReference = first.lastSeenAt ?? first.createdAt;
    const secondReference = second.lastSeenAt ?? second.createdAt;

    return new Date(secondReference).getTime() - new Date(firstReference).getTime();
  });
};

export const loginUser = async (
  input: LoginInput,
  options?: {
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<LoginResponse> => {
  const normalizedInput = normalizeLoginInput(input);
  const ipAddress = options?.ipAddress ?? "unknown";

  assertLoginRateLimit(ipAddress, normalizedInput.email);
  const storedUser = await authRepository.getByEmail(normalizedInput.email);

  if (!storedUser) {
    recordFailedLoginAttempt(ipAddress, normalizedInput.email);
    throw new AppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: INVALID_LOGIN_MESSAGE,
    });
  }

  const isValidPassword = await bcrypt.compare(normalizedInput.password, storedUser.passwordHash);

  if (!isValidPassword) {
    recordFailedLoginAttempt(ipAddress, normalizedInput.email);
    throw new AppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: INVALID_LOGIN_MESSAGE,
    });
  }

  if (!storedUser.accountActivatedAt) {
    recordFailedLoginAttempt(ipAddress, normalizedInput.email);
    throw new AppError({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: INVALID_LOGIN_MESSAGE,
    });
  }

  if (storedUser.status !== "active") {
    throw new AppError({
      statusCode: 403,
      code: "USER_INACTIVE",
      message: "Este acesso local ainda não está liberado.",
    });
  }

  const user = toAuthUser(storedUser);
  clearLoginRateLimit(ipAddress, normalizedInput.email);
  const sessionContext = buildSessionContext(options);
  const token = signAuthToken(user, sessionContext.sessionId);

  await authRepository.createSession({
    sessionId: sessionContext.sessionId,
    userId: user.id,
    expiresAt: sessionContext.expiresAt,
    userAgentSummary: sessionContext.userAgentSummary,
    ipHash: sessionContext.ipHash,
  });

  return {
    token,
    user,
  };
};

export const getAuthenticatedUser = async (userId: string): Promise<AuthUser | null> => {
  const storedUser = await authRepository.getById(userId);

  if (!storedUser || storedUser.status !== "active" || !storedUser.accountActivatedAt) {
    return null;
  }

  return toAuthUser(storedUser);
};

export const getAuthenticatedUserFromTokenPayload = async (
  payload: AuthTokenPayload,
  options?: {
    allowRevokedSession?: boolean;
  },
): Promise<{ user: AuthUser; session: StoredAuthSession } | null> => {
  if (!payload.jti) {
    return null;
  }

  const session = await authRepository.getSessionById(payload.jti);

  if (
    !session ||
    session.userId !== payload.sub ||
    (session.revokedAt && !options?.allowRevokedSession)
  ) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const storedUser = await authRepository.getById(payload.sub);

  if (!storedUser || storedUser.status !== "active" || !storedUser.accountActivatedAt) {
    return null;
  }

  const currentPasswordChangedAt = storedUser.passwordChangedAt ?? null;
  const tokenPasswordChangedAt = payload.passwordChangedAt ?? null;

  if (currentPasswordChangedAt !== tokenPasswordChangedAt) {
    return null;
  }

  if (!session.revokedAt) {
    await authRepository.touchSession(session.id);
  }

  return {
    user: toAuthUser(storedUser),
    session,
  };
};

const validatePasswordPolicy = (password: string) => {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/u.test(password);
  const hasLowercase = /[a-z]/u.test(password);
  const hasDigit = /\d/u.test(password);

  return hasMinLength && hasUppercase && hasLowercase && hasDigit;
};

export const buildInviteOnlyPasswordHash = async () => {
  return bcrypt.hash(randomBytes(32).toString("base64url"), 10);
};

export const prepareInvitedEnrollmentUser = async (input: {
  enrollmentId: string;
  fullName: string;
  email: string;
  whatsapp: string;
  groupName: string | null;
  groupSlug: string | null;
  actorName: string;
  actorRole: UserRole;
}) => {
  const passwordHash = await buildInviteOnlyPasswordHash();

  return authRepository.prepareInvitedEnrollmentUser({
    ...input,
    passwordHash,
  });
};

export const processAccountInvitationDelivery = async (input: {
  invitationId: string;
  rawToken: string;
  recipientEmail: string;
  recipientName: string;
  invitationType: AccountInvitationType;
  expiresAt: string;
  actorName: string;
  actorRole: UserRole;
  strict?: boolean;
}) => {
  const notifier = getAccountInvitationNotifier();
  const correlationId = randomUUID();
  const invitationUrl = buildAccountInvitationUrl(input.rawToken);
  const createdAt = new Date().toISOString();
  const previewStored = registerAccountInvitationPreview({
    email: input.recipientEmail,
    fullName: input.recipientName,
    token: input.rawToken,
    invitationUrl,
    createdAt,
    expiresAt: input.expiresAt,
    invitationType: input.invitationType,
  });

  logAccountInvitationEvent("delivery_started", {
    correlationId,
    notifierKind: notifier.kind,
  });

  try {
    if (notifier.kind === "null") {
      if (previewStored) {
        logAccountInvitationEvent("delivery_preview_only", {
          correlationId,
          notifierKind: notifier.kind,
        });
      } else {
        const invalidated = await authRepository.markAccountInvitationFailed({
          invitationId: input.invitationId,
          failedAt: new Date().toISOString(),
          invalidatedAt: new Date().toISOString(),
          actorName: input.actorName,
          actorRole: input.actorRole,
          note: "O convite foi invalidado porque não havia entrega SMTP nem prévia local habilitada.",
        });

        logAccountInvitationEvent("delivery_unavailable", {
          correlationId,
          notifierKind: notifier.kind,
          invitationInvalidated: invalidated,
        });
      }

      return {
        deliveryStatus: previewStored ? ("not_configured" as const) : ("failed" as const),
      };
    }

    await notifier.sendAccountInvitation({
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      invitationUrl,
      expiresAt: input.expiresAt,
      invitationType: input.invitationType,
    });

    await authRepository.markAccountInvitationDelivered({
      invitationId: input.invitationId,
      deliveredAt: new Date().toISOString(),
      actorName: input.actorName,
      actorRole: input.actorRole,
      note: "Convite de ativação processado com sucesso pelo provedor configurado.",
    });

    logAccountInvitationEvent("delivery_completed", {
      correlationId,
      notifierKind: notifier.kind,
    });

    return {
      deliveryStatus: "sent" as const,
    };
  } catch (_error) {
    const invalidated = await authRepository.markAccountInvitationFailed({
      invitationId: input.invitationId,
      failedAt: new Date().toISOString(),
      invalidatedAt: new Date().toISOString(),
      actorName: input.actorName,
      actorRole: input.actorRole,
      note: "O convite foi invalidado após falha segura no envio do e-mail transacional.",
    });

    logAccountInvitationEvent("delivery_failed", {
      correlationId,
      notifierKind: notifier.kind,
      invitationInvalidated: invalidated,
    });

    if (input.strict) {
      throw new AppError({
        statusCode: 502,
        code: "INVITATION_DELIVERY_FAILED",
        message: "O convite foi registrado, mas o envio do e-mail não pôde ser concluído agora.",
      });
    }

    return {
      deliveryStatus: "failed" as const,
    };
  }
};

export const createAndDeliverAccountInvitation = async (input: {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  invitationType: AccountInvitationType;
  actorName: string;
  actorRole: UserRole;
  invitedByUserId?: string | null;
  strictDelivery?: boolean;
}) => {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashAccountInvitationToken(rawToken);
  const expiresAt = buildAccountInvitationExpiry();

  const invitation = await authRepository.replaceAccountInvitation({
    userId: input.userId,
    tokenHash,
    expiresAt,
    invitedByUserId: input.invitedByUserId ?? null,
    invitationType: input.invitationType,
    recipientEmailSnapshot: input.recipientEmail.trim().toLowerCase(),
    actorName: input.actorName,
    actorRole: input.actorRole,
  });

  const delivery = await processAccountInvitationDelivery({
    invitationId: invitation.id,
    rawToken,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    invitationType: input.invitationType,
    expiresAt,
    actorName: input.actorName,
    actorRole: input.actorRole,
    strict: input.strictDelivery,
  });

  return {
    invitationId: invitation.id,
    expiresAt,
    deliveryStatus: delivery.deliveryStatus,
  };
};

export const requestPasswordRecovery = async (
  input: ForgotPasswordInput,
  options?: {
    ipAddress?: string;
  },
) => {
  const normalizedEmail = normalizeEmailForRateLimit(input.email);
  const ipAddress = options?.ipAddress ?? "unknown";

  if (!normalizedEmail) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_FORGOT_PASSWORD_INPUT",
      message: "Informe um e-mail válido para continuar.",
    });
  }

  assertPasswordRecoveryRateLimit(ipAddress, normalizedEmail);
  const storedUser = await authRepository.getByEmail(normalizedEmail);

  if (storedUser) {
    const notifier = getPasswordRecoveryNotifier();
    const correlationId = randomUUID();
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = buildPasswordResetExpiry();
    const createdAt = new Date().toISOString();
    const resetUrl = buildPasswordResetUrl(rawToken);

    await authRepository.replacePasswordResetToken({
      userId: storedUser.id,
      tokenHash,
      expiresAt,
      requestedIpHash: hashIpAddress(ipAddress),
      actorName: "Recuperação de senha",
      actorRole: "visitor",
    });

    const previewStored = registerPasswordRecoveryPreview({
      email: storedUser.email,
      fullName: storedUser.fullName,
      token: rawToken,
      resetUrl,
      createdAt,
      expiresAt,
    });

    logPasswordRecoveryEvent("delivery_started", {
      correlationId,
      notifierKind: notifier.kind,
    });

    try {
      if (notifier.kind === "null") {
        if (previewStored) {
          logPasswordRecoveryEvent("delivery_preview_only", {
            correlationId,
            notifierKind: notifier.kind,
          });
        } else {
          const invalidated = await authRepository.invalidatePasswordResetToken({
            tokenHash,
            invalidatedAt: new Date().toISOString(),
            actorName: "Recuperação de senha",
            actorRole: "visitor",
            note: "O token foi invalidado porque não havia entrega SMTP nem prévia local habilitada.",
          });

          logPasswordRecoveryEvent("delivery_unavailable", {
            correlationId,
            notifierKind: notifier.kind,
            tokenInvalidated: invalidated,
          });
        }
      } else {
        await notifier.sendPasswordRecovery({
          recipientEmail: storedUser.email,
          recipientName: storedUser.fullName,
          recoveryUrl: resetUrl,
          expiresAt,
        });

        logPasswordRecoveryEvent("delivery_completed", {
          correlationId,
          notifierKind: notifier.kind,
        });
      }
    } catch (_error) {
      const invalidated = await authRepository.invalidatePasswordResetToken({
        tokenHash,
        invalidatedAt: new Date().toISOString(),
        actorName: "Recuperação de senha",
        actorRole: "visitor",
        note: "O token foi invalidado após falha segura no envio do e-mail transacional.",
      });

      logPasswordRecoveryEvent("delivery_failed", {
        correlationId,
        notifierKind: notifier.kind,
        tokenInvalidated: invalidated,
      });
    }
  }

  recordPasswordRecoveryAttempt(ipAddress, normalizedEmail);

  return {
    success: true as const,
    message: PASSWORD_RECOVERY_SUCCESS_MESSAGE,
  };
};

export const resetPasswordWithRecovery = async (
  input: ResetPasswordInput,
  options?: {
    ipAddress?: string;
  },
) => {
  const token = input.token;
  const newPassword = input.newPassword;
  const confirmPassword = input.confirmPassword;

  if (!token || !newPassword || !confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PASSWORD_RESET_INPUT",
      message: "Informe o token, a nova senha e a confirmação.",
    });
  }

  if (
    token.length > PASSWORD_RESET_TOKEN_MAX_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH ||
    confirmPassword.length > PASSWORD_MAX_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PASSWORD_RESET_INPUT",
      message: `Os campos enviados ultrapassam o limite permitido para este fluxo.`,
    });
  }

  if (newPassword !== confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "A confirmação da nova senha não confere.",
    });
  }

  if (!validatePasswordPolicy(newPassword)) {
    throw new AppError({
      statusCode: 400,
      code: "WEAK_PASSWORD",
      message: PASSWORD_POLICY_MESSAGE,
    });
  }

  const tokenHash = hashPasswordResetToken(token);
  const ipAddress = options?.ipAddress ?? "unknown";

  assertPasswordResetRateLimit(ipAddress, tokenHash);
  recordPasswordResetAttempt(ipAddress, tokenHash);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const passwordChangedAt = new Date().toISOString();
  const result = await authRepository.resetPasswordWithRecoveryToken({
    tokenHash,
    newPassword,
    passwordHash,
    passwordChangedAt,
    actorName: "Recuperação de senha",
    actorRole: "visitor",
  });

  if (result.status === "password_reuse") {
    throw new AppError({
      statusCode: 400,
      code: "PASSWORD_REUSE_NOT_ALLOWED",
      message: "Escolha uma nova senha diferente da atual.",
    });
  }

  if (result.status !== "updated") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PASSWORD_RESET_TOKEN",
      message: "O link de recuperação é inválido ou já expirou.",
    });
  }

  return {
    success: true as const,
    message: "Senha redefinida com sucesso. Faça login novamente.",
  };
};

export const listUserSessions = async (
  authUser: AuthUser,
  currentSessionId: string,
  includeInactive = false,
): Promise<AuthSessionListItem[]> => {
  const sessions = await authRepository.listSessionsForUser({
    userId: authUser.id,
    currentSessionId,
    includeInactive,
  });

  return sortSessions(
    sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt ?? null,
      revokedAt: session.revokedAt ?? null,
      isCurrent: session.id === currentSessionId,
      status: resolveSessionStatus(session),
      device: {
        label: buildSessionDeviceLabel(session.userAgentSummary),
        userAgentSummary: session.userAgentSummary ?? null,
      },
    })),
  );
};

export const revokeUserSession = async (
  authUser: AuthUser,
  currentSessionId: string,
  targetSessionId: string,
) => {
  if (targetSessionId === currentSessionId) {
    throw new AppError({
      statusCode: 400,
      code: "CURRENT_SESSION_REVOCATION_NOT_ALLOWED",
      message: "Use a opção de sair para encerrar a sessão atual.",
    });
  }

  const result = await authRepository.revokeSessionForUser({
    userId: authUser.id,
    sessionId: targetSessionId,
    actorName: authUser.fullName,
    actorRole: authUser.role,
  });

  if (result === "not_found") {
    throw new AppError({
      statusCode: 404,
      code: "AUTH_SESSION_NOT_FOUND",
      message: "Sessão não encontrada.",
    });
  }

  return {
    revoked: result === "revoked",
    alreadyRevoked: result === "already_revoked",
  };
};

export const logoutCurrentSession = async (authUser: AuthUser, sessionId: string) => {
  await authRepository.revokeSession({
    sessionId,
    actorName: authUser.fullName,
    actorRole: authUser.role,
    action: "Sessão encerrada",
    note: "Sessão local encerrada pelo usuário.",
  });
};

export const logoutOtherSessions = async (authUser: AuthUser, currentSessionId: string) => {
  return authRepository.revokeOtherSessionsForUser({
    userId: authUser.id,
    currentSessionId,
    actorName: authUser.fullName,
    actorRole: authUser.role,
  });
};

export const logoutAllSessions = async (authUser: AuthUser) => {
  return authRepository.revokeAllSessionsForUser({
    userId: authUser.id,
    actorName: authUser.fullName,
    actorRole: authUser.role,
    action: "Sessões encerradas",
    note: "Todas as sessões ativas foram encerradas pelo usuário.",
  });
};

export const changePassword = async (
  authUser: AuthUser,
  currentSession: StoredAuthSession,
  input: ChangePasswordInput,
  options?: {
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<LoginResponse> => {
  assertPasswordChangeRateLimit(authUser.id);
  const storedUser = await authRepository.getById(authUser.id);

  if (!storedUser || storedUser.status !== "active") {
    throw new AppError({
      statusCode: 401,
      code: "AUTH_REQUIRED",
      message: "Faça login no ambiente local para continuar.",
    });
  }

  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  const confirmPassword = input.confirmPassword;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PASSWORD_CHANGE_INPUT",
      message: "Preencha a senha atual, a nova senha e a confirmação.",
    });
  }

  if (
    currentPassword.length > PASSWORD_MAX_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH ||
    confirmPassword.length > PASSWORD_MAX_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_PASSWORD_CHANGE_INPUT",
      message: `Cada senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    });
  }

  if (newPassword !== confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "A confirmação da nova senha não confere.",
    });
  }

  const isValidCurrentPassword = await bcrypt.compare(currentPassword, storedUser.passwordHash);

  if (!isValidCurrentPassword) {
    recordFailedPasswordChangeAttempt(authUser.id);
    throw new AppError({
      statusCode: 401,
      code: "CURRENT_PASSWORD_INVALID",
      message: "A senha atual informada não confere.",
    });
  }

  const isReusedPassword = await bcrypt.compare(newPassword, storedUser.passwordHash);

  if (isReusedPassword) {
    throw new AppError({
      statusCode: 400,
      code: "PASSWORD_REUSE_NOT_ALLOWED",
      message: "Escolha uma nova senha diferente da atual.",
    });
  }

  if (!validatePasswordPolicy(newPassword)) {
    throw new AppError({
      statusCode: 400,
      code: "WEAK_PASSWORD",
      message: PASSWORD_POLICY_MESSAGE,
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const passwordChangedAt = new Date().toISOString();
  const nextSession = buildSessionContext(options);
  const nextUser: AuthUser = {
    ...toAuthUser(storedUser),
    mustChangePassword: false,
    passwordChangedAt,
  };
  const token = signAuthToken(nextUser, nextSession.sessionId);
  const persistedResult = await authRepository.changePassword({
    userId: storedUser.id,
    passwordHash,
    passwordChangedAt,
    actorName: storedUser.fullName,
    actorRole: storedUser.role,
    currentSessionId: currentSession.id,
    newSessionId: nextSession.sessionId,
    newSessionExpiresAt: nextSession.expiresAt,
    newSessionUserAgentSummary: nextSession.userAgentSummary,
    newSessionIpHash: nextSession.ipHash,
  } satisfies ChangePasswordPersistenceInput);

  if (!persistedResult) {
    throw new AppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "Não foi possível localizar este usuário no ambiente local.",
    });
  }

  const user = toAuthUser(persistedResult.user);
  clearPasswordChangeRateLimit(authUser.id);

  return {
    token,
    user,
  };
};

export const resetPasswordByAdmin = async (
  authUser: AuthUser,
  targetUserId: string,
): Promise<{
  user: Pick<
    StoredAuthUser,
    "id" | "fullName" | "email" | "role" | "status" | "mustChangePassword" | "temporaryPasswordGeneratedAt"
  >;
  temporaryPassword: string;
}> => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  if (authUser.id === targetUserId) {
    throw new AppError({
      statusCode: 400,
      code: "SELF_PASSWORD_RESET_NOT_ALLOWED",
      message: "Use o fluxo normal de troca de senha para atualizar o próprio acesso.",
    });
  }

  assertAdminPasswordResetRateLimit(authUser.id, targetUserId);
  recordAdminPasswordResetAttempt(authUser.id, targetUserId);

  const storedUser = await authRepository.getById(targetUserId);

  if (!storedUser) {
    throw new AppError({
      statusCode: 404,
      code: "ADMIN_USER_NOT_FOUND",
      message: "Usuário não encontrado para redefinição administrativa de senha.",
    });
  }

  const temporaryPassword = buildTemporaryPassword(storedUser.fullName);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const credentialChangedAt = new Date().toISOString();

  const persistedUser = await authRepository.resetPasswordByAdmin({
    userId: storedUser.id,
    passwordHash,
    temporaryPasswordGeneratedAt: credentialChangedAt,
    passwordChangedAt: credentialChangedAt,
    actorName: authUser.fullName,
    actorRole: authUser.role,
  } satisfies AdminResetPasswordPersistenceInput);

  if (!persistedUser) {
    throw new AppError({
      statusCode: 404,
      code: "ADMIN_USER_NOT_FOUND",
      message: "Usuário não encontrado para redefinição administrativa de senha.",
    });
  }

  return {
    user: {
      id: persistedUser.id,
      fullName: persistedUser.fullName,
      email: persistedUser.email,
      role: persistedUser.role,
      status: persistedUser.status,
      mustChangePassword: true,
      temporaryPasswordGeneratedAt: persistedUser.temporaryPasswordGeneratedAt ?? credentialChangedAt,
    },
    temporaryPassword,
  };
};

export const acceptAccountInvitation = async (
  input: AcceptAccountInvitationInput,
  options?: {
    ipAddress?: string;
  },
) => {
  const token = input.token;
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (!token || !password || !confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ACCOUNT_INVITATION",
      message: "Convite inválido ou expirado. Solicite um novo acesso para continuar.",
    });
  }

  if (
    token.length > ACCOUNT_INVITATION_TOKEN_MAX_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH ||
    confirmPassword.length > PASSWORD_MAX_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ACCOUNT_INVITATION",
      message: "Convite inválido ou expirado. Solicite um novo acesso para continuar.",
    });
  }

  if (password !== confirmPassword) {
    throw new AppError({
      statusCode: 400,
      code: "PASSWORD_CONFIRMATION_MISMATCH",
      message: "A confirmação da nova senha não confere.",
    });
  }

  if (!validatePasswordPolicy(password)) {
    throw new AppError({
      statusCode: 400,
      code: "WEAK_PASSWORD",
      message: PASSWORD_POLICY_MESSAGE,
    });
  }

  const tokenHash = hashAccountInvitationToken(token);
  const ipAddress = options?.ipAddress ?? "unknown";

  assertAccountInvitationAcceptRateLimit(ipAddress, tokenHash);
  recordAccountInvitationAcceptAttempt(ipAddress, tokenHash);

  const passwordHash = await bcrypt.hash(password, 10);
  const passwordChangedAt = new Date().toISOString();
  const result = await authRepository.acceptAccountInvitation({
    tokenHash,
    passwordHash,
    passwordChangedAt,
    actorName: "Convite de acesso",
    actorRole: "visitor",
  });

  if (result.status !== "updated") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ACCOUNT_INVITATION",
      message: "Convite inválido ou expirado. Solicite um novo acesso para continuar.",
    });
  }

  return {
    success: true as const,
    message: "Conta ativada com sucesso. Faça login para continuar.",
  };
};

export const sendAccountInvitationByAdmin = async (authUser: AuthUser, targetUserId: string) => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  assertAdminInvitationRateLimit(authUser.id, targetUserId);
  recordAdminInvitationAttempt(authUser.id, targetUserId);

  const storedUser = await authRepository.getById(targetUserId);

  if (!storedUser) {
    throw new AppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "Usuário não encontrado para envio do convite.",
    });
  }

  const result = await createAndDeliverAccountInvitation({
    userId: storedUser.id,
    recipientEmail: storedUser.email,
    recipientName: storedUser.fullName,
    invitationType: "admin_reinvite",
    actorName: authUser.fullName,
    actorRole: authUser.role,
    invitedByUserId: authUser.id,
    strictDelivery: true,
  });

  return {
    user: {
      id: storedUser.id,
      fullName: storedUser.fullName,
      email: storedUser.email,
    },
    invitation: {
      expiresAt: result.expiresAt,
      deliveryStatus: result.deliveryStatus,
      invitationType: "admin_reinvite" as const,
    },
  };
};

export const listAdminAccountInvitations = async (
  authUser: AuthUser,
  input: ListAdminAccountInvitationsInput = {},
): Promise<ListAccountInvitationsResult> => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  const normalizedInput = normalizeAdminAccountInvitationsListInput(input);

  return authRepository.listAccountInvitations(normalizedInput, new Date());
};

export const cancelAdminAccountInvitation = async (
  authUser: AuthUser,
  invitationId: string,
) => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  const normalizedInvitationId = invitationId.trim();

  if (
    !normalizedInvitationId ||
    normalizedInvitationId.length > ACCOUNT_INVITATION_ID_MAX_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ACCOUNT_INVITATION_CANCEL_INPUT",
      message: "Informe um convite válido para cancelar.",
    });
  }

  assertAdminInvitationCancelRateLimit(authUser.id, normalizedInvitationId);
  recordAdminInvitationCancelAttempt(authUser.id, normalizedInvitationId);

  const canceled = await authRepository.cancelAccountInvitation({
    invitationId: normalizedInvitationId,
    actorName: authUser.fullName,
    actorRole: authUser.role,
    now: new Date(),
  });

  if (!canceled) {
    throw new AppError({
      statusCode: 409,
      code: "ACCOUNT_INVITATION_NOT_CANCELABLE",
      message: "Não foi possível cancelar este convite.",
    });
  }

  return {
    canceled: true,
  };
};

export const resendAdminAccountInvitation = async (
  authUser: AuthUser,
  invitationId: string,
) => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  const normalizedInvitationId = invitationId.trim();

  if (
    !normalizedInvitationId ||
    normalizedInvitationId.length > ACCOUNT_INVITATION_ID_MAX_LENGTH
  ) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ACCOUNT_INVITATION_RESEND_INPUT",
      message: "Informe um convite válido para reenviar.",
    });
  }

  assertAdminInvitationResendRateLimit(authUser.id, normalizedInvitationId);
  recordAdminInvitationResendAttempt(authUser.id, normalizedInvitationId);

  const resendContext = await authRepository.getAccountInvitationResendContext(
    normalizedInvitationId,
  );

  if (
    !resendContext ||
    resendContext.acceptedAt ||
    !resendContext.user ||
    resendContext.user.accountActivatedAt ||
    resendContext.user.status !== "active"
  ) {
    throw new AppError({
      statusCode: 409,
      code: "ACCOUNT_INVITATION_NOT_RESENDABLE",
      message: "Não foi possível reenviar este convite.",
    });
  }

  const result = await createAndDeliverAccountInvitation({
    userId: resendContext.user.id,
    recipientEmail: resendContext.user.email,
    recipientName: resendContext.user.fullName,
    invitationType: "admin_reinvite",
    actorName: authUser.fullName,
    actorRole: authUser.role,
    invitedByUserId: authUser.id,
    strictDelivery: true,
  });

  return {
    invitation: {
      expiresAt: result.expiresAt,
      deliveryStatus: result.deliveryStatus,
      invitationType: "admin_reinvite" as const,
    },
  };
};

export const getPasswordRecoveryPreviewList = async (authUser: AuthUser): Promise<PasswordRecoveryPreview[]> => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  if (env.nodeEnv === "production" || !env.passwordRecoveryPreviewEnabled) {
    throw new AppError({
      statusCode: 404,
      code: "PASSWORD_RECOVERY_PREVIEW_DISABLED",
      message: "A prévia local da recuperação de senha não está disponível neste ambiente.",
    });
  }

  return listPasswordRecoveryPreviews();
};

export const userHasAnyRole = (user: AuthUser, roles: UserRole[]) => {
  return roles.includes(user.role);
};

export const provisionStudentAccess = (
  input: StudentAccessProvisionInput,
): Promise<StudentAccessProvisionResult> => {
  return authRepository.provisionStudentAccess(input);
};

export const getInvitedEnrollmentUserByEmail = async (email: string) => {
  const storedUser = await authRepository.getByEmail(email.trim().toLowerCase());

  if (!storedUser) {
    return null;
  }

  return {
    id: storedUser.id,
    fullName: storedUser.fullName,
    email: storedUser.email,
    role: storedUser.role,
    status: storedUser.status,
  };
};

export const getAccountInvitationPreviewList = async (authUser: AuthUser): Promise<AccountInvitationPreview[]> => {
  if (authUser.role !== "admin") {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso a este recurso.",
    });
  }

  if (env.nodeEnv === "production" || !env.passwordRecoveryPreviewEnabled) {
    throw new AppError({
      statusCode: 404,
      code: "ACCOUNT_INVITATION_PREVIEW_DISABLED",
      message: "A prévia local do convite de acesso não está disponível neste ambiente.",
    });
  }

  return listAccountInvitationPreviews();
};

export const resetAuthStore = () => {
  resetMemoryAuthRepositoryStore();
  resetAuthRateLimitStore();
  resetAccountInvitationNotifier();
  resetPasswordRecoveryNotifier();
  authRepository = createMemoryAuthRepository();
};

export const setAuthRepositoryForTesting = (repository: AuthRepository) => {
  authRepository = repository;
};

export const resetPasswordRecoveryNotifierFactory = () => {
  resetPasswordRecoveryNotifier();
};

export const setDefaultPasswordRecoveryNotifierForTesting = () => {
  setPasswordRecoveryNotifierForTesting(createPasswordRecoveryNotifier(env));
};

export const resetAccountInvitationNotifierFactory = () => {
  resetAccountInvitationNotifier();
};

export const setDefaultAccountInvitationNotifierForTesting = () => {
  setAccountInvitationNotifierForTesting(createAccountInvitationNotifier(env));
};
