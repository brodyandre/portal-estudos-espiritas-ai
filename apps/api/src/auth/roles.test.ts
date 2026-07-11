import { describe, expect, it } from "vitest";

import type { AppUser } from "./types";
import { canAccessRoute, getRolePermissions, hasPermission, hasRole } from "./roles";

const makeUser = (overrides: Partial<AppUser>): AppUser => ({
  id: "user-001",
  fullName: "Pessoa Demo",
  email: "pessoa.demo@example.com",
  role: "visitor",
  status: "active",
  permissions: [],
  ...overrides,
});

describe("auth roles helpers", () => {
  it("retorna as permissoes base por papel", () => {
    expect(getRolePermissions("admin")).toContain("manage_users");
    expect(getRolePermissions("teacher")).toContain("manage_lessons");
    expect(getRolePermissions("student")).toContain("view_meet_link");
    expect(getRolePermissions("visitor")).toContain("view_public_pages");
  });

  it("valida papel do usuario", () => {
    const teacher = makeUser({ role: "teacher" });

    expect(hasRole(teacher, "teacher")).toBe(true);
    expect(hasRole(teacher, "admin")).toBe(false);
  });

  it("valida permissao por papel e permissao adicional", () => {
    const student = makeUser({ role: "student" });
    const visitorWithExtra = makeUser({ permissions: ["view_materials"] });

    expect(hasPermission(student, "view_student_area")).toBe(true);
    expect(hasPermission(student, "manage_groups")).toBe(false);
    expect(hasPermission(visitorWithExtra, "view_materials")).toBe(true);
  });

  it("controla acesso por tipo de rota e status", () => {
    const activeStudent = makeUser({ role: "student", status: "active" });
    const pendingStudent = makeUser({ role: "student", status: "pending" });
    const teacher = makeUser({ role: "teacher", status: "active" });
    const admin = makeUser({ role: "admin", status: "active" });

    expect(canAccessRoute(null, "public")).toBe(true);
    expect(canAccessRoute(activeStudent, "student")).toBe(true);
    expect(canAccessRoute(pendingStudent, "student")).toBe(false);
    expect(canAccessRoute(teacher, "teacher")).toBe(true);
    expect(canAccessRoute(teacher, "admin")).toBe(false);
    expect(canAccessRoute(admin, "admin")).toBe(true);
  });
});
