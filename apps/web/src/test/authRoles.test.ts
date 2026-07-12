import { describe, expect, it } from "vitest";

import type { AppUser } from "../auth/types";
import { canAccessRoute, getRolePermissions, hasPermission, hasRole } from "../auth/roles";

const makeUser = (overrides: Partial<AppUser>): AppUser => ({
  id: "user-001",
  fullName: "Pessoa Demo",
  email: "pessoa.demo@example.com",
  role: "visitor",
  status: "active",
  mustChangePassword: false,
  passwordChangedAt: null,
  permissions: [],
  ...overrides,
});

describe("frontend auth roles helpers", () => {
  it("retorna permissoes base por papel", () => {
    expect(getRolePermissions("admin")).toContain("manage_settings");
    expect(getRolePermissions("teacher")).toContain("review_enrollments");
    expect(getRolePermissions("student")).toContain("ask_assistant");
    expect(getRolePermissions("visitor")).toContain("submit_enrollment");
  });

  it("confere papel e permissao", () => {
    const admin = makeUser({ role: "admin" });
    const visitor = makeUser({ role: "visitor", permissions: ["view_materials"] });

    expect(hasRole(admin, "admin")).toBe(true);
    expect(hasRole(admin, "teacher")).toBe(false);
    expect(hasPermission(admin, "manage_users")).toBe(true);
    expect(hasPermission(visitor, "view_materials")).toBe(true);
    expect(hasPermission(visitor, "view_meet_link")).toBe(false);
  });

  it("valida acesso por tipo de rota", () => {
    const activeStudent = makeUser({ role: "student", status: "active" });
    const inactiveTeacher = makeUser({ role: "teacher", status: "inactive" });
    const admin = makeUser({ role: "admin", status: "active" });

    expect(canAccessRoute(null, "public")).toBe(true);
    expect(canAccessRoute(activeStudent, "student")).toBe(true);
    expect(canAccessRoute(activeStudent, "teacher")).toBe(false);
    expect(canAccessRoute(inactiveTeacher, "teacher")).toBe(false);
    expect(canAccessRoute(admin, "admin")).toBe(true);
  });
});
