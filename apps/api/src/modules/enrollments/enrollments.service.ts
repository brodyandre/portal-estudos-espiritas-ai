import type {
  Enrollment,
  EnrollmentGroupInterest,
  EnrollmentInput,
  EnrollmentStatusUpdateResult,
  EnrollmentStatus,
} from "../../types/enrollment";
import type { UserRole } from "../../auth/types";
import type { EnrollmentsRepository } from "./enrollments.repository";
import {
  createEnrollmentRepository,
  createMemoryEnrollmentsRepository,
  type EnrollmentFilters,
  type UpdateEnrollmentStatusInput,
} from "./enrollments.repository";
import {
  prepareEnrollmentInvitationForEnrollment,
} from "./student-access.service";
import {
  buildInviteOnlyPasswordHash,
  processAccountInvitationDelivery,
} from "../auth/auth.service";
import { createHmac, randomBytes } from "node:crypto";
import { env } from "../../config/env";

export interface CreateEnrollmentInput extends EnrollmentInput {}

let enrollmentsRepository: EnrollmentsRepository = createEnrollmentRepository();

export const isEnrollmentStatus = (value: string): value is EnrollmentStatus => {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "needs_contact"
  );
};

export const isEnrollmentGroupInterest = (value: string): value is EnrollmentGroupInterest => {
  return value === "Emmanuel" || value === "A Caminho da Luz" || value === "Ainda não sei";
};

export const listEnrollments = (filters?: EnrollmentFilters) => {
  return enrollmentsRepository.list(filters);
};

export const getEnrollmentById = (id: string) => {
  return enrollmentsRepository.getById(id);
};

export const createEnrollment = (input: CreateEnrollmentInput) => {
  return enrollmentsRepository.create(input);
};

export const updateEnrollmentStatus = (id: string, input: UpdateEnrollmentStatusInput) => {
  return enrollmentsRepository.updateStatus(id, input);
};

export const updateEnrollmentStatusWithStudentAccess = async (
  id: string,
  input: UpdateEnrollmentStatusInput & {
    actorName: string;
    actorUserId?: string;
    authRole: UserRole;
  },
): Promise<EnrollmentStatusUpdateResult | null> => {
  const currentEnrollment = await enrollmentsRepository.getById(id);

  if (!currentEnrollment) {
    return null;
  }

  if (input.status === "approved") {
    const preparedInvitationContext = prepareEnrollmentInvitationForEnrollment(currentEnrollment, {
      actorName: input.actorName,
      actorRole: input.authRole === "admin" ? "admin" : "teacher",
    });
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHmac("sha256", env.jwtSecret).update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const placeholderPasswordHash = await buildInviteOnlyPasswordHash();
    const approved = await enrollmentsRepository.approveWithInvitation({
      enrollmentId: id,
      teacherNote: input.teacherNote,
      reviewedByName: input.reviewedByName,
      persistenceActorRole:
        input.authRole === "admin" ? "ADMIN" : input.authRole === "teacher" ? "TEACHER" : undefined,
      fullName: preparedInvitationContext.fullName,
      email: preparedInvitationContext.email,
      whatsapp: preparedInvitationContext.whatsapp,
      groupName: preparedInvitationContext.groupName,
      groupSlug: preparedInvitationContext.groupSlug,
      placeholderPasswordHash,
      tokenHash,
      expiresAt,
      invitedByUserId: input.actorUserId ?? null,
      actorName: input.actorName,
      actorRole: input.authRole,
    });

    if (!approved) {
      return null;
    }

    const delivery = await processAccountInvitationDelivery({
      invitationId: approved.invitation.id,
      rawToken,
      recipientEmail: approved.user.email,
      recipientName: approved.user.fullName,
      invitationType: "enrollment_approval",
      expiresAt: approved.invitation.expiresAt,
      actorName: input.actorName,
      actorRole: input.authRole,
      strict: false,
    });

    return {
      enrollment: approved.enrollment,
      studentAccess: {
        email: approved.user.email,
        invitationType: "enrollment_approval",
        deliveryStatus: delivery.deliveryStatus,
        expiresAt: approved.invitation.expiresAt,
        mustCreatePassword: true,
      },
    };
  }

  const updatedEnrollment = await enrollmentsRepository.reviewStatusWithStudentAccess(
    id,
    input,
    undefined,
  );

  if (!updatedEnrollment) {
    return null;
  }

  return {
    enrollment: updatedEnrollment,
    studentAccess: null,
  };
};

export const resetEnrollmentStore = (): void => {
  enrollmentsRepository = createMemoryEnrollmentsRepository();
};

export const setEnrollmentsRepositoryForTesting = (repository: EnrollmentsRepository): void => {
  enrollmentsRepository = repository;
};
