import bcrypt from "bcryptjs";

import type { UserRole } from "../../auth/types";
import type { Enrollment } from "../../types/enrollment";
import { provisionStudentAccess } from "../auth/auth.service";

export interface StudentAccessPayload {
  email: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}

const groupSlugByName: Record<Enrollment["groupInterest"], string | null> = {
  Emmanuel: "emmanuel",
  "A Caminho da Luz": "a-caminho-da-luz",
  "Ainda não sei": null,
};

const buildTemporaryPassword = (fullName: string) => {
  const initials = fullName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AL";

  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${initials}@Portal${suffix}`;
};

export const ensureStudentAccessForEnrollment = async (input: {
  enrollment: Enrollment;
  actorName: string;
  actorRole: UserRole;
}): Promise<StudentAccessPayload> => {
  const { enrollment, actorName, actorRole } = input;
  const temporaryPassword = buildTemporaryPassword(enrollment.fullName);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  await provisionStudentAccess({
    enrollmentId: enrollment.id,
    fullName: enrollment.fullName,
    email: enrollment.email,
    whatsapp: enrollment.whatsapp,
    groupName:
      enrollment.groupInterest === "Ainda não sei" ? null : enrollment.groupInterest,
    groupSlug: groupSlugByName[enrollment.groupInterest],
    passwordHash,
    temporaryPasswordGeneratedAt: new Date().toISOString(),
    mustChangePassword: true,
    actorName,
    actorRole,
  });

  return {
    email: enrollment.email,
    temporaryPassword,
    mustChangePassword: true,
  };
};
