import { enrollments as seededEnrollments } from "../../data/enrollments";
import type {
  Enrollment,
  EnrollmentGroupInterest,
  EnrollmentInput,
  EnrollmentStatus,
} from "../../types/enrollment";

export interface CreateEnrollmentInput extends EnrollmentInput {}

export interface UpdateEnrollmentStatusInput {
  status: Extract<EnrollmentStatus, "approved" | "rejected" | "needs_contact">;
  teacherNote?: string;
}

const enrollmentStore: Enrollment[] = seededEnrollments.map((item) => ({ ...item }));

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

export const listEnrollments = (filters?: {
  status?: EnrollmentStatus;
  groupInterest?: EnrollmentGroupInterest;
}): Enrollment[] => {
  return enrollmentStore.filter((enrollment) => {
    if (filters?.status && enrollment.status !== filters.status) {
      return false;
    }

    if (filters?.groupInterest && enrollment.groupInterest !== filters.groupInterest) {
      return false;
    }

    return true;
  });
};

export const getEnrollmentById = (id: string): Enrollment | undefined => {
  return enrollmentStore.find((enrollment) => enrollment.id === id);
};

export const createEnrollment = (input: CreateEnrollmentInput): Enrollment => {
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

  return createdEnrollment;
};

export const updateEnrollmentStatus = (
  id: string,
  input: UpdateEnrollmentStatusInput,
): Enrollment | undefined => {
  const currentEnrollment = enrollmentStore.find((enrollment) => enrollment.id === id);

  if (!currentEnrollment) {
    return undefined;
  }

  currentEnrollment.status = input.status;
  currentEnrollment.teacherNote = input.teacherNote?.trim() ?? "";
  currentEnrollment.reviewedAt = new Date().toISOString();
  currentEnrollment.reviewedBy = "Professor";

  return currentEnrollment;
};

export const resetEnrollmentStore = (): void => {
  enrollmentStore.splice(0, enrollmentStore.length, ...seededEnrollments.map((item) => ({ ...item })));
};
