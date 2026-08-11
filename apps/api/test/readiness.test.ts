import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import {
  governedCorpusService,
  type GovernedCorpusOperationalStatus,
} from "../src/knowledge/governedCorpus";
import {
  checkDatabaseReadiness,
  resetReadinessDependenciesForTesting,
  setReadinessDependenciesForTesting,
} from "../src/routes/readiness.routes";

const buildStatus = (
  overrides: Partial<GovernedCorpusOperationalStatus> = {},
): GovernedCorpusOperationalStatus => ({
  state: "ready",
  rebuilding: false,
  stale: false,
  manifestSourceCount: 2,
  documentCount: 2,
  chunkCount: 14,
  manifestFingerprint: "manifest-fingerprint-that-must-not-leak",
  corpusFingerprint: "corpus-fingerprint-that-must-not-leak",
  lastAttemptAt: "2026-07-17T01:00:00.000Z",
  lastSuccessfulBuildAt: "2026-07-17T01:00:01.000Z",
  lastFailure: null,
  ...overrides,
});

describe("readiness endpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetReadinessDependenciesForTesting();
  });

  it("/health continua simples e não consulta banco nem corpus", async () => {
    const getOperationalStatus = vi.spyOn(governedCorpusService, "getOperationalStatus");
    const getSnapshot = vi.spyOn(governedCorpusService, "getSnapshot");
    setReadinessDependenciesForTesting({
      checkDatabase: vi.fn(async () => "error"),
    });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
    expect(getOperationalStatus).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    ["ready", buildStatus({ state: "ready" }), 200, "ready", "ready"],
    ["empty", buildStatus({ state: "empty" }), 200, "ready", "empty"],
    ["not_built", buildStatus({ state: "not_built" }), 200, "degraded", "not_built"],
    ["building", buildStatus({ rebuilding: true }), 200, "degraded", "building"],
    ["stale", buildStatus({ stale: true }), 503, "not_ready", "stale"],
    ["invalid", buildStatus({ state: "invalid" }), 503, "not_ready", "invalid"],
    ["unavailable", buildStatus({ state: "unavailable" }), 503, "not_ready", "unavailable"],
  ])(
    "/ready com DB ok e corpus %s",
    async (_caseName, corpusStatus, expectedHttpStatus, expectedStatus, expectedCorpusStatus) => {
      const getSnapshot = vi.spyOn(governedCorpusService, "getSnapshot");
      setReadinessDependenciesForTesting({
        checkDatabase: vi.fn(async () => "ok"),
        getCorpusStatus: () => corpusStatus,
      });

      const response = await request(app).get("/ready");

      expect(response.status).toBe(expectedHttpStatus);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toMatchObject({
        status: expectedStatus,
        checks: {
          database: {
            status: "ok",
          },
          corpus: {
            status: expectedCorpusStatus,
          },
        },
      });
      expect(typeof response.body.timestamp).toBe("string");
      expect(getSnapshot).not.toHaveBeenCalled();
      expect(JSON.stringify(response.body)).not.toContain("fingerprint");
      expect(JSON.stringify(response.body)).not.toContain("data/knowledge");
      expect(JSON.stringify(response.body)).not.toContain("lastFailure");
      expect(JSON.stringify(response.body)).not.toContain("stack");
    },
  );

  it.each([
    ["error", 503, "not_ready"],
    ["timeout", 503, "not_ready"],
  ] as const)("/ready retorna 503 quando DB está %s", async (databaseStatus, expectedHttpStatus, expectedStatus) => {
    setReadinessDependenciesForTesting({
      checkDatabase: vi.fn(async () => databaseStatus),
      getCorpusStatus: () => buildStatus({ state: "ready" }),
    });

    const response = await request(app).get("/ready");

    expect(response.status).toBe(expectedHttpStatus);
    expect(response.body.status).toBe(expectedStatus);
    expect(response.body.checks.database.status).toBe(databaseStatus);
    expect(response.body.checks.corpus.status).toBe("ready");
  });

  it("falha de forma conservadora para estado desconhecido do corpus", async () => {
    setReadinessDependenciesForTesting({
      checkDatabase: vi.fn(async () => "ok"),
      getCorpusStatus: () =>
        ({
          ...buildStatus(),
          state: "misterioso",
        }) as unknown as GovernedCorpusOperationalStatus,
    });

    const response = await request(app).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("not_ready");
    expect(response.body.checks.corpus.status).toBe("unavailable");
  });

  it("cancela o timer quando a consulta de banco termina antes do timeout", async () => {
    const timeoutHandle = { id: "readiness-timeout" } as unknown as NodeJS.Timeout;
    const setTimeoutFn = vi.fn((_callback: () => void, _timeoutMs: number) => timeoutHandle);
    const clearTimeoutFn = vi.fn();
    const query = vi.fn(async () => 1);
    const delayFn = vi.fn(async () => undefined);

    await expect(
      checkDatabaseReadiness({
        query,
        timeoutMs: 2_000,
        delayFn,
        setTimeoutFn,
        clearTimeoutFn,
      }),
    ).resolves.toBe("ok");

    expect(query).toHaveBeenCalledTimes(1);
    expect(delayFn).not.toHaveBeenCalled();
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 2_000);
    expect(clearTimeoutFn).toHaveBeenCalledWith(timeoutHandle);
  });

  it("recupera quando a primeira tentativa de banco falha e o retry funciona", async () => {
    const query = vi.fn().mockRejectedValueOnce(new Error("transient connection error")).mockResolvedValueOnce(1);
    const delayFn = vi.fn(async () => undefined);

    await expect(
      checkDatabaseReadiness({
        query,
        retryDelayMs: 100,
        delayFn,
      }),
    ).resolves.toBe("ok");

    expect(query).toHaveBeenCalledTimes(2);
    expect(delayFn).toHaveBeenCalledTimes(1);
    expect(delayFn).toHaveBeenCalledWith(100);
  });

  it("retorna timeout quando todas as tentativas atingem o timeout", async () => {
    const timeoutHandle = { id: "readiness-timeout" } as unknown as NodeJS.Timeout;
    const query = vi.fn(() => new Promise(() => undefined));
    const setTimeoutFn = vi.fn((callback: () => void, _timeoutMs: number) => {
      callback();
      return timeoutHandle;
    });
    const clearTimeoutFn = vi.fn();
    const delayFn = vi.fn(async () => undefined);

    await expect(
      checkDatabaseReadiness({
        query,
        maxAttempts: 2,
        retryDelayMs: 100,
        delayFn,
        setTimeoutFn,
        clearTimeoutFn,
      }),
    ).resolves.toBe("timeout");

    expect(query).toHaveBeenCalledTimes(2);
    expect(delayFn).toHaveBeenCalledTimes(1);
    expect(setTimeoutFn).toHaveBeenCalledTimes(2);
    expect(clearTimeoutFn).toHaveBeenCalledTimes(2);
  });

  it("retorna error quando todas as tentativas falham e respeita o limite maximo", async () => {
    const query = vi.fn().mockRejectedValue(new Error("postgres://user:password@private-host:5432/db"));
    const delayFn = vi.fn(async () => undefined);

    await expect(
      checkDatabaseReadiness({
        query,
        maxAttempts: 2,
        retryDelayMs: 100,
        delayFn,
      }),
    ).resolves.toBe("error");

    expect(query).toHaveBeenCalledTimes(2);
    expect(delayFn).toHaveBeenCalledTimes(1);
  });

  it("/ready permanece sanitizado quando o banco falha persistentemente", async () => {
    setReadinessDependenciesForTesting({
      checkDatabase: vi.fn(async () => "error"),
      getCorpusStatus: () =>
        buildStatus({
          lastFailure: "postgres://user:password@private-host:5432/db stack trace",
        }),
    });

    const response = await request(app).get("/ready");
    const serializedBody = JSON.stringify(response.body);

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("not_ready");
    expect(response.body.checks.database.status).toBe("error");
    expect(serializedBody).not.toContain("postgres://");
    expect(serializedBody).not.toContain("password");
    expect(serializedBody).not.toContain("private-host");
    expect(serializedBody).not.toContain("stack trace");
  });
});
