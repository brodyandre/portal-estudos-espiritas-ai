export type StudentAccessStatus = "visitor" | "pending" | "approved";

const STUDENT_ACCESS_STORAGE_KEY = "portal-estudos-espiritas-ai:student-access";

const allowedStatuses: StudentAccessStatus[] = ["visitor", "pending", "approved"];

const isStudentAccessStatus = (value: string | null | undefined): value is StudentAccessStatus => {
  return Boolean(value) && allowedStatuses.includes(value as StudentAccessStatus);
};

export const getStudentAccessStatusFromSearch = (
  searchParams: URLSearchParams,
): StudentAccessStatus | null => {
  const rawValue = searchParams.get("access")?.trim().toLowerCase();

  return isStudentAccessStatus(rawValue) ? rawValue : null;
};

export const readStudentAccessStatus = (): StudentAccessStatus => {
  if (typeof window === "undefined") {
    return "visitor";
  }

  try {
    const raw = window.localStorage.getItem(STUDENT_ACCESS_STORAGE_KEY);

    return isStudentAccessStatus(raw) ? raw : "visitor";
  } catch (_error) {
    return "visitor";
  }
};

export const writeStudentAccessStatus = (status: StudentAccessStatus) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STUDENT_ACCESS_STORAGE_KEY, status);
};

export const syncStudentAccessFromEnrollmentStatus = (
  status: "pending" | "approved" | "rejected" | "needs_contact",
) => {
  const nextStatus: StudentAccessStatus =
    status === "approved" ? "approved" : status === "rejected" ? "visitor" : "pending";

  writeStudentAccessStatus(nextStatus);

  return nextStatus;
};
