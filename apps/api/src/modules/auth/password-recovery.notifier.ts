import { randomUUID } from "node:crypto";

import { env } from "../../config/env";
import type { PasswordRecoveryPreview } from "./auth.types";

export interface PasswordRecoveryNotification {
  email: string;
  fullName: string;
  token: string;
  resetUrl: string;
  createdAt: string;
  expiresAt: string;
}

export interface PasswordRecoveryNotifier {
  notify(input: PasswordRecoveryNotification): Promise<void>;
}

const memoryPreviews: PasswordRecoveryPreview[] = [];

const clonePreview = (preview: PasswordRecoveryPreview): PasswordRecoveryPreview => ({
  ...preview,
});

class MemoryPasswordRecoveryNotifier implements PasswordRecoveryNotifier {
  async notify(input: PasswordRecoveryNotification) {
    memoryPreviews.unshift({
      id: randomUUID(),
      email: input.email,
      fullName: input.fullName,
      token: input.token,
      resetUrl: input.resetUrl,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
    });
  }
}

class NullPasswordRecoveryNotifier implements PasswordRecoveryNotifier {
  async notify(_input: PasswordRecoveryNotification) {
    return;
  }
}

let passwordRecoveryNotifier: PasswordRecoveryNotifier =
  env.nodeEnv === "production" ? new NullPasswordRecoveryNotifier() : new MemoryPasswordRecoveryNotifier();

export const getPasswordRecoveryNotifier = () => passwordRecoveryNotifier;

export const setPasswordRecoveryNotifierForTesting = (notifier: PasswordRecoveryNotifier) => {
  passwordRecoveryNotifier = notifier;
};

export const resetPasswordRecoveryNotifier = () => {
  memoryPreviews.length = 0;
  passwordRecoveryNotifier =
    env.nodeEnv === "production" ? new NullPasswordRecoveryNotifier() : new MemoryPasswordRecoveryNotifier();
};

export const listPasswordRecoveryPreviews = () => {
  return memoryPreviews.map(clonePreview);
};
