import type { Enrollment, EnrollmentStatus } from "../types/enrollment";

export type EnrollmentMessageStatus = Extract<
  EnrollmentStatus,
  "approved" | "needs_contact" | "rejected"
>;

interface EnrollmentMessageInput {
  enrollment: Pick<Enrollment, "fullName" | "groupInterest">;
  portalUrl: string;
  status: EnrollmentMessageStatus;
}

export const buildPortalUrl = (
  locationLike?: Pick<Location, "origin" | "pathname">,
) => {
  const origin = locationLike?.origin ?? "http://localhost:3000";
  const pathname = locationLike?.pathname ?? "/";
  const basePath = pathname === "/" ? "" : pathname.replace(/\/$/, "");

  return `${origin}${basePath}/#/portal`;
};

export const getEnrollmentMessageStatus = (status: EnrollmentStatus): EnrollmentMessageStatus => {
  if (status === "approved" || status === "rejected") {
    return status;
  }

  return "needs_contact";
};

export const buildEnrollmentMessage = ({
  enrollment,
  portalUrl,
  status,
}: EnrollmentMessageInput) => {
  const name = enrollment.fullName.trim();
  const group = enrollment.groupInterest;

  if (status === "approved") {
    return `Olá, ${name}! Tudo bem? Recebemos sua inscrição para a Educação Continuada Online do Centro Espírita Ana Vieira. Sua participação foi aprovada para o grupo ${group}. Acesse sua área do aluno pelo portal: ${portalUrl}. Seja muito bem-vindo(a).`;
  }

  if (status === "rejected") {
    return "Olá, "
      + `${name}! Tudo bem? Agradecemos seu interesse na Educação Continuada Online. `
      + "No momento, sua solicitação não foi liberada automaticamente. "
      + "Caso deseje, você pode entrar em contato com os professores para mais orientações.";
  }

  return "Olá, "
    + `${name}! Tudo bem? Recebemos sua inscrição para a Educação Continuada Online. `
    + "Antes de liberar o acesso, gostaríamos de confirmar algumas informações "
    + `sobre seu interesse no grupo ${group}. Podemos conversar por aqui?`;
};
