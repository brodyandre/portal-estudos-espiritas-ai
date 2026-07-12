import type {
  Enrollment,
  EnrollmentInput,
  EnrollmentStatus,
  EnrollmentStatusUpdateResult,
  StudentAccessInfo,
} from "../types/enrollment";

const ENROLLMENTS_SESSION_STORAGE_KEY = "portal-estudos-espiritas-ai:demo-enrollments";

const cloneEnrollment = (enrollment: Enrollment): Enrollment => ({
  ...enrollment,
});

const seededEnrollments: Enrollment[] = [
  {
    id: "enrollment-001",
    fullName: "Mariana Souza",
    email: "mariana.souza.demo@example.com",
    whatsapp: "+55 00 90000-0001",
    groupInterest: "Emmanuel",
    alreadyParticipates: "Não",
    message:
      "Conheci o grupo pelo cartaz e gostaria de participar para entender melhor a proposta dos encontros.",
    status: "pending",
    createdAt: "2026-07-09T10:12:00-03:00",
    reviewedAt: null,
    reviewedBy: null,
    teacherNote: "",
  },
  {
    id: "enrollment-002",
    fullName: "Carlos Eduardo Lima",
    email: "carlos.lima.demo@example.com",
    whatsapp: "+55 00 90000-0002",
    groupInterest: "A Caminho da Luz",
    alreadyParticipates: "Já participei antes",
    message:
      "Participei de alguns encontros no ano passado e gostaria de retomar com mais constancia.",
    status: "approved",
    createdAt: "2026-07-08T18:40:00-03:00",
    reviewedAt: "2026-07-09T08:20:00-03:00",
    reviewedBy: "Professor Daniel",
    teacherNote: "Aprovado para retornar ao grupo desta semana.",
  },
  {
    id: "enrollment-003",
    fullName: "Fernanda Rocha",
    email: "fernanda.rocha.demo@example.com",
    whatsapp: "+55 00 90000-0003",
    groupInterest: "Ainda não sei",
    alreadyParticipates: "Não",
    message:
      "Gostaria de conhecer melhor os dois grupos antes de decidir qual combina mais comigo.",
    status: "needs_contact",
    createdAt: "2026-07-09T07:55:00-03:00",
    reviewedAt: "2026-07-09T12:05:00-03:00",
    reviewedBy: "Professora Helena",
    teacherNote: "Conversar antes para orientar melhor sobre o perfil de cada grupo.",
  },
  {
    id: "enrollment-004",
    fullName: "Joao Victor Mendes",
    email: "joaovictor.mendes.demo@example.com",
    whatsapp: "+55 00 90000-0004",
    groupInterest: "Emmanuel",
    alreadyParticipates: "Sim",
    message:
      "Ja acompanho encontros esporadicos e queria saber como ficar mais presente nas aulas.",
    status: "approved",
    createdAt: "2026-07-07T21:18:00-03:00",
    reviewedAt: "2026-07-08T09:14:00-03:00",
    reviewedBy: "Professor Daniel",
    teacherNote: "Aprovado. Ja conhece a rotina do grupo.",
  },
  {
    id: "enrollment-005",
    fullName: "Patricia Almeida",
    email: "patricia.almeida.demo@example.com",
    whatsapp: "+55 00 90000-0005",
    groupInterest: "A Caminho da Luz",
    alreadyParticipates: "Não",
    message:
      "Tenho interesse, mas no momento nao consigo participar no horario semanal com regularidade.",
    status: "rejected",
    createdAt: "2026-07-06T16:30:00-03:00",
    reviewedAt: "2026-07-07T11:00:00-03:00",
    reviewedBy: "Professora Helena",
    teacherNote: "Orientada a procurar um horario mais adequado antes de entrar no grupo.",
  },
];

const isBrowser = () => {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
};

const readStoredEnrollments = (): Enrollment[] | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ENROLLMENTS_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Enrollment[]) : null;
  } catch (_error) {
    return null;
  }
};

const writeStoredEnrollments = (items: Enrollment[]) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(ENROLLMENTS_SESSION_STORAGE_KEY, JSON.stringify(items));
};

const getCurrentEnrollments = () => {
  const storedItems = readStoredEnrollments();
  return (storedItems ?? seededEnrollments).map(cloneEnrollment);
};

export const listMockEnrollments = (filters?: {
  status?: EnrollmentStatus;
  groupInterest?: Enrollment["groupInterest"];
}) => {
  return getCurrentEnrollments().filter((enrollment) => {
    if (filters?.status && enrollment.status !== filters.status) {
      return false;
    }

    if (filters?.groupInterest && enrollment.groupInterest !== filters.groupInterest) {
      return false;
    }

    return true;
  });
};

export const createMockEnrollment = (input: EnrollmentInput): Enrollment => {
  const currentItems = getCurrentEnrollments();
  const createdEnrollment: Enrollment = {
    id: `enrollment-demo-${Date.now()}`,
    fullName: input.fullName.trim(),
    email: input.email.trim(),
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

  writeStoredEnrollments([createdEnrollment, ...currentItems]);

  return cloneEnrollment(createdEnrollment);
};

export const updateMockEnrollmentStatus = (
  id: string,
  input: {
    status: Extract<EnrollmentStatus, "approved" | "rejected" | "needs_contact">;
    teacherNote?: string;
  },
): EnrollmentStatusUpdateResult | null => {
  const currentItems = getCurrentEnrollments();
  const targetIndex = currentItems.findIndex((item) => item.id === id);

  if (targetIndex === -1) {
    return null;
  }

  const updatedEnrollment: Enrollment = {
    ...currentItems[targetIndex],
    status: input.status,
    teacherNote: input.teacherNote?.trim() ?? "",
    reviewedAt: new Date().toISOString(),
    reviewedBy: "Professor",
  };

  currentItems.splice(targetIndex, 1, updatedEnrollment);
  writeStoredEnrollments(currentItems);

  const studentAccess: StudentAccessInfo | null =
    input.status === "approved"
      ? {
          email: updatedEnrollment.email,
          invitationType: "enrollment_approval",
          deliveryStatus: "not_configured",
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          mustCreatePassword: true,
        }
      : null;

  return {
    enrollment: cloneEnrollment(updatedEnrollment),
    studentAccess,
  };
};

export const resetMockEnrollments = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(ENROLLMENTS_SESSION_STORAGE_KEY);
};

export const enrollments = seededEnrollments.map(cloneEnrollment);
