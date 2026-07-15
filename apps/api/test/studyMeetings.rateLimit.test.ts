import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import {
  createMemoryStudyMeetingGroupsRepository,
  createMemoryStudyMeetingsAuditRepository,
  createMemoryStudyMeetingsRepository,
  createMemoryStudyMeetingsState,
  createMemoryStudyMeetingsTransactionRunner,
  getMemoryStudyMeetingsAuditLogs,
  type StudyMeetingsTransactionRunner,
} from "../src/modules/study-meetings/study-meetings.repository";
import {
  resetStudyMeetingsAdminServiceDependenciesForTesting,
  setStudyMeetingsAdminServiceDependenciesForTesting,
} from "../src/modules/study-meetings/study-meetings.service";
import {
  buildAdminStudyMeetingTargetKey,
  getAuthRateLimitEntryCounts,
  resetAuthRateLimitStore,
  restoreAuthRateLimitNowProvider,
  setAuthRateLimitNowProviderForTesting,
} from "../src/security/auth-rate-limit";

const loginAs = async (email: string, password: string) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.data?.token as string | undefined;
};

const installCountingStudyMeetingsDependencies = () => {
  const nowProvider = () => new Date("2026-07-20T12:00:00.000Z");
  const state = createMemoryStudyMeetingsState({
    groups: [{ id: "emmanuel", name: "Emmanuel", status: "active" }],
    meetings: [],
  });
  const baseRunner = createMemoryStudyMeetingsTransactionRunner(state, { nowProvider });
  let transactionCalls = 0;
  const transactionRunner: StudyMeetingsTransactionRunner = {
    async run(callback) {
      transactionCalls += 1;
      return baseRunner.run(callback);
    },
  };

  setStudyMeetingsAdminServiceDependenciesForTesting({
    readContext: {
      meetingsRepository: createMemoryStudyMeetingsRepository({ state, nowProvider }),
      groupsRepository: createMemoryStudyMeetingGroupsRepository({ state }),
      auditRepository: createMemoryStudyMeetingsAuditRepository(state),
    },
    transactionRunner,
    nowProvider,
    memoryState: state,
  });

  return {
    getTransactionCalls: () => transactionCalls,
    getAuditLogs: () => getMemoryStudyMeetingsAuditLogs(state),
  };
};

describe("admin study meetings rate limit", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAuthRateLimitStore();
    resetStudyMeetingsAdminServiceDependenciesForTesting();
    setAuthRateLimitNowProviderForTesting(() => 0);
  });

  afterEach(() => {
    restoreAuthRateLimitNowProvider();
    resetStudyMeetingsAdminServiceDependenciesForTesting();
  });

  it("limita mutacoes por admin e alvo, sem afetar leituras", async () => {
    const harness = installCountingStudyMeetingsDependencies();
    const token = await loginAs("admin.demo@example.com", "AdminDemo@123");
    let response: request.Response | undefined;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await request(app)
        .post("/api/admin/groups/grupo-inexistente/meetings")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Tentativa",
          startsAt: "2026-07-25T20:00:00Z",
          endsAt: "2026-07-25T21:00:00Z",
        });
    }

    expect(response?.status).toBe(429);
    expect(response?.body.error.code).toBe("ADMIN_STUDY_MEETING_RATE_LIMITED");
    expect(response?.body.error.details.retryAfterSeconds).toEqual(expect.any(Number));
    expect(response?.headers["retry-after"]).toEqual(expect.any(String));
    expect(getAuthRateLimitEntryCounts().adminStudyMeetingActor).toBe(1);
    expect(getAuthRateLimitEntryCounts().adminStudyMeetingTarget).toBe(1);
    expect(harness.getTransactionCalls()).toBe(5);
    expect(harness.getAuditLogs()).toHaveLength(0);

    const listResponse = await request(app)
      .get("/api/admin/groups/emmanuel/meetings")
      .set("Authorization", `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
  });

  it("isola usuarios e nao expoe alvo bruto na chave de rate limit", async () => {
    const firstAdmin = "admin-001";
    const secondAdmin = "admin-002";
    const target = "emmanuel:meeting-sensitive-id";

    expect(buildAdminStudyMeetingTargetKey(firstAdmin, target)).not.toContain(target);
    expect(buildAdminStudyMeetingTargetKey(firstAdmin, target)).not.toBe(
      buildAdminStudyMeetingTargetKey(secondAdmin, target),
    );
  });
});
