import {
  GroupStatus,
  KnowledgeBookStatus,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createMemoryBookAccessRepository,
  createMemoryBookAccessState,
  createPrismaBookAccessRepository,
} from "../src/modules/book-access/book-access.repository";

describe("book access repository", () => {
  it("repository memory usa apenas vinculos TeacherStudyGroup para professor", async () => {
    const repository = createMemoryBookAccessRepository(
      createMemoryBookAccessState({
        groups: [
          {
            id: "emmanuel",
            name: "Emmanuel",
            status: "active",
            knowledgeBook: {
              id: "book-emmanuel",
              slug: "emmanuel",
              title: "Emmanuel",
              status: "active",
            },
          },
          {
            id: "a-caminho-da-luz",
            name: "A Caminho da Luz",
            status: "active",
            knowledgeBook: {
              id: "book-a-caminho-da-luz",
              slug: "a-caminho-da-luz",
              title: "A Caminho da Luz",
              status: "active",
            },
          },
        ],
        teacherGroupMemberships: [
          { userId: "teacher-1", groupId: "emmanuel" },
          { userId: "teacher-2", groupId: "a-caminho-da-luz" },
        ],
      }),
    );

    await expect(repository.listTeacherGroupsByUserId("teacher-1")).resolves.toEqual([
      expect.objectContaining({ id: "emmanuel" }),
    ]);
  });

  it("repository Prisma seleciona somente usuario, TeacherStudyGroup, StudyGroup e KnowledgeBook", async () => {
    const userFindUnique = vi.fn().mockResolvedValue({ groupSlug: "emmanuel" });
    const studyGroupFindUnique = vi.fn().mockResolvedValue({
      id: "emmanuel",
      name: "Emmanuel",
      status: GroupStatus.ACTIVE,
      knowledgeBook: {
        id: "book-emmanuel",
        slug: "emmanuel",
        title: "Emmanuel",
        status: KnowledgeBookStatus.ACTIVE,
      },
    });
    const teacherStudyGroupFindMany = vi.fn().mockResolvedValue([
      {
        group: {
          id: "a-caminho-da-luz",
          name: "A Caminho da Luz",
          status: GroupStatus.ACTIVE,
          knowledgeBook: {
            id: "book-a-caminho-da-luz",
            slug: "a-caminho-da-luz",
            title: "A Caminho da Luz",
            status: KnowledgeBookStatus.ACTIVE,
          },
        },
      },
    ]);
    const prisma = {
      user: { findUnique: userFindUnique },
      studyGroup: { findUnique: studyGroupFindUnique },
      teacherStudyGroup: { findMany: teacherStudyGroupFindMany },
    } as unknown as Pick<PrismaClient, "user" | "studyGroup" | "teacherStudyGroup">;

    const repository = createPrismaBookAccessRepository(prisma);

    await expect(repository.findUserGroupByUserId("student-1")).resolves.toEqual({
      groupSlug: "emmanuel",
    });
    await expect(repository.findGroupById("emmanuel")).resolves.toEqual({
      id: "emmanuel",
      name: "Emmanuel",
      status: "active",
      knowledgeBook: {
        id: "book-emmanuel",
        slug: "emmanuel",
        title: "Emmanuel",
        status: "active",
      },
    });
    await expect(repository.listTeacherGroupsByUserId("teacher-1")).resolves.toEqual([
      {
        id: "a-caminho-da-luz",
        name: "A Caminho da Luz",
        status: "active",
        knowledgeBook: {
          id: "book-a-caminho-da-luz",
          slug: "a-caminho-da-luz",
          title: "A Caminho da Luz",
          status: "active",
        },
      },
    ]);

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "student-1" },
      select: { groupSlug: true },
    });
    expect(studyGroupFindUnique).toHaveBeenCalledWith({
      where: { id: "emmanuel" },
      select: {
        id: true,
        name: true,
        status: true,
        knowledgeBook: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
          },
        },
      },
    });
    expect(teacherStudyGroupFindMany).toHaveBeenCalledWith({
      where: { userId: "teacher-1" },
      orderBy: [
        {
          group: {
            name: "asc",
          },
        },
        {
          groupId: "asc",
        },
      ],
      select: {
        group: {
          select: {
            id: true,
            name: true,
            status: true,
            knowledgeBook: {
              select: {
                id: true,
                slug: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });
  });
});
