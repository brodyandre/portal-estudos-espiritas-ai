import { beforeEach, describe, expect, it } from "vitest";

import {
  assertLoginRateLimit,
  assertAdminInvitationCancelRateLimit,
  assertAdminInvitationResendRateLimit,
  buildAdminInvitationCancelTargetKey,
  buildAdminInvitationResendTargetKey,
  buildLoginRateLimitKey,
  clearLoginRateLimit,
  getAuthRateLimitEntryCounts,
  recordAdminInvitationCancelAttempt,
  recordAdminInvitationResendAttempt,
  recordFailedLoginAttempt,
  resetAuthRateLimitStore,
  restoreAuthRateLimitNowProvider,
  setAuthRateLimitNowProviderForTesting,
} from "../src/security/auth-rate-limit";

describe("auth rate limit store", () => {
  let currentTime = 0;

  beforeEach(() => {
    currentTime = 0;
    resetAuthRateLimitStore();
    setAuthRateLimitNowProviderForTesting(() => currentTime);
  });

  it("remove entradas expiradas sem usar sleep real", () => {
    const email = "aluno.demo@example.com";

    recordFailedLoginAttempt("127.0.0.1", email);
    expect(getAuthRateLimitEntryCounts().login).toBe(1);

    currentTime += 16 * 60 * 1000;

    expect(() => assertLoginRateLimit("127.0.0.1", email)).not.toThrow();
    expect(getAuthRateLimitEntryCounts().login).toBe(0);
  });

  it("permite resetar manualmente o contador de uma identidade", () => {
    const keyEmail = "admin.demo@example.com";

    recordFailedLoginAttempt("127.0.0.1", keyEmail);
    expect(getAuthRateLimitEntryCounts().login).toBe(1);

    clearLoginRateLimit("127.0.0.1", keyEmail);

    expect(getAuthRateLimitEntryCounts().login).toBe(0);
  });

  it("normaliza a mesma identidade por meio da chave interna", () => {
    const firstKey = buildLoginRateLimitKey("127.0.0.1", "  ADMIN.DEMO@example.com ");
    const secondKey = buildLoginRateLimitKey("127.0.0.1", "admin.demo@example.com");

    expect(firstKey).toBe(secondKey);
  });

  it("limita cancelamento de convite por ator e convite sem expor id bruto na chave alvo", () => {
    const invitationId = "account-invitation-sensitive-id";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(() => assertAdminInvitationCancelRateLimit("admin-001", invitationId)).not.toThrow();
      recordAdminInvitationCancelAttempt("admin-001", invitationId);
    }

    expect(() => assertAdminInvitationCancelRateLimit("admin-001", invitationId)).toThrow(
      "Muitas tentativas. Aguarde antes de tentar novamente.",
    );
    expect(getAuthRateLimitEntryCounts().adminInvitationCancelActor).toBe(1);
    expect(getAuthRateLimitEntryCounts().adminInvitationCancelTarget).toBe(1);
    expect(buildAdminInvitationCancelTargetKey("admin-001", invitationId)).not.toContain(invitationId);
  });

  it("limita reenvio de convite por ator e convite sem compartilhar contador com cancelamento", () => {
    const invitationId = "account-invitation-resend-sensitive-id";

    recordAdminInvitationCancelAttempt("admin-001", invitationId);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(() => assertAdminInvitationResendRateLimit("admin-001", invitationId)).not.toThrow();
      recordAdminInvitationResendAttempt("admin-001", invitationId);
    }

    expect(() => assertAdminInvitationResendRateLimit("admin-001", invitationId)).toThrow(
      "Muitas tentativas. Aguarde antes de tentar novamente.",
    );
    expect(getAuthRateLimitEntryCounts().adminInvitationCancelActor).toBe(1);
    expect(getAuthRateLimitEntryCounts().adminInvitationResendActor).toBe(1);
    expect(getAuthRateLimitEntryCounts().adminInvitationResendTarget).toBe(1);
    expect(buildAdminInvitationResendTargetKey("admin-001", invitationId)).not.toContain(invitationId);
  });

  it("restaura o relogio padrao apos usar nowProvider de teste", () => {
    recordFailedLoginAttempt("127.0.0.1", "admin.demo@example.com");

    currentTime += 16 * 60 * 1000;
    expect(() => assertLoginRateLimit("127.0.0.1", "admin.demo@example.com")).not.toThrow();

    setAuthRateLimitNowProviderForTesting(() => 0);
    recordFailedLoginAttempt("127.0.0.1", "admin.demo@example.com");

    restoreAuthRateLimitNowProvider();
    expect(() => assertLoginRateLimit("127.0.0.1", "admin.demo@example.com")).not.toThrow();
  });
});
