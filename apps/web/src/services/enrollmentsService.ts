import type {
  Enrollment,
  EnrollmentAlreadyParticipates,
  EnrollmentGroupInterest,
  EnrollmentInput,
  EnrollmentStatusUpdateResult,
  StudentAccessInfo,
} from "../types/enrollment";
import {
  createMockEnrollment,
  listMockEnrollments,
  updateMockEnrollmentStatus,
} from "../mocks/enrollments";
import { DEMO_MODE_NOTICE, appConfig } from "../config/appMode";
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

interface ApiEnrollmentStatusUpdateResult {
  enrollment: ApiEnrollment;
  studentAccess: StudentAccessInfo | null;
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

const maskEmail = (email: string) => {
  const [localPart = "participante", domain = "exemplo.com"] = email.split("@");
  const shortLocal = localPart.slice(0, 2) || "pa";
  return `${shortLocal}***@${domain}`;
};

const maskWhatsApp = (whatsapp: string) => {
  const digits = whatsapp.replace(/\D/gu, "");

  if (digits.length < 4) {
    return "Contato protegido";
  }

  const ending = digits.slice(-4);
  return `Contato protegido • ${ending}`;
};

const sanitizeEnrollment = (item: Enrollment): Enrollment => {
  if (appConfig.canUseTeacherFeatures) {
    return item;
  }

  return {
    ...item,
    fullName: `Participante ${item.id.slice(-3)}`,
    email: maskEmail(item.email),
    whatsapp: maskWhatsApp(item.whatsapp),
    teacherNote: item.teacherNote ? "Observação disponível apenas no ambiente local." : "",
  };
};

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

const mapStatusUpdateResult = (
  item: ApiEnrollmentStatusUpdateResult,
): EnrollmentStatusUpdateResult => {
  return {
    enrollment: sanitizeEnrollment(mapEnrollment(item.enrollment)),
    studentAccess: item.studentAccess,
  };
};

export const createEnrollment = (input: CreateEnrollmentInput) => {
  const { consentAccepted: _consentAccepted, ...payload } = input;

  if (!appConfig.canUseTeacherFeatures) {
    return Promise.resolve({
      data: sanitizeEnrollment(createMockEnrollment(payload)),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiEnrollment, Enrollment>({
    path: "/api/enrollments",
    init: {
      method: "POST",
      body: JSON.stringify(payload),
    },
    fallback: () => sanitizeEnrollment(createMockEnrollment(payload)),
    mapData: (item) => sanitizeEnrollment(mapEnrollment(item)),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const listEnrollments = (filters?: {
  status?: Enrollment["status"];
  groupInterest?: EnrollmentGroupInterest;
}) => {
  if (!appConfig.canUseTeacherFeatures) {
    return Promise.resolve({
      data: listMockEnrollments(filters).map(sanitizeEnrollment),
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiEnrollment[], Enrollment[]>({
    path: "/api/enrollments",
    query: {
      status: filters?.status,
      groupInterest: filters?.groupInterest,
    },
    fallback: () => listMockEnrollments(filters).map(sanitizeEnrollment),
    mapData: (items) => items.map((item) => sanitizeEnrollment(mapEnrollment(item))),
    friendlyMessage: FALLBACK_NOTICE,
  });
};

export const updateEnrollmentStatus = (id: string, input: UpdateEnrollmentStatusInput) => {
  if (!appConfig.canUseTeacherFeatures) {
    const updatedEnrollment = updateMockEnrollmentStatus(id, input);

    return Promise.resolve({
      data: updatedEnrollment
        ? {
            enrollment: sanitizeEnrollment(updatedEnrollment.enrollment),
            studentAccess: updatedEnrollment.studentAccess,
          }
        : null,
      source: "mock" as const,
      notice: DEMO_MODE_NOTICE,
    });
  }

  return loadWithFallback<ApiEnrollmentStatusUpdateResult, EnrollmentStatusUpdateResult | null>({
    path: `/api/enrollments/${id}/status`,
    init: {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    fallback: () => {
      const item = updateMockEnrollmentStatus(id, input);
      return item
        ? {
            enrollment: sanitizeEnrollment(item.enrollment),
            studentAccess: item.studentAccess,
          }
        : null;
    },
    mapData: (item) => mapStatusUpdateResult(item),
    friendlyMessage: FALLBACK_NOTICE,
  });
};
