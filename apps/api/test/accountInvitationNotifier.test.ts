import { describe, expect, it, vi } from "vitest";

import {
  buildAccountInvitationEmail,
  SmtpAccountInvitationNotifier,
  type AccountInvitationMailTransport,
} from "../src/modules/auth/account-invitation.notifier";

const OLD_BRAND_NAME = "Portal de Estudos Espíritas";
const TRANSACTIONAL_BRAND_NAME = "Portal de Educação Continuada";
const EXPECTED_EXPIRY_LABEL = "11/08/2026, 15:30 (horário de Brasília)";

describe("account invitation notifier", () => {
  it("gera convite de aprovacao com identidade e timezone institucionais", () => {
    const template = buildAccountInvitationEmail({
      recipientEmail: "aluno.demo@example.com",
      recipientName: "<Aluno & Turma>",
      invitationUrl: "http://localhost:5173/ativar-conta?token=token-demo%2Bseguro",
      expiresAt: "2026-08-11T18:30:00.000Z",
      invitationType: "enrollment_approval",
    });

    expect(template.subject).toBe(`Seu acesso ao ${TRANSACTIONAL_BRAND_NAME}`);
    expect(template.subject).not.toContain(OLD_BRAND_NAME);
    expect(template.text).toContain("Sua inscrição foi aprovada");
    expect(template.text).toContain("http://localhost:5173/ativar-conta?token=token-demo%2Bseguro");
    expect(template.text).toContain(EXPECTED_EXPIRY_LABEL);
    expect(template.html).toContain("&lt;Aluno &amp; Turma&gt;");
    expect(template.html).not.toContain("<Aluno & Turma>");
    expect(template.html).toContain("Criar minha senha");
    expect(template.html).toContain(EXPECTED_EXPIRY_LABEL);
  });

  it("preserva o contexto de reenvio administrativo", () => {
    const template = buildAccountInvitationEmail({
      recipientEmail: "aluno.demo@example.com",
      recipientName: "Aluno Demo",
      invitationUrl: "http://localhost:5173/ativar-conta?token=token-demo",
      expiresAt: "2026-08-11T18:30:00.000Z",
      invitationType: "admin_reinvite",
    });

    expect(template.subject).toBe(`Seu acesso ao ${TRANSACTIONAL_BRAND_NAME}`);
    expect(template.text).toContain(
      "Um novo convite de acesso foi preparado para que você escolha sua senha com segurança.",
    );
    expect(template.html).toContain(
      "Um novo convite de acesso foi preparado para que você escolha sua senha com segurança.",
    );
  });

  it("envia convite por SMTP com tipo transacional explicito", async () => {
    const sendMail = vi.fn(async () => undefined);
    const transport: AccountInvitationMailTransport = {
      sendMail,
    };
    const notifier = new SmtpAccountInvitationNotifier(transport, {
      smtpFromEmail: "no-reply@example.com",
      smtpFromName: "Portal de Educação Continuada",
    });

    await notifier.sendAccountInvitation({
      recipientEmail: "aluno.demo@example.com",
      recipientName: "Aluno Demo",
      invitationUrl: "http://localhost:5173/ativar-conta?token=token-demo",
      expiresAt: "2026-08-11T18:30:00.000Z",
      invitationType: "enrollment_approval",
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "account_invitation",
        to: "aluno.demo@example.com",
        subject: `Seu acesso ao ${TRANSACTIONAL_BRAND_NAME}`,
      }),
    );
  });
});
