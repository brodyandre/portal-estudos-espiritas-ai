import { randomUUID } from "node:crypto";

import nodemailer from "nodemailer";

import type { ApiEnv } from "../../config/env";
import { env } from "../../config/env";
import type { PasswordRecoveryPreview } from "./auth.types";

export interface PasswordRecoveryNotifierInput {
  recipientEmail: string;
  recipientName: string;
  recoveryUrl: string;
  expiresAt: string;
}

export interface PasswordRecoveryMemoryMessage extends PasswordRecoveryNotifierInput {
  id: string;
  subject: string;
  html: string;
  text: string;
}

export interface PasswordRecoveryNotifier {
  readonly kind: "memory" | "smtp" | "null";
  sendPasswordRecovery(input: PasswordRecoveryNotifierInput): Promise<void>;
}

export interface PasswordRecoveryTransportMessage {
  from: {
    name: string;
    address: string;
  };
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface PasswordRecoveryMailTransport {
  sendMail(message: PasswordRecoveryTransportMessage): Promise<void>;
}

const PASSWORD_RECOVERY_SUBJECT = "Recuperação de acesso — Portal de Estudos Espíritas";
const memoryPreviews: PasswordRecoveryPreview[] = [];
const memoryMessages: PasswordRecoveryMemoryMessage[] = [];

const clonePreview = (preview: PasswordRecoveryPreview): PasswordRecoveryPreview => ({
  ...preview,
});

const cloneMessage = (message: PasswordRecoveryMemoryMessage): PasswordRecoveryMemoryMessage => ({
  ...message,
});

const escapeHtml = (value: string) => {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
};

const formatExpiryLabel = (expiresAt: string) => {
  const expiresDate = new Date(expiresAt);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(expiresDate);
};

export const buildPasswordRecoveryEmail = (input: PasswordRecoveryNotifierInput) => {
  const safeRecipientName = escapeHtml(input.recipientName.trim() || "participante");
  const safeRecoveryUrl = escapeHtml(input.recoveryUrl);
  const safeExpiryLabel = escapeHtml(formatExpiryLabel(input.expiresAt));

  const text = [
    `Olá, ${input.recipientName.trim() || "participante"}.`,
    "",
    "Recebemos uma solicitação para recuperar o acesso ao Portal de Estudos Espíritas.",
    `Use este link para redefinir sua senha: ${input.recoveryUrl}`,
    `Este link é válido até ${formatExpiryLabel(input.expiresAt)}.`,
    "Se você não fez esta solicitação, ignore este e-mail.",
    "Por segurança, não compartilhe este link com outras pessoas.",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, serif; line-height: 1.6; color: #173229; background: #f7f3e8; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #d8c9a5;">
        <p style="margin: 0 0 16px;">Olá, ${safeRecipientName}.</p>
        <p style="margin: 0 0 16px;">
          Recebemos uma solicitação para recuperar o acesso ao Portal de Estudos Espíritas.
        </p>
        <p style="margin: 0 0 24px;">
          Use o botão abaixo para criar uma nova senha com segurança.
        </p>
        <p style="margin: 0 0 24px;">
          <a
            href="${safeRecoveryUrl}"
            style="display: inline-block; background: #1f5c4a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 700;"
          >
            Redefinir minha senha
          </a>
        </p>
        <p style="margin: 0 0 16px;">
          Este link é válido até <strong>${safeExpiryLabel}</strong>.
        </p>
        <p style="margin: 0 0 12px;">
          Se você não fez esta solicitação, ignore este e-mail.
        </p>
        <p style="margin: 0;">
          Por segurança, não compartilhe este link com outras pessoas.
        </p>
      </div>
    </div>
  `.trim();

  return {
    subject: PASSWORD_RECOVERY_SUBJECT,
    text,
    html,
  };
};

export class MemoryPasswordRecoveryNotifier implements PasswordRecoveryNotifier {
  readonly kind = "memory" as const;

  async sendPasswordRecovery(input: PasswordRecoveryNotifierInput) {
    const template = buildPasswordRecoveryEmail(input);

    memoryMessages.unshift({
      id: randomUUID(),
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      recoveryUrl: input.recoveryUrl,
      expiresAt: input.expiresAt,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}

export class NullPasswordRecoveryNotifier implements PasswordRecoveryNotifier {
  readonly kind = "null" as const;

  async sendPasswordRecovery(_input: PasswordRecoveryNotifierInput) {
    return;
  }
}

export class SmtpPasswordRecoveryNotifier implements PasswordRecoveryNotifier {
  readonly kind = "smtp" as const;

  constructor(
    private readonly transport: PasswordRecoveryMailTransport,
    private readonly smtpConfig: Pick<ApiEnv, "smtpFromEmail" | "smtpFromName">,
  ) {}

  async sendPasswordRecovery(input: PasswordRecoveryNotifierInput) {
    const template = buildPasswordRecoveryEmail(input);

    await this.transport.sendMail({
      from: {
        name: this.smtpConfig.smtpFromName,
        address: this.smtpConfig.smtpFromEmail,
      },
      to: input.recipientEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }
}

export class NodemailerPasswordRecoveryTransport implements PasswordRecoveryMailTransport {
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

  async sendMail(message: PasswordRecoveryTransportMessage) {
    await this.transporter.sendMail({
      from: `"${message.from.name}" <${message.from.address}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

const shouldStorePreview = (config: ApiEnv) => {
  return config.nodeEnv === "test" || (config.nodeEnv !== "production" && config.passwordRecoveryPreviewEnabled);
};

export const registerPasswordRecoveryPreview = (
  input: {
    email: string;
    fullName: string;
    token: string;
    resetUrl: string;
    createdAt: string;
    expiresAt: string;
  },
  config: ApiEnv = env,
) => {
  if (!shouldStorePreview(config)) {
    return false;
  }

  memoryPreviews.unshift({
    id: randomUUID(),
    email: input.email,
    fullName: input.fullName,
    token: input.token,
    resetUrl: input.resetUrl,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  });

  return true;
};

export const listPasswordRecoveryPreviews = () => {
  return memoryPreviews.map(clonePreview);
};

export const listMemoryPasswordRecoveryMessages = () => {
  return memoryMessages.map(cloneMessage);
};

export const resetPasswordRecoveryStores = () => {
  memoryPreviews.length = 0;
  memoryMessages.length = 0;
};

export const createPasswordRecoveryNotifier = (
  config: ApiEnv = env,
  options?: {
    transport?: PasswordRecoveryMailTransport;
  },
): PasswordRecoveryNotifier => {
  if (config.nodeEnv === "test") {
    return new MemoryPasswordRecoveryNotifier();
  }

  if (config.smtpEnabled) {
    return new SmtpPasswordRecoveryNotifier(
      options?.transport ??
        new NodemailerPasswordRecoveryTransport({
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort,
          smtpSecure: config.smtpSecure,
          smtpUser: config.smtpUser,
          smtpPassword: config.smtpPassword,
        }),
      {
        smtpFromEmail: config.smtpFromEmail,
        smtpFromName: config.smtpFromName,
      },
    );
  }

  return new NullPasswordRecoveryNotifier();
};

let passwordRecoveryNotifier: PasswordRecoveryNotifier = createPasswordRecoveryNotifier(env);

export const getPasswordRecoveryNotifier = () => passwordRecoveryNotifier;

export const setPasswordRecoveryNotifierForTesting = (notifier: PasswordRecoveryNotifier) => {
  passwordRecoveryNotifier = notifier;
};

export const resetPasswordRecoveryNotifier = () => {
  resetPasswordRecoveryStores();
  passwordRecoveryNotifier = createPasswordRecoveryNotifier(env);
};
