import type {
  Enrollment,
  EnrollmentGroupInterest,
  EnrollmentInput,
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
  prepareStudentAccessForEnrollment,
  type StudentAccessPayload,
} from "./student-access.service";

export interface CreateEnrollmentInput extends EnrollmentInput {}
export interface UpdateEnrollmentStatusResult {
  enrollment: Enrollment;
  studentAccess: StudentAccessPayload | null;
}

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
    authRole: UserRole;
  },
): Promise<UpdateEnrollmentStatusResult | null> => {
  const currentEnrollment = await enrollmentsRepository.getById(id);

  if (!currentEnrollment) {
    return null;
  }

  const preparedStudentAccess =
    input.status === "approved"
      ? await prepareStudentAccessForEnrollment(currentEnrollment)
      : null;

  const updatedEnrollment = await enrollmentsRepository.reviewStatusWithStudentAccess(
    id,
    input,
    preparedStudentAccess ?? undefined,
  );

  if (!updatedEnrollment) {
    return null;
  }

  return {
    enrollment: updatedEnrollment,
    studentAccess: preparedStudentAccess
      ? {
          email: preparedStudentAccess.email,
          temporaryPassword: preparedStudentAccess.temporaryPassword,
          mustChangePassword: preparedStudentAccess.mustChangePassword,
        }
      : null,
  };
};

export const resetEnrollmentStore = (): void => {
  enrollmentsRepository = createMemoryEnrollmentsRepository();
};

export const setEnrollmentsRepositoryForTesting = (repository: EnrollmentsRepository): void => {
  enrollmentsRepository = repository;
};
