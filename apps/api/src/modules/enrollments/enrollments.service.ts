import type {
  EnrollmentGroupInterest,
  EnrollmentInput,
  EnrollmentStatus,
} from "../../types/enrollment";
import type { EnrollmentsRepository } from "./enrollments.repository";
import {
  createEnrollmentRepository,
  createMemoryEnrollmentsRepository,
  type EnrollmentFilters,
  type UpdateEnrollmentStatusInput,
} from "./enrollments.repository";

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

export const resetEnrollmentStore = (): void => {
  enrollmentsRepository = createMemoryEnrollmentsRepository();
};

export const setEnrollmentsRepositoryForTesting = (repository: EnrollmentsRepository): void => {
  enrollmentsRepository = repository;
};
