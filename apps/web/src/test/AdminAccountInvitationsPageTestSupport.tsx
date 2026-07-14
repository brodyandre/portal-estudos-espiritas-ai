import { fireEvent, render, screen } from "@testing-library/react";
import { expect } from "vitest";

import { App } from "../App";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { AdminAccountInvitationsPage } from "../pages/AdminAccountInvitationsPage";
import type {
  AccountInvitationListItem,
  AccountInvitationListResult,
} from "../types/adminAccountInvitations";

export const baseInvitation: AccountInvitationListItem = {
  id: "invitation-internal-id-001",
  recipientName: "Ana Beatriz",
  recipientEmailMasked: "a***z@example.com",
  invitationType: "enrollment_approval",
  deliveryStatus: "sent",
  lifecycleStatus: "pending",
  createdAt: "2026-07-12T10:30:00.000Z",
  expiresAt: "2026-07-19T10:30:00.000Z",
  deliveredAt: "2026-07-12T10:31:00.000Z",
  deliveryFailedAt: null,
  acceptedAt: null,
  invalidatedAt: null,
  invitedByName: "Coordenação",
};

export const baseResult: AccountInvitationListResult = {
  items: [baseInvitation],
  meta: {
    page: 1,
    pageSize: 10,
    total: 24,
    totalPages: 3,
  },
};

export const buildInvitation = (
  overrides: Partial<AccountInvitationListItem> = {},
): AccountInvitationListItem => ({
  ...baseInvitation,
  ...overrides,
});

export const buildBaseResult = (): AccountInvitationListResult => ({
  items: [buildInvitation()],
  meta: {
    ...baseResult.meta,
  },
});

export const buildResult = (
  overrides: Partial<AccountInvitationListResult["meta"]> = {},
  items: AccountInvitationListItem[] = [baseInvitation],
): AccountInvitationListResult => ({
  items,
  meta: {
    page: 1,
    pageSize: 10,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  },
});

export const buildResendResult = (
  deliveryStatus: AccountInvitationListItem["deliveryStatus"] = "sent",
) => ({
  invitation: {
    expiresAt: "2026-07-20T10:30:00.000Z",
    deliveryStatus,
    invitationType: "admin_reinvite" as const,
  },
});

export const storeAuthenticatedUser = (role: "student" | "teacher" | "admin") => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-demo-local");
  window.localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      id: `${role}-user`,
      fullName: `Perfil ${role}`,
      email: `${role}.demo@example.com`,
      role,
      status: "active",
      mustChangePassword: false,
      passwordChangedAt: "2026-07-12T09:00:00.000Z",
      permissions: [],
    }),
  );
};

export const renderAppAt = (hash: string) => {
  window.location.hash = hash;
  return render(<App />);
};

export const renderPage = () => render(<AdminAccountInvitationsPage />);

export const formatDateForTest = (value: string) => {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

type ListInvitationsMockLike = {
  (...args: never[]): unknown;
  mockClear: () => void;
  mock: { calls: unknown[][] };
};

export const createWaitForInitialLoad = (
  listInvitationsMock: ListInvitationsMockLike,
) => async () => {
  await screen.findByText("Ana Beatriz");
  expect(listInvitationsMock).toHaveBeenCalledTimes(1);
  listInvitationsMock.mockClear();
};

export const changeFilters = () => {
  fireEvent.change(screen.getByLabelText("Buscar por destinatário"), {
    target: { value: "  Ana  " },
  });
  fireEvent.change(screen.getByLabelText("Status de entrega"), {
    target: { value: "sent" },
  });
  fireEvent.change(screen.getByLabelText("Ciclo de vida"), {
    target: { value: "pending" },
  });
  fireEvent.change(screen.getByLabelText("Tipo"), {
    target: { value: "admin_reinvite" },
  });
  fireEvent.change(screen.getByLabelText("Ordenar por"), {
    target: { value: "recipient" },
  });
  fireEvent.change(screen.getByLabelText("Direção"), {
    target: { value: "asc" },
  });
  fireEvent.change(screen.getByLabelText("Tamanho da página"), {
    target: { value: "25" },
  });
};

const originalLocationHref = window.location.href;

export const restoreOriginalLocation = () => {
  const originalLocation = new URL(originalLocationHref);
  window.history.replaceState(
    null,
    "",
    `${originalLocation.pathname}${originalLocation.search}${originalLocation.hash}`
  );
};
