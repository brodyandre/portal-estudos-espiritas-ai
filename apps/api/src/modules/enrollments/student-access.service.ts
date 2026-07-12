import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

import type { Enrollment } from "../../types/enrollment";

export interface StudentAccessPayload {
  email: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}

export interface PreparedStudentAccessProvision {
  email: string;
  fullName: string;
  whatsapp: string;
  groupName: string | null;
  groupSlug: string | null;
  passwordHash: string;
  temporaryPasswordGeneratedAt: string;
  mustChangePassword: true;
  temporaryPassword: string;
}

export interface PreparedEnrollmentInvitationProvision {
  email: string;
  fullName: string;
  whatsapp: string;
  groupName: string | null;
  groupSlug: string | null;
  actorName: string;
  actorRole: "teacher" | "admin";
}

const groupSlugByName: Record<Enrollment["groupInterest"], string | null> = {
  Emmanuel: "emmanuel",
  "A Caminho da Luz": "a-caminho-da-luz",
  "Ainda não sei": null,
};

const pickSecureChar = (charset: string) => {
  return charset[randomInt(0, charset.length)];
};

const buildSecureSuffix = () => {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const mixed = `${uppercase}${lowercase}${digits}`;

  return [
    pickSecureChar(uppercase),
    pickSecureChar(lowercase),
    pickSecureChar(digits),
    pickSecureChar(mixed),
    pickSecureChar(mixed),
    pickSecureChar(mixed),
  ].join("");
};

export const buildTemporaryPassword = (fullName: string) => {
  const initials = fullName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AL";

  const suffix = buildSecureSuffix();

  return `${initials}@Portal${suffix}`;
};

export const prepareStudentAccessForEnrollment = async (
  enrollment: Enrollment,
): Promise<PreparedStudentAccessProvision> => {
  const temporaryPassword = buildTemporaryPassword(enrollment.fullName);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  return {
    fullName: enrollment.fullName,
    email: enrollment.email,
    whatsapp: enrollment.whatsapp,
    groupName:
      enrollment.groupInterest === "Ainda não sei" ? null : enrollment.groupInterest,
    groupSlug: groupSlugByName[enrollment.groupInterest],
    passwordHash,
    temporaryPasswordGeneratedAt: new Date().toISOString(),
    mustChangePassword: true,
    temporaryPassword,
  };
};

export const prepareEnrollmentInvitationForEnrollment = (
  enrollment: Enrollment,
  actor: {
    actorName: string;
    actorRole: "teacher" | "admin";
  },
): PreparedEnrollmentInvitationProvision => {
  return {
    fullName: enrollment.fullName,
    email: enrollment.email,
    whatsapp: enrollment.whatsapp,
    groupName:
      enrollment.groupInterest === "Ainda não sei" ? null : enrollment.groupInterest,
    groupSlug: groupSlugByName[enrollment.groupInterest],
    actorName: actor.actorName,
    actorRole: actor.actorRole,
  };
};
