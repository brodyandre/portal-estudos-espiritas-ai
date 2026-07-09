import type { StudyGroupId } from "./studies";

export interface StudySummary {
  id: string;
  groupId: StudyGroupId;
  lessonId: string;
  title: string;
  lessonTitle: string;
  createdAt: string;
  readingTimeMinutes: number;
  content: string;
  takeaways: string[];
}

export const summaries: StudySummary[] = [
  {
    id: "summary-emmanuel-2026-07-06",
    groupId: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-06",
    title: "Resumo: acolhimento e constancia",
    lessonTitle: "A importancia de estudar com regularidade",
    createdAt: "2026-07-06T21:20:00-03:00",
    readingTimeMinutes: 2,
    content:
      "O grupo conversou sobre pequenas atitudes que ajudam a manter o estudo vivo durante a semana. A principal ideia foi seguir com simplicidade, sem pressa e com boa vontade.",
    takeaways: [
      "Separar alguns minutos fixos para leitura.",
      "Anotar uma duvida por encontro.",
      "Praticar escuta respeitosa nas conversas do grupo.",
    ],
  },
  {
    id: "summary-a-caminho-da-luz-2026-07-08",
    groupId: "a-caminho-da-luz",
    lessonId: "lesson-a-caminho-da-luz-2026-07-08",
    title: "Resumo: estudo com serenidade",
    lessonTitle: "Como aprender em conjunto com mais clareza",
    createdAt: "2026-07-08T21:18:00-03:00",
    readingTimeMinutes: 2,
    content:
      "A aula reforcou que o estudo em grupo cresce quando cada pessoa participa com humildade, calma e interesse sincero. Tambem foi lembrado que toda duvida pode ser um bom ponto de partida.",
    takeaways: [
      "Falar com objetividade e respeito.",
      "Revisar o tema antes do encontro seguinte.",
      "Valorizar perguntas simples e honestas.",
    ],
  },
  {
    id: "summary-emmanuel-2026-06-29",
    groupId: "emmanuel",
    lessonId: "lesson-emmanuel-2026-06-29",
    title: "Resumo: duvidas e convivio fraterno",
    lessonTitle: "Perguntar tambem faz parte do aprendizado",
    createdAt: "2026-06-29T21:14:00-03:00",
    readingTimeMinutes: 1,
    content:
      "Os participantes refletiram sobre a importancia de perguntar com liberdade e respeito. O encontro terminou com incentivo para registrar pensamentos curtos ao longo da semana.",
    takeaways: [
      "Duvidas ajudam o grupo inteiro.",
      "Anotacoes curtas facilitam a revisao.",
      "Convivio fraterno fortalece o estudo.",
    ],
  },
];
