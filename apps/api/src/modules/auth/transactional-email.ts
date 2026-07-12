import nodemailer from "nodemailer";

import type { ApiEnv } from "../../config/env";

export interface TransactionalEmailMessage {
  from: {
    name: string;
    address: string;
  };
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface TransactionalEmailTransport {
  sendMail(message: TransactionalEmailMessage): Promise<void>;
}

export class NodemailerTransactionalEmailTransport implements TransactionalEmailTransport {
  private readonly transporter;

  constructor(config: Pick<ApiEnv, "smtpHost" | "smtpPort" | "smtpSecure" | "smtpUser" | "smtpPassword">) {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth:
        config.smtpUser && config.smtpPassword
          ? {
              user: config.smtpUser,
              pass: config.smtpPassword,
            }
          : undefined,
    });
  }

  async sendMail(message: TransactionalEmailMessage) {
    await this.transporter.sendMail({
      from: `"${message.from.name}" <${message.from.address}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

export const escapeHtml = (value: string) => {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
};

export const formatEmailExpiryLabel = (expiresAt: string) => {
  const expiresDate = new Date(expiresAt);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(expiresDate);
};
