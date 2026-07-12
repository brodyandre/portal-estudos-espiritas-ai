import { createHmac } from "node:crypto";

import { env } from "../config/env";
import { AppError } from "../lib/app-error";
import { MemorySlidingWindowRateLimiter, type RateLimitPolicy } from "./rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

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

const loginLimiter = new MemorySlidingWindowRateLimiter();
const passwordChangeLimiter = new MemorySlidingWindowRateLimiter();
const adminPasswordResetLimiter = new MemorySlidingWindowRateLimiter();
const adminPasswordResetTargetLimiter = new MemorySlidingWindowRateLimiter();

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
    | "ADMIN_PASSWORD_RESET_RATE_LIMITED",
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

export const resetAuthRateLimitStore = () => {
  loginLimiter.resetAll();
  passwordChangeLimiter.resetAll();
  adminPasswordResetLimiter.resetAll();
  adminPasswordResetTargetLimiter.resetAll();
};

export const setAuthRateLimitNowProviderForTesting = (nowProvider: () => number) => {
  loginLimiter.setNowProvider(nowProvider);
  passwordChangeLimiter.setNowProvider(nowProvider);
  adminPasswordResetLimiter.setNowProvider(nowProvider);
  adminPasswordResetTargetLimiter.setNowProvider(nowProvider);
};

export const restoreAuthRateLimitNowProvider = () => {
  loginLimiter.restoreDefaultNowProvider();
  passwordChangeLimiter.restoreDefaultNowProvider();
  adminPasswordResetLimiter.restoreDefaultNowProvider();
  adminPasswordResetTargetLimiter.restoreDefaultNowProvider();
};

export const getAuthRateLimitEntryCounts = () => ({
  login: loginLimiter.getEntryCount(),
  passwordChange: passwordChangeLimiter.getEntryCount(),
  adminResetActor: adminPasswordResetLimiter.getEntryCount(),
  adminResetTarget: adminPasswordResetTargetLimiter.getEntryCount(),
});
