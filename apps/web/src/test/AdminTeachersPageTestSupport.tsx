import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AppRoutes } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from "../auth/storage";
import type { AdminSelectableGroup } from "../types/adminGroups";
import type { AdminUsersListResult } from "../types/adminUsersList";
import type { TeacherListItem } from "../types/adminTeachers";

export const selectableGroups: AdminSelectableGroup[] = [
  { name: "Emmanuel", slug: "emmanuel", status: "active" },
  { name: "A Caminho da Luz", slug: "a-caminho-da-luz", status: "active" },
  { name: "Obras Póstumas", slug: "obras-postumas", status: "active" },
  { name: "Grupo Inativo", slug: "grupo-inativo", status: "inactive" },
];

export const baseTeacher: TeacherListItem = {
  id: "teacher-001",
  name: "Profa. Clara",
  emailMasked: "cl***@demo.local",
  role: "teacher",
  status: "active",
  activationStatus: "activated",
  group: null,
  teacherGroups: [
    { name: "Emmanuel", slug: "emmanuel", status: "active" },
  ],
  createdAt: "2026-07-12T10:30:00.000Z",
};

export const awaitingTeacher: TeacherListItem = {
  ...baseTeacher,
  id: "teacher-002",
  name: "Prof. Davi",
  emailMasked: "da***@demo.local",
  activationStatus: "not_activated",
  teacherGroups: [
    { name: "Obras Póstumas", slug: "obras-postumas", status: "active" },
  ],
};

export const inactiveTeacher: TeacherListItem = {
  ...baseTeacher,
  id: "teacher-003",
  name: "Profa. Helena",
  emailMasked: "he***@demo.local",
  status: "inactive",
  activationStatus: "activated",
  teacherGroups: [
    { name: "A Caminho da Luz", slug: "a-caminho-da-luz", status: "active" },
  ],
};

export const attentionTeacher: TeacherListItem = {
  ...baseTeacher,
  id: "teacher-004",
  name: "Prof. Ícaro",
  emailMasked: "ic***@demo.local",
  status: "pending",
  activationStatus: "not_activated",
  teacherGroups: [],
};

export const buildTeacher = (overrides: Partial<TeacherListItem> = {}): TeacherListItem => ({
  ...baseTeacher,
  ...overrides,
});

export const buildTeachersResult = (
  items: AdminUsersListResult["items"] = [baseTeacher],
  overrides: Partial<AdminUsersListResult["meta"]> = {},
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
  role: "student" | "teacher" | "admin" = "admin",
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

export const renderAdminTeachersRoute = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/admin/professores"]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
