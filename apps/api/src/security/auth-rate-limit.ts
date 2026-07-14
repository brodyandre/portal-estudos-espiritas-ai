import { createHmac } from "node:crypto";

import { env } from "../config/env";
import { AppError } from "../lib/app-error";
import { MemorySlidingWindowRateLimiter, type RateLimitPolicy } from "./rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const loginPolicy: RateLimitPolicy = {
  limit: 5,
  windowMs: FIFTEEN_MINUTES_MS,
};

const passwordChangePolicy: RateLimitPolicy = {
  limit: 5,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminPasswordResetPolicy: RateLimitPolicy = {
  limit: 10,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminPasswordResetTargetPolicy: RateLimitPolicy = {
  limit: 3,
  windowMs: FIFTEEN_MINUTES_MS,
};

const passwordRecoveryPolicy: RateLimitPolicy = {
  limit: 5,
  windowMs: THIRTY_MINUTES_MS,
};

const passwordResetPolicy: RateLimitPolicy = {
  limit: 5,
  windowMs: FIFTEEN_MINUTES_MS,
};

const accountInvitationAcceptPolicy: RateLimitPolicy = {
  limit: 5,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminInvitationPolicy: RateLimitPolicy = {
  limit: 3,
  windowMs: ONE_HOUR_MS,
};

const adminInvitationCancelActorPolicy: RateLimitPolicy = {
  limit: 20,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminInvitationCancelTargetPolicy: RateLimitPolicy = {
  limit: 5,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminInvitationResendActorPolicy: RateLimitPolicy = {
  limit: 10,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminInvitationResendTargetPolicy: RateLimitPolicy = {
  limit: 3,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminUserStatusActorPolicy: RateLimitPolicy = {
  limit: 20,
  windowMs: FIFTEEN_MINUTES_MS,
};

const adminUserStatusTargetPolicy: RateLimitPolicy = {
  limit: 5,
  windowMs: FIFTEEN_MINUTES_MS,
};

const loginLimiter = new MemorySlidingWindowRateLimiter();
const passwordChangeLimiter = new MemorySlidingWindowRateLimiter();
const adminPasswordResetLimiter = new MemorySlidingWindowRateLimiter();
const adminPasswordResetTargetLimiter = new MemorySlidingWindowRateLimiter();
const passwordRecoveryIpLimiter = new MemorySlidingWindowRateLimiter();
const passwordRecoveryIdentityLimiter = new MemorySlidingWindowRateLimiter();
const passwordResetIpLimiter = new MemorySlidingWindowRateLimiter();
const passwordResetTokenLimiter = new MemorySlidingWindowRateLimiter();
const accountInvitationIpLimiter = new MemorySlidingWindowRateLimiter();
const accountInvitationTokenLimiter = new MemorySlidingWindowRateLimiter();
const adminInvitationActorLimiter = new MemorySlidingWindowRateLimiter();
const adminInvitationTargetLimiter = new MemorySlidingWindowRateLimiter();
const adminInvitationCancelActorLimiter = new MemorySlidingWindowRateLimiter();
const adminInvitationCancelTargetLimiter = new MemorySlidingWindowRateLimiter();
const adminInvitationResendActorLimiter = new MemorySlidingWindowRateLimiter();
const adminInvitationResendTargetLimiter = new MemorySlidingWindowRateLimiter();
const adminUserStatusActorLimiter = new MemorySlidingWindowRateLimiter();
const adminUserStatusTargetLimiter = new MemorySlidingWindowRateLimiter();

const toHashedIdentity = (value: string) => {
  return createHmac("sha256", env.jwtSecret).update(value).digest("hex");
};

const buildHeaders = (retryAfterSeconds: number) => ({
  "Retry-After": String(retryAfterSeconds),
});

const buildRateLimitError = (
  code:
    | "AUTH_RATE_LIMITED"
    | "PASSWORD_CHANGE_RATE_LIMITED"
    | "ADMIN_PASSWORD_RESET_RATE_LIMITED"
    | "PASSWORD_RECOVERY_RATE_LIMITED"
    | "PASSWORD_RESET_RATE_LIMITED"
    | "ACCOUNT_INVITATION_RATE_LIMITED"
    | "ADMIN_INVITATION_RATE_LIMITED"
    | "ADMIN_INVITATION_CANCEL_RATE_LIMITED"
    | "ADMIN_INVITATION_RESEND_RATE_LIMITED"
    | "ADMIN_USER_STATUS_RATE_LIMITED",
  retryAfterSeconds: number,
) => {
  return new AppError({
    statusCode: 429,
    code,
    message: "Muitas tentativas. Aguarde antes de tentar novamente.",
    details: {
      retryAfterSeconds,
    },
    headers: buildHeaders(retryAfterSeconds),
  });
};

export const normalizeEmailForRateLimit = (email: string) => email.trim().toLowerCase();

export const buildLoginRateLimitKey = (ipAddress: string, email: string) => {
  return `login:${ipAddress}:${toHashedIdentity(normalizeEmailForRateLimit(email))}`;
};

export const buildPasswordChangeRateLimitKey = (userId: string) => {
  return `change-password:${userId}`;
};

export const buildAdminPasswordResetActorKey = (adminUserId: string) => {
  return `admin-reset:${adminUserId}`;
};

export const buildAdminPasswordResetTargetKey = (targetUserId: string) => {
  return `admin-reset-target:${targetUserId}`;
};

export const buildPasswordRecoveryIpKey = (ipAddress: string) => {
  return `password-recovery-ip:${ipAddress}`;
};

export const buildPasswordRecoveryIdentityKey = (email: string) => {
  return `password-recovery-identity:${toHashedIdentity(normalizeEmailForRateLimit(email))}`;
};

export const buildPasswordResetIpKey = (ipAddress: string) => {
  return `password-reset-ip:${ipAddress}`;
};

export const buildPasswordResetTokenKey = (tokenHash: string) => {
  return `password-reset-token:${toHashedIdentity(tokenHash)}`;
};

export const buildAccountInvitationIpKey = (ipAddress: string) => {
  return `account-invitation-ip:${ipAddress}`;
};

export const buildAccountInvitationTokenKey = (tokenHash: string) => {
  return `account-invitation-token:${toHashedIdentity(tokenHash)}`;
};

export const buildAdminInvitationActorKey = (adminUserId: string) => {
  return `admin-invitation:${adminUserId}`;
};

export const buildAdminInvitationTargetKey = (targetUserId: string) => {
  return `admin-invitation-target:${targetUserId}`;
};

export const buildAdminInvitationCancelActorKey = (adminUserId: string) => {
  return `admin-invitation-cancel:${adminUserId}`;
};

export const buildAdminInvitationCancelTargetKey = (
  adminUserId: string,
  invitationId: string,
) => {
  return `admin-invitation-cancel-target:${adminUserId}:${toHashedIdentity(invitationId)}`;
};

export const buildAdminInvitationResendActorKey = (adminUserId: string) => {
  return `admin-invitation-resend:${adminUserId}`;
};

export const buildAdminInvitationResendTargetKey = (
  adminUserId: string,
  invitationId: string,
) => {
  return `admin-invitation-resend-target:${adminUserId}:${toHashedIdentity(invitationId)}`;
};

export const buildAdminUserStatusActorKey = (adminUserId: string) => {
  return `admin-user-status:${adminUserId}`;
};

export const buildAdminUserStatusTargetKey = (targetUserId: string) => {
  return `admin-user-status-target:${targetUserId}`;
};

export const assertLoginRateLimit = (ipAddress: string, email: string) => {
  const decision = loginLimiter.peek(buildLoginRateLimitKey(ipAddress, email), loginPolicy);

  if (!decision.allowed) {
    throw buildRateLimitError("AUTH_RATE_LIMITED", decision.retryAfterSeconds);
  }
};

export const recordFailedLoginAttempt = (ipAddress: string, email: string) => {
  loginLimiter.record(buildLoginRateLimitKey(ipAddress, email), loginPolicy);
};

export const clearLoginRateLimit = (ipAddress: string, email: string) => {
  loginLimiter.reset(buildLoginRateLimitKey(ipAddress, email));
};

export const assertPasswordChangeRateLimit = (userId: string) => {
  const decision = passwordChangeLimiter.peek(buildPasswordChangeRateLimitKey(userId), passwordChangePolicy);

  if (!decision.allowed) {
    throw buildRateLimitError("PASSWORD_CHANGE_RATE_LIMITED", decision.retryAfterSeconds);
  }
};

export const recordFailedPasswordChangeAttempt = (userId: string) => {
  passwordChangeLimiter.record(buildPasswordChangeRateLimitKey(userId), passwordChangePolicy);
};

export const clearPasswordChangeRateLimit = (userId: string) => {
  passwordChangeLimiter.reset(buildPasswordChangeRateLimitKey(userId));
};

export const assertAdminPasswordResetRateLimit = (adminUserId: string, targetUserId: string) => {
  const actorDecision = adminPasswordResetLimiter.peek(
    buildAdminPasswordResetActorKey(adminUserId),
    adminPasswordResetPolicy,
  );

  if (!actorDecision.allowed) {
    throw buildRateLimitError("ADMIN_PASSWORD_RESET_RATE_LIMITED", actorDecision.retryAfterSeconds);
  }

  const targetDecision = adminPasswordResetTargetLimiter.peek(
    buildAdminPasswordResetTargetKey(targetUserId),
    adminPasswordResetTargetPolicy,
  );

  if (!targetDecision.allowed) {
    throw buildRateLimitError("ADMIN_PASSWORD_RESET_RATE_LIMITED", targetDecision.retryAfterSeconds);
  }
};

export const recordAdminPasswordResetAttempt = (adminUserId: string, targetUserId: string) => {
  adminPasswordResetLimiter.record(buildAdminPasswordResetActorKey(adminUserId), adminPasswordResetPolicy);
  adminPasswordResetTargetLimiter.record(buildAdminPasswordResetTargetKey(targetUserId), adminPasswordResetTargetPolicy);
};

export const assertPasswordRecoveryRateLimit = (ipAddress: string, email: string) => {
  const ipDecision = passwordRecoveryIpLimiter.peek(
    buildPasswordRecoveryIpKey(ipAddress),
    passwordRecoveryPolicy,
  );

  if (!ipDecision.allowed) {
    throw buildRateLimitError("PASSWORD_RECOVERY_RATE_LIMITED", ipDecision.retryAfterSeconds);
  }

  const identityDecision = passwordRecoveryIdentityLimiter.peek(
    buildPasswordRecoveryIdentityKey(email),
    passwordRecoveryPolicy,
  );

  if (!identityDecision.allowed) {
    throw buildRateLimitError("PASSWORD_RECOVERY_RATE_LIMITED", identityDecision.retryAfterSeconds);
  }
};

export const recordPasswordRecoveryAttempt = (ipAddress: string, email: string) => {
  passwordRecoveryIpLimiter.record(buildPasswordRecoveryIpKey(ipAddress), passwordRecoveryPolicy);
  passwordRecoveryIdentityLimiter.record(
    buildPasswordRecoveryIdentityKey(email),
    passwordRecoveryPolicy,
  );
};

export const assertPasswordResetRateLimit = (ipAddress: string, tokenHash: string) => {
  const ipDecision = passwordResetIpLimiter.peek(buildPasswordResetIpKey(ipAddress), passwordResetPolicy);

  if (!ipDecision.allowed) {
    throw buildRateLimitError("PASSWORD_RESET_RATE_LIMITED", ipDecision.retryAfterSeconds);
  }

  const tokenDecision = passwordResetTokenLimiter.peek(
    buildPasswordResetTokenKey(tokenHash),
    passwordResetPolicy,
  );

  if (!tokenDecision.allowed) {
    throw buildRateLimitError("PASSWORD_RESET_RATE_LIMITED", tokenDecision.retryAfterSeconds);
  }
};

export const recordPasswordResetAttempt = (ipAddress: string, tokenHash: string) => {
  passwordResetIpLimiter.record(buildPasswordResetIpKey(ipAddress), passwordResetPolicy);
  passwordResetTokenLimiter.record(buildPasswordResetTokenKey(tokenHash), passwordResetPolicy);
};

export const assertAccountInvitationAcceptRateLimit = (ipAddress: string, tokenHash: string) => {
  const ipDecision = accountInvitationIpLimiter.peek(
    buildAccountInvitationIpKey(ipAddress),
    accountInvitationAcceptPolicy,
  );

  if (!ipDecision.allowed) {
    throw buildRateLimitError("ACCOUNT_INVITATION_RATE_LIMITED", ipDecision.retryAfterSeconds);
  }

  const tokenDecision = accountInvitationTokenLimiter.peek(
    buildAccountInvitationTokenKey(tokenHash),
    accountInvitationAcceptPolicy,
  );

  if (!tokenDecision.allowed) {
    throw buildRateLimitError("ACCOUNT_INVITATION_RATE_LIMITED", tokenDecision.retryAfterSeconds);
  }
};

export const recordAccountInvitationAcceptAttempt = (ipAddress: string, tokenHash: string) => {
  accountInvitationIpLimiter.record(
    buildAccountInvitationIpKey(ipAddress),
    accountInvitationAcceptPolicy,
  );
  accountInvitationTokenLimiter.record(
    buildAccountInvitationTokenKey(tokenHash),
    accountInvitationAcceptPolicy,
  );
};

export const assertAdminInvitationRateLimit = (adminUserId: string, targetUserId: string) => {
  const actorDecision = adminInvitationActorLimiter.peek(
    buildAdminInvitationActorKey(adminUserId),
    adminInvitationPolicy,
  );

  if (!actorDecision.allowed) {
    throw buildRateLimitError("ADMIN_INVITATION_RATE_LIMITED", actorDecision.retryAfterSeconds);
  }

  const targetDecision = adminInvitationTargetLimiter.peek(
    buildAdminInvitationTargetKey(targetUserId),
    adminInvitationPolicy,
  );

  if (!targetDecision.allowed) {
    throw buildRateLimitError("ADMIN_INVITATION_RATE_LIMITED", targetDecision.retryAfterSeconds);
  }
};

export const recordAdminInvitationAttempt = (adminUserId: string, targetUserId: string) => {
  adminInvitationActorLimiter.record(
    buildAdminInvitationActorKey(adminUserId),
    adminInvitationPolicy,
  );
  adminInvitationTargetLimiter.record(
    buildAdminInvitationTargetKey(targetUserId),
    adminInvitationPolicy,
  );
};

export const assertAdminInvitationCancelRateLimit = (
  adminUserId: string,
  invitationId: string,
) => {
  const actorDecision = adminInvitationCancelActorLimiter.peek(
    buildAdminInvitationCancelActorKey(adminUserId),
    adminInvitationCancelActorPolicy,
  );

  if (!actorDecision.allowed) {
    throw buildRateLimitError(
      "ADMIN_INVITATION_CANCEL_RATE_LIMITED",
      actorDecision.retryAfterSeconds,
    );
  }

  const targetDecision = adminInvitationCancelTargetLimiter.peek(
    buildAdminInvitationCancelTargetKey(adminUserId, invitationId),
    adminInvitationCancelTargetPolicy,
  );

  if (!targetDecision.allowed) {
    throw buildRateLimitError(
      "ADMIN_INVITATION_CANCEL_RATE_LIMITED",
      targetDecision.retryAfterSeconds,
    );
  }
};

export const recordAdminInvitationCancelAttempt = (
  adminUserId: string,
  invitationId: string,
) => {
  adminInvitationCancelActorLimiter.record(
    buildAdminInvitationCancelActorKey(adminUserId),
    adminInvitationCancelActorPolicy,
  );
  adminInvitationCancelTargetLimiter.record(
    buildAdminInvitationCancelTargetKey(adminUserId, invitationId),
    adminInvitationCancelTargetPolicy,
  );
};

export const assertAdminInvitationResendRateLimit = (
  adminUserId: string,
  invitationId: string,
) => {
  const actorDecision = adminInvitationResendActorLimiter.peek(
    buildAdminInvitationResendActorKey(adminUserId),
    adminInvitationResendActorPolicy,
  );

  if (!actorDecision.allowed) {
    throw buildRateLimitError(
      "ADMIN_INVITATION_RESEND_RATE_LIMITED",
      actorDecision.retryAfterSeconds,
    );
  }

  const targetDecision = adminInvitationResendTargetLimiter.peek(
    buildAdminInvitationResendTargetKey(adminUserId, invitationId),
    adminInvitationResendTargetPolicy,
  );

  if (!targetDecision.allowed) {
    throw buildRateLimitError(
      "ADMIN_INVITATION_RESEND_RATE_LIMITED",
      targetDecision.retryAfterSeconds,
    );
  }
};

export const recordAdminInvitationResendAttempt = (
  adminUserId: string,
  invitationId: string,
) => {
  adminInvitationResendActorLimiter.record(
    buildAdminInvitationResendActorKey(adminUserId),
    adminInvitationResendActorPolicy,
  );
  adminInvitationResendTargetLimiter.record(
    buildAdminInvitationResendTargetKey(adminUserId, invitationId),
    adminInvitationResendTargetPolicy,
  );
};

export const assertAdminUserStatusRateLimit = (adminUserId: string, targetUserId: string) => {
  const actorDecision = adminUserStatusActorLimiter.peek(
    buildAdminUserStatusActorKey(adminUserId),
    adminUserStatusActorPolicy,
  );

  if (!actorDecision.allowed) {
    throw buildRateLimitError("ADMIN_USER_STATUS_RATE_LIMITED", actorDecision.retryAfterSeconds);
  }

  const targetDecision = adminUserStatusTargetLimiter.peek(
    buildAdminUserStatusTargetKey(targetUserId),
    adminUserStatusTargetPolicy,
  );

  if (!targetDecision.allowed) {
    throw buildRateLimitError("ADMIN_USER_STATUS_RATE_LIMITED", targetDecision.retryAfterSeconds);
  }
};

export const recordAdminUserStatusAttempt = (adminUserId: string, targetUserId: string) => {
  adminUserStatusActorLimiter.record(
    buildAdminUserStatusActorKey(adminUserId),
    adminUserStatusActorPolicy,
  );
  adminUserStatusTargetLimiter.record(
    buildAdminUserStatusTargetKey(targetUserId),
    adminUserStatusTargetPolicy,
  );
};

export const resetAuthRateLimitStore = () => {
  loginLimiter.resetAll();
  passwordChangeLimiter.resetAll();
  adminPasswordResetLimiter.resetAll();
  adminPasswordResetTargetLimiter.resetAll();
  passwordRecoveryIpLimiter.resetAll();
  passwordRecoveryIdentityLimiter.resetAll();
  passwordResetIpLimiter.resetAll();
  passwordResetTokenLimiter.resetAll();
  accountInvitationIpLimiter.resetAll();
  accountInvitationTokenLimiter.resetAll();
  adminInvitationActorLimiter.resetAll();
  adminInvitationTargetLimiter.resetAll();
  adminInvitationCancelActorLimiter.resetAll();
  adminInvitationCancelTargetLimiter.resetAll();
  adminInvitationResendActorLimiter.resetAll();
  adminInvitationResendTargetLimiter.resetAll();
  adminUserStatusActorLimiter.resetAll();
  adminUserStatusTargetLimiter.resetAll();
};

export const setAuthRateLimitNowProviderForTesting = (nowProvider: () => number) => {
  loginLimiter.setNowProvider(nowProvider);
  passwordChangeLimiter.setNowProvider(nowProvider);
  adminPasswordResetLimiter.setNowProvider(nowProvider);
  adminPasswordResetTargetLimiter.setNowProvider(nowProvider);
  passwordRecoveryIpLimiter.setNowProvider(nowProvider);
  passwordRecoveryIdentityLimiter.setNowProvider(nowProvider);
  passwordResetIpLimiter.setNowProvider(nowProvider);
  passwordResetTokenLimiter.setNowProvider(nowProvider);
  accountInvitationIpLimiter.setNowProvider(nowProvider);
  accountInvitationTokenLimiter.setNowProvider(nowProvider);
  adminInvitationActorLimiter.setNowProvider(nowProvider);
  adminInvitationTargetLimiter.setNowProvider(nowProvider);
  adminInvitationCancelActorLimiter.setNowProvider(nowProvider);
  adminInvitationCancelTargetLimiter.setNowProvider(nowProvider);
  adminInvitationResendActorLimiter.setNowProvider(nowProvider);
  adminInvitationResendTargetLimiter.setNowProvider(nowProvider);
  adminUserStatusActorLimiter.setNowProvider(nowProvider);
  adminUserStatusTargetLimiter.setNowProvider(nowProvider);
};

export const restoreAuthRateLimitNowProvider = () => {
  loginLimiter.restoreDefaultNowProvider();
  passwordChangeLimiter.restoreDefaultNowProvider();
  adminPasswordResetLimiter.restoreDefaultNowProvider();
  adminPasswordResetTargetLimiter.restoreDefaultNowProvider();
  passwordRecoveryIpLimiter.restoreDefaultNowProvider();
  passwordRecoveryIdentityLimiter.restoreDefaultNowProvider();
  passwordResetIpLimiter.restoreDefaultNowProvider();
  passwordResetTokenLimiter.restoreDefaultNowProvider();
  accountInvitationIpLimiter.restoreDefaultNowProvider();
  accountInvitationTokenLimiter.restoreDefaultNowProvider();
  adminInvitationActorLimiter.restoreDefaultNowProvider();
  adminInvitationTargetLimiter.restoreDefaultNowProvider();
  adminInvitationCancelActorLimiter.restoreDefaultNowProvider();
  adminInvitationCancelTargetLimiter.restoreDefaultNowProvider();
  adminInvitationResendActorLimiter.restoreDefaultNowProvider();
  adminInvitationResendTargetLimiter.restoreDefaultNowProvider();
  adminUserStatusActorLimiter.restoreDefaultNowProvider();
  adminUserStatusTargetLimiter.restoreDefaultNowProvider();
};

export const getAuthRateLimitEntryCounts = () => ({
  login: loginLimiter.getEntryCount(),
  passwordChange: passwordChangeLimiter.getEntryCount(),
  adminResetActor: adminPasswordResetLimiter.getEntryCount(),
  adminResetTarget: adminPasswordResetTargetLimiter.getEntryCount(),
  passwordRecoveryIp: passwordRecoveryIpLimiter.getEntryCount(),
  passwordRecoveryIdentity: passwordRecoveryIdentityLimiter.getEntryCount(),
  passwordResetIp: passwordResetIpLimiter.getEntryCount(),
  passwordResetToken: passwordResetTokenLimiter.getEntryCount(),
  accountInvitationIp: accountInvitationIpLimiter.getEntryCount(),
  accountInvitationToken: accountInvitationTokenLimiter.getEntryCount(),
  adminInvitationActor: adminInvitationActorLimiter.getEntryCount(),
  adminInvitationTarget: adminInvitationTargetLimiter.getEntryCount(),
  adminInvitationCancelActor: adminInvitationCancelActorLimiter.getEntryCount(),
  adminInvitationCancelTarget: adminInvitationCancelTargetLimiter.getEntryCount(),
  adminInvitationResendActor: adminInvitationResendActorLimiter.getEntryCount(),
  adminInvitationResendTarget: adminInvitationResendTargetLimiter.getEntryCount(),
  adminUserStatusActor: adminUserStatusActorLimiter.getEntryCount(),
  adminUserStatusTarget: adminUserStatusTargetLimiter.getEntryCount(),
});
