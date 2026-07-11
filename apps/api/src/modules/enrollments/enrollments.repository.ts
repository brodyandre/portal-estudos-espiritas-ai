import {
  EnrollmentStatus as PrismaEnrollmentStatus,
  UserRole as PrismaUserRole,
  type AuditLog,
  type Enrollment as PrismaEnrollment,
} from "@prisma/client";

import { enrollments as seededEnrollments } from "../../data/enrollments";
import { env } from "../../config/env";
import { getPrismaClient } from "../../database/prisma";
import type {
  Enrollment,
  EnrollmentGroupInterest,
  EnrollmentInput,
  EnrollmentStatus,
} from "../../types/enrollment";

export interface EnrollmentFilters {
  status?: EnrollmentStatus;
  groupInterest?: EnrollmentGroupInterest;
}

export interface UpdateEnrollmentStatusInput {
  status: Extract<EnrollmentStatus, "approved" | "rejected" | "needs_contact">;
  teacherNote?: string;
}

export interface EnrollmentsRepository {
  list(filters?: EnrollmentFilters): Promise<Enrollment[]>;
  getById(id: string): Promise<Enrollment | null>;
  create(input: EnrollmentInput): Promise<Enrollment>;
  updateStatus(id: string, input: UpdateEnrollmentStatusInput): Promise<Enrollment | null>;
}

const enrollmentStatusToPrisma: Record<EnrollmentStatus, PrismaEnrollmentStatus> = {
  pending: PrismaEnrollmentStatus.PENDING,
  approved: PrismaEnrollmentStatus.APPROVED,
  rejected: PrismaEnrollmentStatus.REJECTED,
  needs_contact: PrismaEnrollmentStatus.NEEDS_CONTACT,
};

const prismaStatusToEnrollment: Record<PrismaEnrollmentStatus, EnrollmentStatus> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_CONTACT: "needs_contact",
};

const mapPrismaEnrollment = (item: PrismaEnrollment): Enrollment => {
  return {
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    whatsapp: item.whatsapp,
    groupInterest: item.groupInterest as EnrollmentGroupInterest,
    alreadyParticipates: item.alreadyParticipates as Enrollment["alreadyParticipates"],
    message: item.message,
    status: prismaStatusToEnrollment[item.status],
    createdAt: item.createdAt.toISOString(),
    reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
    reviewedBy: item.reviewedBy,
    teacherNote: item.teacherNote,
  };
};

const cloneEnrollment = (item: Enrollment): Enrollment => ({ ...item });

const createAuditEntry = (
  base: Pick<AuditLog, "actorName" | "actorRole" | "action" | "entity" | "note">,
) => ({
  ...base,
  occurredAt: new Date(),
});

export const createMemoryEnrollmentsRepository = (
  seed = seededEnrollments.map((item) => ({ ...item })),
): EnrollmentsRepository => {
  const enrollmentStore = seed.map(cloneEnrollment);

  return {
    async list(filters) {
      return enrollmentStore.filter((enrollment) => {
        if (filters?.status && enrollment.status !== filters.status) {
          return false;
        }

        if (filters?.groupInterest && enrollment.groupInterest !== filters.groupInterest) {
          return false;
        }

        return true;
      });
    },

    async getById(id) {
      return enrollmentStore.find((enrollment) => enrollment.id === id) ?? null;
    },

    async create(input) {
      const createdEnrollment: Enrollment = {
        id: `enrollment-${Date.now()}`,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        whatsapp: input.whatsapp.trim(),
        groupInterest: input.groupInterest,
        alreadyParticipates: input.alreadyParticipates,
        message: input.message?.trim() ?? "",
        status: "pending",
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        teacherNote: "",
      };

      enrollmentStore.unshift(createdEnrollment);
      return cloneEnrollment(createdEnrollment);
    },

    async updateStatus(id, input) {
      const currentEnrollment = enrollmentStore.find((enrollment) => enrollment.id === id);

      if (!currentEnrollment) {
        return null;
      }

      currentEnrollment.status = input.status;
      currentEnrollment.teacherNote = input.teacherNote?.trim() ?? "";
      currentEnrollment.reviewedAt = new Date().toISOString();
      currentEnrollment.reviewedBy = "Professor";

      return cloneEnrollment(currentEnrollment);
    },
  };
};

export const createPrismaEnrollmentsRepository = (): EnrollmentsRepository => {
  const prisma = getPrismaClient();

  return {
    async list(filters) {
      const items = await prisma.enrollment.findMany({
        where: {
          status: filters?.status ? enrollmentStatusToPrisma[filters.status] : undefined,
          groupInterest: filters?.groupInterest,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return items.map(mapPrismaEnrollment);
    },

    async getById(id) {
      const item = await prisma.enrollment.findUnique({
        where: { id },
      });

      return item ? mapPrismaEnrollment(item) : null;
    },

    async create(input) {
      const createdEnrollment = await prisma.$transaction(async (transaction) => {
        const item = await transaction.enrollment.create({
          data: {
            fullName: input.fullName.trim(),
            email: input.email.trim().toLowerCase(),
            whatsapp: input.whatsapp.trim(),
            groupInterest: input.groupInterest,
            alreadyParticipates: input.alreadyParticipates,
            message: input.message?.trim() ?? "",
            status: PrismaEnrollmentStatus.PENDING,
            teacherNote: "",
          },
        });

        await transaction.auditLog.create({
          data: createAuditEntry({
            actorName: "Portal público",
            actorRole: PrismaUserRole.VISITOR,
            action: "Inscrição criada",
            entity: `Enrollment ${item.id}`,
            note: "Cadastro criado com dados mínimos no ambiente local.",
          }),
        });

        return item;
      });

      return mapPrismaEnrollment(createdEnrollment);
    },

    async updateStatus(id, input) {
      const currentEnrollment = await prisma.enrollment.findUnique({
        where: { id },
      });

      if (!currentEnrollment) {
        return null;
      }

      const updatedEnrollment = await prisma.$transaction(async (transaction) => {
        const item = await transaction.enrollment.update({
          where: { id },
          data: {
            status: enrollmentStatusToPrisma[input.status],
            teacherNote: input.teacherNote?.trim() ?? "",
            reviewedAt: new Date(),
            reviewedBy: "Professor",
          },
        });

        await transaction.auditLog.create({
          data: createAuditEntry({
            actorName: "Professor",
            actorRole: PrismaUserRole.TEACHER,
            action: "Status de inscrição atualizado",
            entity: `Enrollment ${item.id}`,
            note: `Cadastro atualizado para ${input.status}.`,
          }),
        });

        return item;
      });

      return mapPrismaEnrollment(updatedEnrollment);
    },
  };
};

export const createEnrollmentRepository = (): EnrollmentsRepository => {
  if (env.nodeEnv === "test") {
    return createMemoryEnrollmentsRepository();
  }

  return env.databaseUrl ? createPrismaEnrollmentsRepository() : createMemoryEnrollmentsRepository();
};
