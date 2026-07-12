import { randomUUID } from "node:crypto";

import type { ApiEnv } from "../../config/env";
import { env } from "../../config/env";
import type { AccountInvitationPreview, AccountInvitationType } from "./auth.types";
import {
  escapeHtml,
  formatEmailExpiryLabel,
  NodemailerTransactionalEmailTransport,
  type TransactionalEmailMessage,
  type TransactionalEmailTransport,
} from "./transactional-email";

export interface AccountInvitationNotifierInput {
  recipientEmail: string;
  recipientName: string;
  invitationUrl: string;
  expiresAt: string;
  invitationType: AccountInvitationType;
}

export interface AccountInvitationMemoryMessage extends AccountInvitationNotifierInput {
  id: string;
  subject: string;
  html: string;
  text: string;
}

export interface AccountInvitationNotifier {
  readonly kind: "memory" | "smtp" | "null";
  sendAccountInvitation(input: AccountInvitationNotifierInput): Promise<void>;
}

export type AccountInvitationTransportMessage = TransactionalEmailMessage;
export type AccountInvitationMailTransport = TransactionalEmailTransport;

const ACCOUNT_INVITATION_SUBJECT = "Seu acesso ao Portal de Estudos Espíritas";
const memoryPreviews: AccountInvitationPreview[] = [];
const memoryMessages: AccountInvitationMemoryMessage[] = [];

const clonePreview = (preview: AccountInvitationPreview): AccountInvitationPreview => ({
  ...preview,
});

const cloneMessage = (message: AccountInvitationMemoryMessage): AccountInvitationMemoryMessage => ({
  ...message,
});

export const buildAccountInvitationEmail = (input: AccountInvitationNotifierInput) => {
  const safeRecipientName = escapeHtml(input.recipientName.trim() || "participante");
  const safeInvitationUrl = escapeHtml(input.invitationUrl);
  const safeExpiryLabel = escapeHtml(formatEmailExpiryLabel(input.expiresAt));
  const contextLine =
    input.invitationType === "admin_reinvite"
      ? "Um novo convite de acesso foi preparado para que você escolha sua senha com segurança."
      : "Sua inscrição foi aprovada e seu acesso pode ser ativado com segurança.";

  const text = [
    `Olá, ${input.recipientName.trim() || "participante"}.`,
    "",
    contextLine,
    `Use este link para criar sua senha: ${input.invitationUrl}`,
    `Este link é válido até ${formatEmailExpiryLabel(input.expiresAt)}.`,
    "Se você não reconhece este convite, ignore este e-mail.",
    "Por segurança, não compartilhe este link com outras pessoas.",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, serif; line-height: 1.6; color: #173229; background: #f7f3e8; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #d8c9a5;">
        <p style="margin: 0 0 16px;">Olá, ${safeRecipientName}.</p>
        <p style="margin: 0 0 16px;">${escapeHtml(contextLine)}</p>
        <p style="margin: 0 0 24px;">Use o botão abaixo para criar sua senha e concluir o primeiro acesso.</p>
        <p style="margin: 0 0 24px;">
          <a
            href="${safeInvitationUrl}"
            style="display: inline-block; background: #1f5c4a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 700;"
          >
            Criar minha senha
          </a>
        </p>
        <p style="margin: 0 0 16px;">Este link é válido até <strong>${safeExpiryLabel}</strong>.</p>
        <p style="margin: 0 0 12px;">Se você não reconhece este convite, ignore este e-mail.</p>
        <p style="margin: 0;">Por segurança, não compartilhe este link com outras pessoas.</p>
      </div>
    </div>
  `.trim();

  return {
    subject: ACCOUNT_INVITATION_SUBJECT,
    text,
    html,
  };
};

export class MemoryAccountInvitationNotifier implements AccountInvitationNotifier {
  readonly kind = "memory" as const;

  async sendAccountInvitation(input: AccountInvitationNotifierInput) {
    const template = buildAccountInvitationEmail(input);

    memoryMessages.unshift({
      id: randomUUID(),
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      invitationUrl: input.invitationUrl,
      expiresAt: input.expiresAt,
      invitationType: input.invitationType,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}

export class NullAccountInvitationNotifier implements AccountInvitationNotifier {
  readonly kind = "null" as const;

  async sendAccountInvitation(_input: AccountInvitationNotifierInput) {
    return;
  }
}

export class SmtpAccountInvitationNotifier implements AccountInvitationNotifier {
  readonly kind = "smtp" as const;

  constructor(
    private readonly transport: AccountInvitationMailTransport,
    private readonly smtpConfig: Pick<ApiEnv, "smtpFromEmail" | "smtpFromName">,
  ) {}

  async sendAccountInvitation(input: AccountInvitationNotifierInput) {
    const template = buildAccountInvitationEmail(input);

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

const shouldStorePreview = (config: ApiEnv) => {
  return config.nodeEnv === "test" || (config.nodeEnv !== "production" && config.passwordRecoveryPreviewEnabled);
};

export const registerAccountInvitationPreview = (
  input: {
    email: string;
    fullName: string;
    token: string;
    invitationUrl: string;
    createdAt: string;
    expiresAt: string;
    invitationType: AccountInvitationType;
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
    invitationUrl: input.invitationUrl,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    invitationType: input.invitationType,
  });

  return true;
};

export const listAccountInvitationPreviews = () => {
  return memoryPreviews.map(clonePreview);
};

export const listMemoryAccountInvitationMessages = () => {
  return memoryMessages.map(cloneMessage);
};

export const resetAccountInvitationStores = () => {
  memoryPreviews.length = 0;
  memoryMessages.length = 0;
};

export const createAccountInvitationNotifier = (
  config: ApiEnv = env,
  options?: {
    transport?: AccountInvitationMailTransport;
  },
): AccountInvitationNotifier => {
  if (config.nodeEnv === "test") {
    return new MemoryAccountInvitationNotifier();
  }

  if (config.smtpEnabled) {
    return new SmtpAccountInvitationNotifier(
      options?.transport ??
        new NodemailerTransactionalEmailTransport({
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

  return new NullAccountInvitationNotifier();
};

let accountInvitationNotifier: AccountInvitationNotifier = createAccountInvitationNotifier(env);

export const getAccountInvitationNotifier = () => accountInvitationNotifier;

export const setAccountInvitationNotifierForTesting = (notifier: AccountInvitationNotifier) => {
  accountInvitationNotifier = notifier;
};

export const resetAccountInvitationNotifier = () => {
  resetAccountInvitationStores();
  accountInvitationNotifier = createAccountInvitationNotifier(env);
};
