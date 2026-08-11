import { Router } from "express";

import { getPrismaClient } from "../database/prisma";
import {
  governedCorpusService,
  type GovernedCorpusOperationalStatus,
} from "../knowledge/governedCorpus";
import { asyncHandler } from "../lib/async-handler";

type DatabaseReadinessStatus = "ok" | "error" | "timeout";
type CorpusReadinessStatus =
  | "ready"
  | "empty"
  | "not_built"
  | "building"
  | "stale"
  | "invalid"
  | "unavailable";
type ReadinessStatus = "ready" | "degraded" | "not_ready";

export interface ReadinessDependencies {
  checkDatabase: () => Promise<DatabaseReadinessStatus>;
  getCorpusStatus: () => GovernedCorpusOperationalStatus;
}

export interface DatabaseReadinessOptions {
  query?: () => Promise<unknown>;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  delayFn?: (delayMs: number) => Promise<void>;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

const READINESS_DATABASE_TIMEOUT_MS = 2_000;
const READINESS_DATABASE_MAX_ATTEMPTS = 2;
const READINESS_DATABASE_RETRY_DELAY_MS = 100;

const withDatabaseTimeout = async (
  operation: Promise<DatabaseReadinessStatus>,
  options: Required<Pick<DatabaseReadinessOptions, "timeoutMs" | "setTimeoutFn" | "clearTimeoutFn">>,
): Promise<DatabaseReadinessStatus> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<DatabaseReadinessStatus>((resolve) => {
    timeout = options.setTimeoutFn(() => resolve("timeout"), options.timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) {
      options.clearTimeoutFn(timeout);
    }
  }
};

const waitForRetryDelay = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

export const checkDatabaseReadiness = async (
  options: DatabaseReadinessOptions = {},
): Promise<DatabaseReadinessStatus> => {
  const query = options.query ?? (() => getPrismaClient().$queryRaw`SELECT 1`);
  const maxAttempts = Math.max(
    1,
    Math.floor(options.maxAttempts ?? READINESS_DATABASE_MAX_ATTEMPTS),
  );
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? READINESS_DATABASE_RETRY_DELAY_MS);
  const delayFn = options.delayFn ?? waitForRetryDelay;
  let lastStatus: DatabaseReadinessStatus = "error";

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const databaseCheck = query()
        .then((): DatabaseReadinessStatus => "ok")
        .catch((): DatabaseReadinessStatus => "error");

      const status = await withDatabaseTimeout(databaseCheck, {
        timeoutMs: options.timeoutMs ?? READINESS_DATABASE_TIMEOUT_MS,
        setTimeoutFn: options.setTimeoutFn ?? setTimeout,
        clearTimeoutFn: options.clearTimeoutFn ?? clearTimeout,
      });

      if (status === "ok") {
        return "ok";
      }

      lastStatus = status;

      if (attempt < maxAttempts && retryDelayMs > 0) {
        await delayFn(retryDelayMs);
      }
    }

    return lastStatus;
  } catch (_error) {
    return "error";
  }
};

const defaultReadinessDependencies: ReadinessDependencies = {
  checkDatabase: checkDatabaseReadiness,
  getCorpusStatus: () => governedCorpusService.getOperationalStatus(),
};

let readinessDependencies = defaultReadinessDependencies;

export const setReadinessDependenciesForTesting = (dependencies: Partial<ReadinessDependencies>) => {
  readinessDependencies = {
    ...readinessDependencies,
    ...dependencies,
  };
};

export const resetReadinessDependenciesForTesting = () => {
  readinessDependencies = defaultReadinessDependencies;
};

const toCorpusReadinessStatus = (
  status: GovernedCorpusOperationalStatus,
): CorpusReadinessStatus => {
  if (status.stale) {
    return "stale";
  }

  if (status.rebuilding) {
    return "building";
  }

  if (["ready", "empty", "not_built", "invalid", "unavailable"].includes(status.state)) {
    return status.state as CorpusReadinessStatus;
  }

  return "unavailable";
};

const evaluateReadiness = (
  databaseStatus: DatabaseReadinessStatus,
  corpusStatus: CorpusReadinessStatus,
): { httpStatus: number; status: ReadinessStatus } => {
  if (databaseStatus !== "ok") {
    return { httpStatus: 503, status: "not_ready" };
  }

  if (corpusStatus === "ready" || corpusStatus === "empty") {
    return { httpStatus: 200, status: "ready" };
  }

  if (corpusStatus === "not_built" || corpusStatus === "building") {
    return { httpStatus: 200, status: "degraded" };
  }

  return { httpStatus: 503, status: "not_ready" };
};

export const readinessRouter = Router();

readinessRouter.get(
  "/ready",
  asyncHandler(async (_request, response) => {
    const [databaseStatus, operationalStatus] = await Promise.all([
      readinessDependencies.checkDatabase(),
      Promise.resolve(readinessDependencies.getCorpusStatus()),
    ]);
    const corpusStatus = toCorpusReadinessStatus(operationalStatus);
    const readiness = evaluateReadiness(databaseStatus, corpusStatus);

    response.setHeader("Cache-Control", "no-store");

    return response.status(readiness.httpStatus).json({
      status: readiness.status,
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: databaseStatus,
        },
        corpus: {
          status: corpusStatus,
        },
      },
    });
  }),
);
