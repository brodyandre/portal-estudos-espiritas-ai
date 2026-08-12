import nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatEmailExpiryLabel,
  NodemailerTransactionalEmailTransport,
  TRANSACTIONAL_EMAIL_BRAND_NAME,
  TRANSACTIONAL_EMAIL_TIME_ZONE,
  type TransactionalEmailLogEvent,
} from "../src/modules/auth/transactional-email";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

const SMTP_CONFIG = {
  smtpHost: "localhost",
  smtpPort: 1025,
  smtpSecure: false,
  smtpUser: "resend",
  smtpPassword: "smtp-password-nao-pode-vazar",
};

const createMessage = () => ({
  messageType: "password_recovery" as const,
  from: {
    name: "Portal de Educação Continuada",
    address: "no-reply@example.com",
  },
  to: "aluno.demo@example.com",
  subject: "Recuperação de acesso",
  text: "Use https://portal.example/redefinir-senha?token=token-nao-pode-vazar",
  html: '<a href="https://portal.example/redefinir-senha?token=token-nao-pode-vazar">Redefinir</a>',
});

describe("transactional email helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formata expiracao com timezone institucional deterministico", () => {
    expect(TRANSACTIONAL_EMAIL_BRAND_NAME).toBe("Portal de Educação Continuada");
    expect(TRANSACTIONAL_EMAIL_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(formatEmailExpiryLabel("2026-08-11T18:30:00.000Z")).toBe(
      "11/08/2026, 15:30 (horário de Brasília)",
    );
  });

  it("registra sucesso SMTP transacional com payload seguro somente apos sendMail resolver", async () => {
    let resolveSendMail: () => void = () => undefined;
    const sendMailPromise = new Promise((resolve) => {
      resolveSendMail = () =>
        resolve({
          accepted: ["aluno.demo@example.com"],
          rejected: [],
          response: "250 token-nao-pode-vazar smtp-password-nao-pode-vazar",
        });
    });
    const sendMail = vi.fn(() => sendMailPromise);
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    const logs: TransactionalEmailLogEvent[] = [];
    const transport = new NodemailerTransactionalEmailTransport(SMTP_CONFIG, {
      logSink: (event) => logs.push(event),
    });

    const operation = transport.sendMail(createMessage());

    expect(logs).toHaveLength(0);
    resolveSendMail();
    await operation;

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        level: "info",
        event: "transactional_email_send_succeeded",
        messageType: "password_recovery",
        result: "succeeded",
      }),
    );
    expect(logs[0].durationMs).toEqual(expect.any(Number));
    expect(logs[0].errorCategory).toBeUndefined();

    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("aluno.demo@example.com");
    expect(serialized).not.toContain("token-nao-pode-vazar");
    expect(serialized).not.toContain("https://portal.example/redefinir-senha");
    expect(serialized).not.toContain("smtp-password-nao-pode-vazar");
    expect(serialized).not.toContain("SMTP_PASSWORD");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("JWT_SECRET");
    expect(serialized).not.toContain("accepted");
    expect(serialized).not.toContain("rejected");
    expect(serialized).not.toContain("response");
  });

  it("registra falha SMTP transacional sanitizada e preserva o erro funcional", async () => {
    const error = Object.assign(
      new Error("Falha SMTP com token-nao-pode-vazar e https://portal.example/redefinir-senha?token=token"),
      {
        code: "EAUTH",
        response: "535 smtp-password-nao-pode-vazar",
        responseCode: 535,
      },
    );
    const sendMail = vi.fn(async () => {
      throw error;
    });
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    const logs: TransactionalEmailLogEvent[] = [];
    const transport = new NodemailerTransactionalEmailTransport(SMTP_CONFIG, {
      logSink: (event) => logs.push(event),
    });

    await expect(transport.sendMail(createMessage())).rejects.toBe(error);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        level: "warn",
        event: "transactional_email_send_failed",
        messageType: "password_recovery",
        result: "failed",
        errorCategory: "authentication",
      }),
    );

    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("aluno.demo@example.com");
    expect(serialized).not.toContain("token-nao-pode-vazar");
    expect(serialized).not.toContain("https://portal.example/redefinir-senha");
    expect(serialized).not.toContain("smtp-password-nao-pode-vazar");
    expect(serialized).not.toContain("SMTP_PASSWORD");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("JWT_SECRET");
    expect(serialized).not.toContain("response");
  });
});
