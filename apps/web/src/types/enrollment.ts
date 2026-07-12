export const ENROLLMENT_GROUP_INTERESTS = [
  "Emmanuel",
  "A Caminho da Luz",
  "Ainda não sei",
] as const;

export const ENROLLMENT_PARTICIPATION_OPTIONS = [
  "Sim",
  "Não",
  "Já participei antes",
] as const;

export const ENROLLMENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "needs_contact",
] as const;

export type EnrollmentGroupInterest = (typeof ENROLLMENT_GROUP_INTERESTS)[number];
export type EnrollmentAlreadyParticipates = (typeof ENROLLMENT_PARTICIPATION_OPTIONS)[number];
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export interface Enrollment {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  groupInterest: EnrollmentGroupInterest;
  alreadyParticipates: EnrollmentAlreadyParticipates;
  message: string;
  status: EnrollmentStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  teacherNote: string;
}

export interface StudentAccessInfo {
  email: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}

export interface EnrollmentStatusUpdateResult {
  enrollment: Enrollment;
  studentAccess: StudentAccessInfo | null;
}

export interface EnrollmentInput {
  fullName: string;
  email: string;
  whatsapp: string;
  groupInterest: EnrollmentGroupInterest;
  alreadyParticipates: EnrollmentAlreadyParticipates;
  message?: string;
  teacherNote?: string;
}

export interface EnrollmentValidationErrors {
  fullName?: string;
  email?: string;
  whatsapp?: string;
  groupInterest?: string;
  message?: string;
  teacherNote?: string;
}

export const ENROLLMENT_MESSAGE_MAX_LENGTH = 320;
export const ENROLLMENT_TEACHER_NOTE_MAX_LENGTH = 320;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const isValidEnrollmentEmail = (value: string) => {
  return EMAIL_PATTERN.test(value.trim());
};

export const validateEnrollmentInput = (
  input: Partial<EnrollmentInput>,
): EnrollmentValidationErrors => {
  const errors: EnrollmentValidationErrors = {};
  const fullName = input.fullName?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const whatsapp = input.whatsapp?.trim() ?? "";
  const message = input.message?.trim() ?? "";
  const teacherNote = input.teacherNote?.trim() ?? "";

  if (!fullName) {
    errors.fullName = "Informe seu nome para continuar.";
  }

  if (!email) {
    errors.email = "Informe um email para contato.";
  } else if (!isValidEnrollmentEmail(email)) {
    errors.email = "Informe um email valido.";
  }

  if (!whatsapp) {
    errors.whatsapp = "Informe um WhatsApp para contato.";
  }

  if (!input.groupInterest) {
    errors.groupInterest = "Escolha o grupo de interesse.";
  } else if (!ENROLLMENT_GROUP_INTERESTS.includes(input.groupInterest)) {
    errors.groupInterest = "Escolha um grupo de interesse valido.";
  }

  if (message.length > ENROLLMENT_MESSAGE_MAX_LENGTH) {
    errors.message = `A mensagem deve ter no maximo ${ENROLLMENT_MESSAGE_MAX_LENGTH} caracteres.`;
  }

  if (teacherNote.length > ENROLLMENT_TEACHER_NOTE_MAX_LENGTH) {
    errors.teacherNote =
      `A observacao deve ter no maximo ${ENROLLMENT_TEACHER_NOTE_MAX_LENGTH} caracteres.`;
  }

  return errors;
};
