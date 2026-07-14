import { fireEvent, render, screen } from "@testing-library/react";
import { expect } from "vitest";

import { App } from "../App";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import type { AdminUserListItem, AdminUsersListResult } from "../types/adminUsersList";

export const baseUser: AdminUserListItem = {
  id: "admin-user-001",
  name: "Ana Beatriz Moraes",
  emailMasked: "an***@demo.local",
  role: "student",
  status: "active",
  activationStatus: "activated",
  group: {
    name: "Emmanuel",
    slug: "emmanuel",
  },
  createdAt: "2026-07-12T10:30:00.000Z",
};

export const baseResult: AdminUsersListResult = {
  items: [baseUser],
  meta: {
    page: 1,
    pageSize: 10,
    total: 24,
    totalPages: 3,
  },
  source: "api",
};

export const buildUser = (overrides: Partial<AdminUserListItem> = {}): AdminUserListItem => ({
  ...baseUser,
  ...overrides,
});

export const buildResult = (
  overrides: Partial<AdminUsersListResult["meta"]> = {},
  items: AdminUserListItem[] = [baseUser],
  source: AdminUsersListResult["source"] = "api",
): AdminUsersListResult => ({
  items,
  meta: {
    page: 1,
    pageSize: 10,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  },
  source,
});

export const storeAuthenticatedUser = (
  role: "student" | "teacher" | "admin",
  overrides: Partial<{
    id: string;
    fullName: string;
    email: string;
  }> = {},
) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-demo-local");
  window.localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      id: overrides.id ?? `${role}-user`,
      fullName: overrides.fullName ?? `Perfil ${role}`,
      email: overrides.email ?? `${role}.demo@example.com`,
      role,
      status: "active",
      mustChangePassword: false,
      passwordChangedAt: "2026-07-12T09:00:00.000Z",
      permissions: [],
    }),
  );
};

export const renderPage = () => render(<AdminUsersPage />);

export const renderAppAt = (hash: string) => {
  window.location.hash = hash;
  return render(<App />);
};

export const formatDateForTest = (value: string) => {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

type ListUsersMockLike = {
  (...args: never[]): unknown;
  mockClear: () => void;
};

export const createWaitForInitialLoad = (listUsersMock: ListUsersMockLike) => async () => {
  await screen.findByText("Ana Beatriz Moraes");
  expect(listUsersMock).toHaveBeenCalledTimes(1);
  listUsersMock.mockClear();
};

export const changeFilters = () => {
  fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
    target: { value: "  Ana  " },
  });
  fireEvent.change(screen.getByLabelText("Papel"), {
    target: { value: "teacher" },
  });
  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "inactive" },
  });
  fireEvent.change(screen.getByLabelText("Ativação"), {
    target: { value: "not_activated" },
  });
  fireEvent.change(screen.getByLabelText("Grupo (slug)"), {
    target: { value: "emmanuel" },
  });
  fireEvent.change(screen.getByLabelText("Ordenar por"), {
    target: { value: "name" },
  });
  fireEvent.change(screen.getByLabelText("Direção"), {
    target: { value: "asc" },
  });
};

const originalLocationHref = window.location.href;

export const restoreOriginalLocation = () => {
  const originalLocation = new URL(originalLocationHref);
  window.history.replaceState(
    null,
    "",
    `${originalLocation.pathname}${originalLocation.search}${originalLocation.hash}`,
  );
};
