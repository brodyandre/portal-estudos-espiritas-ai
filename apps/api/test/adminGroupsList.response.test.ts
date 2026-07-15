import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app";
import {
  createMemoryAuthRepository,
  listAdminGroupsWithPrisma,
  resetMemoryAuthRepositoryStore,
  setMemoryStudyGroupsForTesting,
} from "../src/modules/auth/auth.repository";
import { resetAuthStore } from "../src/modules/auth/auth.service";
import { resetAdminGroupsAuthRepositoryForTesting } from "../src/modules/admin/groups/service";

const loginAsAdmin = async () => {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin.demo@example.com",
    password: "AdminDemo@123",
  });

  return response.body.data.token as string;
};

const buildFakeStudyGroupRunner = (groups: Array<{ id: string; name: string; status: "ACTIVE" | "INACTIVE" }>) => ({
  studyGroup: {
    async findMany(args: {
      where?: { status?: "ACTIVE" | "INACTIVE" };
    }) {
      const filtered = groups
        .filter((group) => !args.where?.status || group.status === args.where.status)
        .sort((first, second) => {
          const nameComparison = first.name.localeCompare(second.name, "pt-BR", {
            sensitivity: "base",
          });

          if (nameComparison !== 0) {
            return nameComparison;
          }

          return first.id.localeCompare(second.id);
        });

      return filtered;
    },
  },
});

describe("admin groups list response", () => {
  beforeEach(() => {
    resetAuthStore();
    resetAdminGroupsAuthRepositoryForTesting();
    resetMemoryAuthRepositoryStore();
    setMemoryStudyGroupsForTesting([
      { id: "beta", name: "Beta", status: "inactive" },
      { id: "alpha-2", name: "Alpha", status: "active" },
      { id: "alpha-1", name: "Alpha", status: "active" },
      { id: "zeta", name: "Zeta", status: "active" },
    ]);
  });

  it("retorna envelope seguro ordenado por nome e slug", async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .get("/api/admin/groups?status=all")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Grupos administrativos listados com sucesso.",
      data: {
        items: [
          { name: "Alpha", slug: "alpha-1", status: "active" },
          { name: "Alpha", slug: "alpha-2", status: "active" },
          { name: "Beta", slug: "beta", status: "inactive" },
          { name: "Zeta", slug: "zeta", status: "active" },
        ],
      },
    });
  });

  it("não retorna campos internos", async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .get("/api/admin/groups?status=all")
      .set("Authorization", `Bearer ${token}`);
    const serialized = JSON.stringify(response.body.data.items);

    expect(serialized).not.toContain("meetingDay");
    expect(serialized).not.toContain("meetingTime");
    expect(serialized).not.toContain("meetUrl");
    expect(serialized).not.toContain("description");
    expect(serialized).not.toContain("participantCount");
  });

  it("retorna lista vazia quando não há grupos no filtro", async () => {
    setMemoryStudyGroupsForTesting([{ id: "beta", name: "Beta", status: "inactive" }]);
    const token = await loginAsAdmin();
    const response = await request(app)
      .get("/api/admin/groups")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });

  it("mantém contrato equivalente entre memória e helper Prisma", async () => {
    const memoryRepository = createMemoryAuthRepository();
    const memoryResult = await memoryRepository.listAdminGroups({ status: "all" });
    const prismaResult = await listAdminGroupsWithPrisma(
      buildFakeStudyGroupRunner([
        { id: "beta", name: "Beta", status: "INACTIVE" },
        { id: "alpha-2", name: "Alpha", status: "ACTIVE" },
        { id: "alpha-1", name: "Alpha", status: "ACTIVE" },
        { id: "zeta", name: "Zeta", status: "ACTIVE" },
      ]),
      { status: "all" },
    );

    expect(prismaResult).toEqual(memoryResult);
  });
});
