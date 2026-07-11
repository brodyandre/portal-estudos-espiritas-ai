export type StudyGroupId = "emmanuel" | "a-caminho-da-luz";
const DEMO_MEET_LINK_EMMANUEL = "https://meet.google.com/demo-emmanuel";
const DEMO_MEET_LINK_A_CAMINHO_DA_LUZ = "https://meet.google.com/demo-a-caminho-luz";

export interface NextLesson {
  id: string;
  groupId: StudyGroupId;
  title: string;
  theme: string;
  scheduledAt: string;
  meetUrl: string;
  status: "scheduled" | "published";
  teacherNote: string;
}

export interface StudyGroup {
  id: StudyGroupId;
  name: string;
  meetingDay: string;
  meetingTime: string;
  participantCount: number;
  bookTitle: string;
  meetUrl: string;
  description: string;
  nextLesson: NextLesson;
}

export const studyGroups: StudyGroup[] = [
  {
    id: "emmanuel",
    name: "Emmanuel",
    meetingDay: "segunda-feira",
    meetingTime: "20h",
    participantCount: 88,
    bookTitle: "Estudo demonstrativo do grupo Emmanuel",
    meetUrl: DEMO_MEET_LINK_EMMANUEL,
    description:
      "Grupo online com foco em estudo sereno, participacao ativa e aplicacao pratica no dia a dia.",
    nextLesson: {
      id: "lesson-emmanuel-2026-07-13",
      groupId: "emmanuel",
      title: "Encontro sobre constancia no estudo",
      theme: "Como manter disciplina, escuta e acolhimento durante a semana.",
      scheduledAt: "2026-07-13T20:00:00-03:00",
      meetUrl: DEMO_MEET_LINK_EMMANUEL,
      status: "scheduled",
      teacherNote:
        "Abrir com acolhimento breve e reservar tempo para perguntas dos participantes novos.",
    },
  },
  {
    id: "a-caminho-da-luz",
    name: "A Caminho da Luz",
    meetingDay: "quarta-feira",
    meetingTime: "20h",
    participantCount: 62,
    bookTitle: "Estudo demonstrativo do grupo A Caminho da Luz",
    meetUrl: DEMO_MEET_LINK_A_CAMINHO_DA_LUZ,
    description:
      "Grupo online voltado para leitura guiada, conversa fraterna e revisao simples dos pontos da aula.",
    nextLesson: {
      id: "lesson-a-caminho-da-luz-2026-07-15",
      groupId: "a-caminho-da-luz",
      title: "Encontro sobre convivio e responsabilidade",
      theme: "Como estudar com paciencia, respeito e compromisso com o grupo.",
      scheduledAt: "2026-07-15T20:00:00-03:00",
      meetUrl: DEMO_MEET_LINK_A_CAMINHO_DA_LUZ,
      status: "scheduled",
      teacherNote:
        "Fechar o encontro com uma sintese curta e indicar um material de apoio para a semana.",
    },
  },
];

export const nextLessons: NextLesson[] = studyGroups.map((group) => group.nextLesson);
