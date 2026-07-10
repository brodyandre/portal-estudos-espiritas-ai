import {
  ENROLLMENT_PARTICIPATION_OPTIONS,
  type Enrollment,
  type EnrollmentAlreadyParticipates,
  type EnrollmentGroupInterest,
  type EnrollmentInput,
} from "../types/enrollment";
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

const createMockEnrollment = (input: CreateEnrollmentInput): Enrollment => {
  const now = new Date().toISOString();

  return {
    id: `enrollment-demo-${Date.now()}`,
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    whatsapp: input.whatsapp.trim(),
    groupInterest: input.groupInterest,
    alreadyParticipates: ENROLLMENT_PARTICIPATION_OPTIONS.includes(input.alreadyParticipates)
      ? input.alreadyParticipates
      : "Não",
    message: input.message?.trim() ?? "",
    status: "pending",
    createdAt: now,
    reviewedAt: null,
    reviewedBy: null,
    teacherNote: "",
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
    fallback: () => createMockEnrollment(input),
    mapData: mapEnrollment,
    friendlyMessage:
      "Seu cadastro foi registrado em modo demonstrativo. Quando a API estiver disponivel, ele podera ser enviado ao servidor.",
  });
};
