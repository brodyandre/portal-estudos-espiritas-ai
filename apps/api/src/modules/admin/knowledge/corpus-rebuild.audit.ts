import { randomUUID } from "node:crypto";

import {
  UserRole as PrismaUserRole,
  type PrismaClient,
} from "@prisma/client";

import type { UserRole } from "../../../auth/types";
import { env } from "../../../config/env";
import { getPrismaClient } from "../../../database/prisma";
import type { AuthUser } from "../../auth/auth.types";

export const KNOWLEDGE_CORPUS_REBUILD_ACTION_REQUESTED =
  "KNOWLEDGE_CORPUS_REBUILD_REQUESTED";
export const KNOWLEDGE_CORPUS_REBUILD_ACTION_SUCCEEDED =
  "KNOWLEDGE_CORPUS_REBUILD_SUCCEEDED";
export const KNOWLEDGE_CORPUS_REBUILD_ACTION_FAILED =
  "KNOWLEDGE_CORPUS_REBUILD_FAILED";

const KNOWLEDGE_CORPUS_REBUILD_ENTITY = "KnowledgeCorpus governed";

export type KnowledgeCorpusRebuildAuditAction =
  | typeof KNOWLEDGE_CORPUS_REBUILD_ACTION_REQUESTED
  | typeof KNOWLEDGE_CORPUS_REBUILD_ACTION_SUCCEEDED
  | typeof KNOWLEDGE_CORPUS_REBUILD_ACTION_FAILED;

export interface KnowledgeCorpusRebuildAuditEntry {
  actorName: string;
  actorRole: UserRole;
  action: KnowledgeCorpusRebuildAuditAction;
  entity: string;
  note: string;
}

export interface KnowledgeCorpusRebuildAuditRepository {
  create(entry: KnowledgeCorpusRebuildAuditEntry): Promise<void>;
}

export interface KnowledgeCorpusRebuildAuditBase {
  actor: AuthUser;
  correlationId: string;
}

export interface KnowledgeCorpusRebuildAuditTerminalInput extends KnowledgeCorpusRebuildAuditBase {
  durationMs: number;
  finalState: string;
  manifestSourceCount: number;
  documentCount: number;
  chunkCount: number;
  hadPublishedSnapshot: boolean;
}

export interface KnowledgeCorpusRebuildAuditFailedInput extends KnowledgeCorpusRebuildAuditTerminalInput {
  code: string;
}

type KnowledgeCorpusRebuildAuditPersistenceClient = Pick<PrismaClient, "auditLog">;

const memoryAuditLogs: KnowledgeCorpusRebuildAuditEntry[] = [];

const toPrismaUserRole = (role: UserRole): PrismaUserRole => {
  const map: Record<UserRole, PrismaUserRole> = {
    visitor: PrismaUserRole.VISITOR,
    student: PrismaUserRole.STUDENT,
    teacher: PrismaUserRole.TEACHER,
    admin: PrismaUserRole.ADMIN,
  };

  return map[role];
};

const cloneAuditEntry = (
  entry: KnowledgeCorpusRebuildAuditEntry,
): KnowledgeCorpusRebuildAuditEntry => ({ ...entry });

const normalizeDurationMs = (durationMs: number) =>
  Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : 0;

const buildBaseEntry = (
  input: KnowledgeCorpusRebuildAuditBase,
  action: KnowledgeCorpusRebuildAuditAction,
  note: string,
): KnowledgeCorpusRebuildAuditEntry => ({
  actorName: input.actor.fullName,
  actorRole: input.actor.role,
  action,
  entity: KNOWLEDGE_CORPUS_REBUILD_ENTITY,
  note,
});

export const createKnowledgeCorpusRebuildCorrelationId = () =>
  `knowledge-corpus-rebuild:${randomUUID()}`;

export const buildKnowledgeCorpusRebuildRequestedAuditEntry = (
  input: KnowledgeCorpusRebuildAuditBase & {
    hadPublishedSnapshot: boolean;
  },
) =>
  buildBaseEntry(
    input,
    KNOWLEDGE_CORPUS_REBUILD_ACTION_REQUESTED,
    [
      `correlationId=${input.correlationId}`,
      "result=requested",
      `hadPublishedSnapshot=${input.hadPublishedSnapshot}`,
    ].join("; "),
  );

export const buildKnowledgeCorpusRebuildSucceededAuditEntry = (
  input: KnowledgeCorpusRebuildAuditTerminalInput,
) =>
  buildBaseEntry(
    input,
    KNOWLEDGE_CORPUS_REBUILD_ACTION_SUCCEEDED,
    [
      `correlationId=${input.correlationId}`,
      "result=succeeded",
      `durationMs=${normalizeDurationMs(input.durationMs)}`,
      `finalState=${input.finalState}`,
      `manifestSourceCount=${input.manifestSourceCount}`,
      `documentCount=${input.documentCount}`,
      `chunkCount=${input.chunkCount}`,
      `hadPublishedSnapshot=${input.hadPublishedSnapshot}`,
    ].join("; "),
  );

export const buildKnowledgeCorpusRebuildFailedAuditEntry = (
  input: KnowledgeCorpusRebuildAuditFailedInput,
) =>
  buildBaseEntry(
    input,
    KNOWLEDGE_CORPUS_REBUILD_ACTION_FAILED,
    [
      `correlationId=${input.correlationId}`,
      "result=failed",
      `code=${input.code}`,
      `durationMs=${normalizeDurationMs(input.durationMs)}`,
      `finalState=${input.finalState}`,
      `manifestSourceCount=${input.manifestSourceCount}`,
      `documentCount=${input.documentCount}`,
      `chunkCount=${input.chunkCount}`,
      `hadPublishedSnapshot=${input.hadPublishedSnapshot}`,
    ].join("; "),
  );

export const createMemoryKnowledgeCorpusRebuildAuditRepository = (
  store = memoryAuditLogs,
): KnowledgeCorpusRebuildAuditRepository => ({
  async create(entry) {
    store.unshift(cloneAuditEntry(entry));
  },
});

export const createPrismaKnowledgeCorpusRebuildAuditRepository = (
  prisma: KnowledgeCorpusRebuildAuditPersistenceClient = getPrismaClient(),
): KnowledgeCorpusRebuildAuditRepository => ({
  async create(entry) {
    await prisma.auditLog.create({
      data: {
        actorName: entry.actorName,
        actorRole: toPrismaUserRole(entry.actorRole),
        action: entry.action,
        entity: entry.entity,
        note: entry.note,
      },
    });
  },
});

let knowledgeCorpusRebuildAuditRepository: KnowledgeCorpusRebuildAuditRepository =
  env.nodeEnv === "test"
    ? createMemoryKnowledgeCorpusRebuildAuditRepository()
    : createPrismaKnowledgeCorpusRebuildAuditRepository();

export const getKnowledgeCorpusRebuildAuditRepository = () =>
  knowledgeCorpusRebuildAuditRepository;

export const setKnowledgeCorpusRebuildAuditRepositoryForTesting = (
  repository: KnowledgeCorpusRebuildAuditRepository,
) => {
  knowledgeCorpusRebuildAuditRepository = repository;
};

export const resetKnowledgeCorpusRebuildAuditRepositoryForTesting = () => {
  memoryAuditLogs.length = 0;
  knowledgeCorpusRebuildAuditRepository =
    env.nodeEnv === "test"
      ? createMemoryKnowledgeCorpusRebuildAuditRepository()
      : createPrismaKnowledgeCorpusRebuildAuditRepository();
};

export const getMemoryKnowledgeCorpusRebuildAuditLogsForTesting = () =>
  memoryAuditLogs.map(cloneAuditEntry);
