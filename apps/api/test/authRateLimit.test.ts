import { beforeEach, describe, expect, it } from "vitest";

import {
  assertLoginRateLimit,
  buildLoginRateLimitKey,
  clearLoginRateLimit,
  getAuthRateLimitEntryCounts,
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
