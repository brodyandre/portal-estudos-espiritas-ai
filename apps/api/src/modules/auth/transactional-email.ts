import nodemailer from "nodemailer";

import type { ApiEnv } from "../../config/env";

export type TransactionalEmailMessageType = "password_recovery" | "account_invitation";
export type TransactionalEmailResult = "succeeded" | "failed";
export type TransactionalEmailErrorCategory =
  | "authentication"
  | "connection"
  | "provider_rejected"
  | "timeout"
  | "unknown";

export interface TransactionalEmailMessage {
  messageType: TransactionalEmailMessageType;
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

export interface TransactionalEmailLogEvent {
  timestamp: string;
  level: "info" | "warn";
  event: "transactional_email_send_succeeded" | "transactional_email_send_failed";
  messageType: TransactionalEmailMessageType;
  result: TransactionalEmailResult;
  durationMs: number;
  errorCategory?: TransactionalEmailErrorCategory;
}

export type TransactionalEmailLogSink = (event: TransactionalEmailLogEvent) => void;

export const TRANSACTIONAL_EMAIL_BRAND_NAME = "Portal de Educação Continuada";
export const TRANSACTIONAL_EMAIL_TIME_ZONE = "America/Sao_Paulo";

const defaultTransactionalEmailLogSink: TransactionalEmailLogSink = (event) => {
  console.info(JSON.stringify(event));
};

const getSafeErrorCategory = (error: unknown): TransactionalEmailErrorCategory => {
  const maybeError = error as { code?: unknown; command?: unknown; responseCode?: unknown; message?: unknown };
  const code = typeof maybeError?.code === "string" ? maybeError.code.toUpperCase() : "";
  const command = typeof maybeError?.command === "string" ? maybeError.command.toUpperCase() : "";
  const responseCode = typeof maybeError?.responseCode === "number" ? maybeError.responseCode : undefined;
  const message = typeof maybeError?.message === "string" ? maybeError.message.toLowerCase() : "";

  if (code.includes("ETIMEDOUT") || message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  if (
    ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ESOCKET"].some((connectionCode) =>
      code.includes(connectionCode),
    )
  ) {
    return "connection";
  }

  if (code.includes("EAUTH") || command === "AUTH" || responseCode === 535 || message.includes("auth")) {
    return "authentication";
  }

  if (responseCode === 550 || responseCode === 554 || message.includes("rejected")) {
    return "provider_rejected";
  }

  return "unknown";
};

export class NodemailerTransactionalEmailTransport implements TransactionalEmailTransport {
  private readonly transporter;
  private readonly logSink: TransactionalEmailLogSink;

  constructor(
    config: Pick<ApiEnv, "smtpHost" | "smtpPort" | "smtpSecure" | "smtpUser" | "smtpPassword">,
    options: {
      logSink?: TransactionalEmailLogSink;
    } = {},
  ) {
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
    this.logSink = options.logSink ?? defaultTransactionalEmailLogSink;
  }

  async sendMail(message: TransactionalEmailMessage) {
    const startedAt = Date.now();

    try {
      await this.transporter.sendMail({
        from: `"${message.from.name}" <${message.from.address}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      this.emitLog({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "transactional_email_send_succeeded",
        messageType: message.messageType,
        result: "succeeded",
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      this.emitLog({
        timestamp: new Date().toISOString(),
        level: "warn",
        event: "transactional_email_send_failed",
        messageType: message.messageType,
        result: "failed",
        durationMs: Date.now() - startedAt,
        errorCategory: getSafeErrorCategory(error),
      });
      throw error;
    }
  }

  private emitLog(event: TransactionalEmailLogEvent) {
    try {
      this.logSink(event);
    } catch {
      return;
    }
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
    timeZone: TRANSACTIONAL_EMAIL_TIME_ZONE,
  }).format(expiresDate) + " (horário de Brasília)";
};
