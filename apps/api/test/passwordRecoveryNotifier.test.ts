import { describe, expect, it, vi } from "vitest";

import { buildEnv } from "../src/config/env";
import {
  buildPasswordRecoveryEmail,
  createPasswordRecoveryNotifier,
  MemoryPasswordRecoveryNotifier,
  NullPasswordRecoveryNotifier,
  SmtpPasswordRecoveryNotifier,
  type PasswordRecoveryMailTransport,
} from "../src/modules/auth/password-recovery.notifier";

const OLD_BRAND_NAME = "Portal de Estudos Espíritas";
const TRANSACTIONAL_BRAND_NAME = "Portal de Educação Continuada";
const EXPECTED_EXPIRY_LABEL = "12/07/2026, 15:30 (horário de Brasília)";

describe("password recovery notifier", () => {
  it("gera versoes html e texto com escape seguro do nome", () => {
    const template = buildPasswordRecoveryEmail({
      recipientEmail: "aluno.demo@example.com",
      recipientName: "<Aluno & Turma>",
      recoveryUrl: "http://localhost:5173/redefinir-senha?token=token-demo%2Bseguro",
      expiresAt: "2026-07-12T18:30:00.000Z",
    });

    expect(template.subject).toBe(`Recuperação de acesso — ${TRANSACTIONAL_BRAND_NAME}`);
    expect(template.text).toContain(TRANSACTIONAL_BRAND_NAME);
    expect(template.html).toContain(TRANSACTIONAL_BRAND_NAME);
    expect(`${template.subject}\n${template.text}\n${template.html}`).not.toContain(OLD_BRAND_NAME);
    expect(template.text).toContain("Use este link para redefinir sua senha");
    expect(template.text).toContain("http://localhost:5173/redefinir-senha?token=token-demo%2Bseguro");
    expect(template.text).toContain(EXPECTED_EXPIRY_LABEL);
    expect(template.html).toContain(EXPECTED_EXPIRY_LABEL);
    expect(template.html).toContain("&lt;Aluno &amp; Turma&gt;");
    expect(template.html).not.toContain("<Aluno & Turma>");
    expect(template.html).toContain("Redefinir minha senha");
  });

  it("envia por SMTP usando apenas os campos necessários", async () => {
    const sendMail = vi.fn(async () => undefined);
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transport: PasswordRecoveryMailTransport = {
      sendMail,
    };

    const notifier = new SmtpPasswordRecoveryNotifier(transport, {
      smtpFromEmail: "no-reply@example.com",
      smtpFromName: "Portal de Estudos Espíritas",
    });

    await notifier.sendPasswordRecovery({
      recipientEmail: "aluno.demo@example.com",
      recipientName: "Aluno Demo",
      recoveryUrl: "http://localhost:5173/redefinir-senha?token=token-seguro",
      expiresAt: "2026-07-12T18:30:00.000Z",
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "aluno.demo@example.com",
        subject: `Recuperação de acesso — ${TRANSACTIONAL_BRAND_NAME}`,
      }),
    );
    expect(JSON.stringify(sendMail.mock.calls[0][0])).toContain("token-seguro");
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("usa notifier em memória nos testes", () => {
    const notifier = createPasswordRecoveryNotifier(
      buildEnv({
        NODE_ENV: "test",
      }),
    );

    expect(notifier).toBeInstanceOf(MemoryPasswordRecoveryNotifier);
  });

  it("usa notifier nulo quando SMTP estiver desabilitado fora dos testes", () => {
    const notifier = createPasswordRecoveryNotifier(
      buildEnv({
        NODE_ENV: "development",
        SMTP_ENABLED: "false",
      }),
    );

    expect(notifier).toBeInstanceOf(NullPasswordRecoveryNotifier);
  });

  it("usa notifier SMTP quando habilitado com transporte injetado", () => {
    const notifier = createPasswordRecoveryNotifier(
      buildEnv({
        NODE_ENV: "development",
        APP_PUBLIC_URL: "http://localhost:5173",
        SMTP_ENABLED: "true",
        SMTP_HOST: "localhost",
        SMTP_PORT: "1025",
        SMTP_SECURE: "false",
        SMTP_FROM_NAME: "Portal de Estudos Espíritas",
        SMTP_FROM_EMAIL: "no-reply@example.com",
      }),
      {
        transport: {
          sendMail: async () => undefined,
        },
      },
    );

    expect(notifier).toBeInstanceOf(SmtpPasswordRecoveryNotifier);
  });
});
