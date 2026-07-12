import { resolve } from "node:path";

import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { PrismaClient, GroupStatus, EnrollmentStatus, UserRole, UserStatus } from "@prisma/client";

config({ path: resolve(process.cwd(), "../../.env") });

const prisma = new PrismaClient();

const hashPassword = async (password: string) => bcrypt.hash(password, 10);

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.studyGroup.deleteMany();
  await prisma.user.deleteMany();

  const [adminPasswordHash, teacherPasswordHash, studentPasswordHash] = await Promise.all([
    hashPassword("AdminDemo@123"),
    hashPassword("ProfessorDemo@123"),
    hashPassword("AlunoDemo@123"),
  ]);

  await prisma.user.createMany({
    data: [
      {
        id: "user-admin-demo",
        fullName: "Admin Demonstrativo",
        email: "admin.demo@example.com",
        passwordHash: adminPasswordHash,
        whatsapp: "+55 00 90000-0100",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        adminNote: "Perfil administrativo demonstrativo para uso local.",
      },
      {
        id: "user-professor-demo",
        fullName: "Professor Demonstrativo",
        email: "professor.demo@example.com",
        passwordHash: teacherPasswordHash,
        whatsapp: "+55 00 90000-0101",
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        groupName: "Emmanuel",
        groupSlug: "emmanuel",
        adminNote: "Perfil de professor demonstrativo para uso local.",
      },
      {
        id: "user-aluno-demo",
        fullName: "Aluno Demonstrativo",
        email: "aluno.demo@example.com",
        passwordHash: studentPasswordHash,
        whatsapp: "+55 00 90000-0102",
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        groupName: "Emmanuel",
        groupSlug: "emmanuel",
        adminNote: "Aluno demonstrativo aprovado para testes locais.",
      },
    ],
  });

  await prisma.studyGroup.createMany({
    data: [
      {
        id: "emmanuel",
        name: "Emmanuel",
        meetingDay: "segunda-feira",
        meetingTime: "20h",
        participantCount: 88,
        bookTitle: "Estudo demonstrativo do grupo Emmanuel",
        meetUrl: "https://meet.google.com/demo-emmanuel",
        description:
          "Grupo online com foco em estudo sereno, participacao ativa e aplicacao pratica no dia a dia.",
        status: GroupStatus.ACTIVE,
      },
      {
        id: "a-caminho-da-luz",
        name: "A Caminho da Luz",
        meetingDay: "quarta-feira",
        meetingTime: "20h",
        participantCount: 62,
        bookTitle: "Estudo demonstrativo do grupo A Caminho da Luz",
        meetUrl: "https://meet.google.com/demo-a-caminho-luz",
        description:
          "Grupo online voltado para leitura guiada, conversa fraterna e revisao simples dos pontos da aula.",
        status: GroupStatus.ACTIVE,
      },
    ],
  });

  await prisma.enrollment.createMany({
    data: [
      {
        id: "enrollment-001",
        fullName: "Mariana Souza",
        email: "mariana.souza.demo@example.com",
        whatsapp: "+55 00 90000-0001",
        groupInterest: "Emmanuel",
        alreadyParticipates: "Não",
        message:
          "Conheci o grupo pelo cartaz e gostaria de participar para entender melhor a proposta dos encontros.",
        status: EnrollmentStatus.PENDING,
        createdAt: new Date("2026-07-09T10:12:00-03:00"),
      },
      {
        id: "enrollment-002",
        fullName: "Carlos Eduardo Lima",
        email: "carlos.lima.demo@example.com",
        whatsapp: "+55 00 90000-0002",
        groupInterest: "A Caminho da Luz",
        alreadyParticipates: "Já participei antes",
        message:
          "Participei de alguns encontros no ano passado e gostaria de retomar com mais constancia.",
        status: EnrollmentStatus.APPROVED,
        createdAt: new Date("2026-07-08T18:40:00-03:00"),
        reviewedAt: new Date("2026-07-09T08:20:00-03:00"),
        reviewedBy: "Professor Daniel",
        teacherNote: "Aprovado para retornar ao grupo desta semana.",
      },
      {
        id: "enrollment-003",
        fullName: "Fernanda Rocha",
        email: "fernanda.rocha.demo@example.com",
        whatsapp: "+55 00 90000-0003",
        groupInterest: "Ainda não sei",
        alreadyParticipates: "Não",
        message:
          "Gostaria de conhecer melhor os dois grupos antes de decidir qual combina mais comigo.",
        status: EnrollmentStatus.NEEDS_CONTACT,
        createdAt: new Date("2026-07-09T07:55:00-03:00"),
        reviewedAt: new Date("2026-07-09T12:05:00-03:00"),
        reviewedBy: "Professora Helena",
        teacherNote: "Conversar antes para orientar melhor sobre o perfil de cada grupo.",
      },
      {
        id: "enrollment-004",
        fullName: "Joao Victor Mendes",
        email: "joaovictor.mendes.demo@example.com",
        whatsapp: "+55 00 90000-0004",
        groupInterest: "Emmanuel",
        alreadyParticipates: "Sim",
        message:
          "Ja acompanho encontros esporadicos e queria saber como ficar mais presente nas aulas.",
        status: EnrollmentStatus.APPROVED,
        createdAt: new Date("2026-07-07T21:18:00-03:00"),
        reviewedAt: new Date("2026-07-08T09:14:00-03:00"),
        reviewedBy: "Professor Daniel",
        teacherNote: "Aprovado. Ja conhece a rotina do grupo.",
      },
      {
        id: "enrollment-005",
        fullName: "Patricia Almeida",
        email: "patricia.almeida.demo@example.com",
        whatsapp: "+55 00 90000-0005",
        groupInterest: "A Caminho da Luz",
        alreadyParticipates: "Não",
        message:
          "Tenho interesse, mas no momento nao consigo participar no horario semanal com regularidade.",
        status: EnrollmentStatus.REJECTED,
        createdAt: new Date("2026-07-06T16:30:00-03:00"),
        reviewedAt: new Date("2026-07-07T11:00:00-03:00"),
        reviewedBy: "Professora Helena",
        teacherNote: "Orientada a procurar um horario mais adequado antes de entrar no grupo.",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: "audit-seed-001",
        occurredAt: new Date("2026-07-09T10:12:00-03:00"),
        actorName: "Portal público",
        actorRole: UserRole.VISITOR,
        action: "Inscrição criada",
        entity: "Enrollment enrollment-001",
        note: "Cadastro demonstrativo criado a partir da página pública.",
      },
      {
        id: "audit-seed-002",
        occurredAt: new Date("2026-07-09T08:20:00-03:00"),
        actorName: "Professor Daniel",
        actorRole: UserRole.TEACHER,
        action: "Status de inscrição atualizado",
        entity: "Enrollment enrollment-002",
        note: "Cadastro aprovado em ambiente local demonstrativo.",
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
