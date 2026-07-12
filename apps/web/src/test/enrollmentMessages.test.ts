import { describe, expect, it } from "vitest";

import type { Enrollment } from "../types/enrollment";
import {
  buildEnrollmentMessage,
  buildPortalUrl,
  getEnrollmentMessageStatus,
} from "../utils/enrollmentMessages";

const enrollmentBase: Enrollment = {
  id: "enrollment-001",
  fullName: "Mariana Souza",
  email: "mariana.souza.demo@example.com",
  whatsapp: "+55 00 90000-0001",
  groupInterest: "Emmanuel",
  alreadyParticipates: "Não",
  message: "Gostaria de conhecer melhor o grupo.",
  status: "pending",
  createdAt: "2026-07-09T10:12:00-03:00",
  reviewedAt: null,
  reviewedBy: null,
  teacherNote: "",
};

describe("enrollmentMessages", () => {
  it("gera mensagem de aprovacao com link do portal", () => {
    const message = buildEnrollmentMessage({
      enrollment: enrollmentBase,
      portalUrl: "https://portal-exemplo.com/#/portal",
      status: "approved",
    });

    expect(message).toContain("Mariana Souza");
    expect(message).toContain("grupo Emmanuel");
    expect(message).toContain("https://portal-exemplo.com/#/portal");
    expect(message).not.toContain("Google Meet");
  });

  it("gera mensagem de aprovacao com convite para criar a propria senha", () => {
    const message = buildEnrollmentMessage({
      enrollment: enrollmentBase,
      portalUrl: "https://portal-exemplo.com/#/portal",
      status: "approved",
      studentAccess: {
        email: "mariana.souza.demo@example.com",
        invitationType: "enrollment_approval",
        deliveryStatus: "sent",
        expiresAt: "2026-07-14T20:00:00.000Z",
        mustCreatePassword: true,
      },
    });

    expect(message).toContain("criará sua própria senha");
    expect(message).toContain("mariana.souza.demo@example.com");
    expect(message).toContain("convite");
    expect(message).not.toContain("troque a senha futuramente");
    expect(message).not.toContain("TempDemo@123");
  });

  it("usa mensagem de conversa para cadastro pendente", () => {
    expect(getEnrollmentMessageStatus("pending")).toBe("needs_contact");
  });

  it("monta a URL publica do portal com base do GitHub Pages", () => {
    const portalUrl = buildPortalUrl({
      origin: "https://luizandre.github.io",
      pathname: "/portal-estudos-espiritas-ai/",
    });

    expect(portalUrl).toBe("https://luizandre.github.io/portal-estudos-espiritas-ai/#/portal");
  });
});
