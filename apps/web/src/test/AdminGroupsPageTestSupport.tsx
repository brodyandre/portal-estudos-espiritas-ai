import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import { ProtectedRoute } from "../components/access/ProtectedRoute";
import { AdminLayout } from "../components/layout/AdminLayout";
import { AdminGroupsPage } from "../pages/AdminGroupsPage";
import type { AdminSelectableGroup } from "../types/adminGroups";
import type {
  AdminStudyMeeting,
  AdminStudyMeetingListResult,
} from "../types/adminStudyMeetings";

export const fixedNow = new Date("2026-07-15T20:30:00.000Z");

export const activeGroup: AdminSelectableGroup = {
  name: "Emmanuel",
  slug: "emmanuel",
  status: "active",
};

export const inactiveGroup: AdminSelectableGroup = {
  name: "A Caminho da Luz",
  slug: "a-caminho-da-luz",
  status: "inactive",
};

export const groups = [activeGroup, inactiveGroup];

export const scheduledMeeting: AdminStudyMeeting = {
  id: "meeting-scheduled",
  groupId: "emmanuel",
  title: "Encontro agendado",
  description: "Leitura preparatória da semana",
  startsAt: "2026-07-15T22:00:00.000Z",
  endsAt: "2026-07-15T23:00:00.000Z",
  canceledAt: null,
  cancellationReason: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

export const inProgressMeeting: AdminStudyMeeting = {
  id: "meeting-progress",
  groupId: "emmanuel",
  title: "Encontro em andamento",
  description: null,
  startsAt: "2026-07-15T20:00:00.000Z",
  endsAt: "2026-07-15T21:00:00.000Z",
  canceledAt: null,
  cancellationReason: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

export const endedMeeting: AdminStudyMeeting = {
  id: "meeting-ended",
  groupId: "emmanuel",
  title: "Encontro encerrado",
  description: "Discussão já realizada",
  startsAt: "2026-07-14T20:00:00.000Z",
  endsAt: "2026-07-14T21:00:00.000Z",
  canceledAt: null,
  cancellationReason: null,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

export const canceledMeeting: AdminStudyMeeting = {
  id: "meeting-canceled",
  groupId: "emmanuel",
  title: "Encontro cancelado",
  description: "Encontro preservado no histórico",
  startsAt: "2026-07-16T20:00:00.000Z",
  endsAt: "2026-07-16T21:00:00.000Z",
  canceledAt: "2026-07-15T12:00:00.000Z",
  cancellationReason: "Recesso do grupo",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-15T12:00:00.000Z",
};

export const buildMeetingsResult = (
  items: AdminStudyMeeting[] = [scheduledMeeting],
  meta: Partial<AdminStudyMeetingListResult["meta"]> = {},
): AdminStudyMeetingListResult => ({
  items,
  meta: {
    page: 1,
    pageSize: 10,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...meta,
  },
});

export const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

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

export const renderPage = () => render(<AdminGroupsPage now={fixedNow} />);

export const renderProtectedRoute = (role: "student" | "teacher" | "admin" = "admin") => {
  storeAuthenticatedUser(role);

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/admin/grupos"]}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route element={<ProtectedRoute routeType="admin" />}>
              <Route element={<AdminGroupsPage now={fixedNow} />} path="/admin/grupos" />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

export const waitForInitialMeetings = async () => {
  await screen.findByText("Encontro agendado");
};

export const expectDefaultMeetingsQuery = (
  listMeetingsMock: { mock: { calls: unknown[][] } },
  groupSlug = "emmanuel",
) => {
  expect(listMeetingsMock.mock.calls[0]).toEqual([
    groupSlug,
    {
      includeCanceled: false,
      sortOrder: "asc",
      pageSize: 10,
      page: 1,
    },
  ]);
};
