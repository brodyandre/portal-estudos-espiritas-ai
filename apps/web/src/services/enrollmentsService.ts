import type {
  Enrollment,
  EnrollmentAlreadyParticipates,
  EnrollmentGroupInterest,
  EnrollmentInput,
} from "../types/enrollment";
import {
  createMockEnrollment,
  listMockEnrollments,
  updateMockEnrollmentStatus,
} from "../mocks/enrollments";
import { loadWithFallback } from "./api";

interface ApiEnrollment {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  groupInterest: EnrollmentGroupInterest;
  alreadyParticipates: EnrollmentAlreadyParticipates;
  message: string;
  status: Enrollment["status"];
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  teacherNote: string;
}

export interface CreateEnrollmentInput extends EnrollmentInput {
  consentAccepted: boolean;
}

export interface UpdateEnrollmentStatusInput {
  status: Extract<Enrollment["status"], "approved" | "rejected" | "needs_contact">;
  teacherNote?: string;
}

const FALLBACK_NOTICE =
  "Modo demonstrativo: para aprovação real de alunos, rode o backend local.";

const mapEnrollment = (item: ApiEnrollment): Enrollment => {
  return {
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    whatsapp: item.whatsapp,
    groupInterest: item.groupInterest,
    alreadyParticipates: item.alreadyParticipates,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
    reviewedAt: item.reviewedAt,
    reviewedBy: item.reviewedBy,
    teacherNote: item.teacherNote,
  };
};

export const createEnrollment = (input: CreateEnrollmentInput) => {
  const { consentAccepted: _consentAccepted, ...payload } = input;

  return loadWithFallback<ApiEnrollment, Enrollment>({
    path: "/api/enrollments",
    init: {
      method: "POST",
      body: JSON.stringify(payload),
    },
    fallback: () => createMockEnrollment(payload),
    mapData: mapEnrollment,
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const listEnrollments = (filters?: {
  status?: Enrollment["status"];
  groupInterest?: EnrollmentGroupInterest;
}) => {
  return loadWithFallback<ApiEnrollment[], Enrollment[]>({
    path: "/api/enrollments",
    query: {
      status: filters?.status,
      groupInterest: filters?.groupInterest,
    },
    fallback: () => listMockEnrollments(filters),
    mapData: (items) => items.map(mapEnrollment),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const updateEnrollmentStatus = (id: string, input: UpdateEnrollmentStatusInput) => {
  return loadWithFallback<ApiEnrollment, Enrollment | null>({
    path: `/api/enrollments/${id}/status`,
    init: {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    fallback: () => updateMockEnrollmentStatus(id, input),
    mapData: mapEnrollment,
    friendlyMessage: FALLBACK_NOTICE,
  });
};
