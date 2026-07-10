export type GroupSlug = "emmanuel" | "a-caminho-da-luz";

export interface DemoGroup {
  slug: GroupSlug;
  name: string;
  meetingDay: string;
  meetingTime: string;
  participantCount: number;
  meetUrl: string;
  bookTitle: string;
  description: string;
  nextLesson: {
    id: string;
    title: string;
    theme: string;
    scheduledAt: string;
    scheduledLabel: string;
    status: "proxima" | "hoje";
    teacherNote: string;
  };
}

export interface DemoFlowStep {
  step: number;
  title: string;
  description: string;
  state?: "pending" | "active" | "done";
}

export interface DemoMaterial {
  id: string;
  groupSlug: GroupSlug;
  title: string;
  kind: "Leitura" | "Resumo" | "Orientacao" | "Atividade";
  description: string;
  lessonId: string | null;
  sourcePath: string | null;
  format: "markdown" | "internal";
  publishedAt: string;
  publishedLabel: string;
}

export interface DemoSummary {
  id: string;
  groupSlug: GroupSlug;
  lessonId: string;
  title: string;
  lessonTitle: string;
  createdAt: string;
  readingTimeMinutes: number;
  readingTimeLabel: string;
  content: string;
  takeaways: string[];
}

export interface DemoQuestion {
  id: string;
  authorName: string;
  groupSlug: GroupSlug;
  lessonId: string;
  lessonTitle: string;
  question: string;
  status: "new" | "reviewing" | "answered";
  createdAt: string;
  visibility: "group" | "teacher";
}

export interface DemoProgress {
  label: string;
  value: string;
  note: string;
}

export interface DemoProgressItem {
  id: string;
  studentId: string;
  studentName: string;
  groupSlug: GroupSlug;
  completedLessons: number;
  totalLessons: number;
  attendanceRate: number;
  currentStreakWeeks: number;
  questionsSent: number;
  lastAccessedAt: string;
  nextGoal: string;
  encouragement: string;
}

export interface DemoProgressOverview {
  studentId: string;
  studentName: string;
  totalCompletedLessons: number;
  totalPlannedLessons: number;
  averageAttendanceRate: number;
  assistantPrompt: string;
}

export interface DemoProgressResponse {
  overview: DemoProgressOverview;
  items: DemoProgressItem[];
}

export type {
  Enrollment,
  EnrollmentAlreadyParticipates,
  EnrollmentGroupInterest,
  EnrollmentInput,
  EnrollmentStatus,
  EnrollmentValidationErrors,
} from "../types/enrollment";
export {
  ENROLLMENT_GROUP_INTERESTS,
  ENROLLMENT_MESSAGE_MAX_LENGTH,
  ENROLLMENT_PARTICIPATION_OPTIONS,
  ENROLLMENT_STATUSES,
  ENROLLMENT_TEACHER_NOTE_MAX_LENGTH,
  isValidEnrollmentEmail,
  validateEnrollmentInput,
} from "../types/enrollment";
export { enrollments as mockEnrollments, listMockEnrollments } from "./enrollments";

export interface CreateMockQuestionInput {
  groupSlug: GroupSlug;
  lessonId: string;
  authorName: string;
  question: string;
  visibility?: "group" | "teacher";
}

export const groups: DemoGroup[] = [
  {
    slug: "emmanuel",
    name: "Emmanuel",
    meetingDay: "Segunda-feira",
    meetingTime: "20h",
    participantCount: 88,
    meetUrl: "https://meet.google.com/emm-demo-aula",
    bookTitle: "Estudo demonstrativo do grupo Emmanuel",
    description:
      "Grupo com encontro sereno, leitura orientada e espaco para duvidas simples e honestas.",
    nextLesson: {
      id: "lesson-emmanuel-2026-07-13",
      title: "Encontro sobre constancia no estudo",
      theme: "Como manter disciplina, escuta e acolhimento durante a semana.",
      scheduledAt: "2026-07-13T20:00:00-03:00",
      scheduledLabel: "Segunda, 13 de julho de 2026, 20h",
      status: "proxima",
      teacherNote:
        "Abrir com acolhimento breve e reservar tempo para perguntas dos participantes novos.",
    },
  },
  {
    slug: "a-caminho-da-luz",
    name: "A Caminho da Luz",
    meetingDay: "Quarta-feira",
    meetingTime: "20h",
    participantCount: 62,
    meetUrl: "https://meet.google.com/acl-demo-aula",
    bookTitle: "Estudo demonstrativo do grupo A Caminho da Luz",
    description:
      "Grupo acolhedor com revisao breve, conversa fraterna e preparacao tranquila para cada aula.",
    nextLesson: {
      id: "lesson-a-caminho-da-luz-2026-07-15",
      title: "Encontro sobre convivio e responsabilidade",
      theme: "Como estudar com paciencia, respeito e compromisso com o grupo.",
      scheduledAt: "2026-07-15T20:00:00-03:00",
      scheduledLabel: "Quarta, 15 de julho de 2026, 20h",
      status: "proxima",
      teacherNote:
        "Fechar o encontro com uma sintese curta e indicar um material de apoio para a semana.",
    },
  },
];

export const homeSteps: DemoFlowStep[] = [
  {
    step: 1,
    title: "Escolha seu espaco",
    description: "Entre pelo Portal, pela area do aluno ou pela area do professor.",
  },
  {
    step: 2,
    title: "Veja o proximo encontro",
    description: "Confirme grupo, horario e link do Google Meet com poucos toques.",
  },
  {
    step: 3,
    title: "Consulte materiais",
    description: "Leia orientacoes, resumos e atividades demonstrativas com linguagem simples.",
  },
  {
    step: 4,
    title: "Participe com clareza",
    description: "Leve duvidas, acompanhe o fluxo da aula e revise os pontos principais.",
  },
  {
    step: 5,
    title: "Revise com apoio humano",
    description: "Use o assistente como apoio de estudo, sempre com espaco para revisao do professor.",
  },
];

export const professorSteps: DemoFlowStep[] = [
  {
    step: 1,
    title: "Escolher grupo e tema",
    description: "Definir o encontro e alinhar o objetivo principal da aula.",
  },
  {
    step: 2,
    title: "Inserir link Meet",
    description: "Registrar o acesso da aula para os participantes do grupo.",
  },
  {
    step: 3,
    title: "Gerar roteiro e perguntas",
    description: "Receber um rascunho simples para ganhar tempo na preparacao.",
  },
  {
    step: 4,
    title: "Revisar e ajustar",
    description: "Conferir o conteudo com calma antes de compartilhar.",
  },
  {
    step: 5,
    title: "Publicar",
    description: "Liberar encontro, materiais e orientacoes para o grupo.",
  },
];

export const materials: DemoMaterial[] = [
  {
    id: "material-emmanuel-001",
    groupSlug: "emmanuel",
    title: "Leitura demonstrativa do grupo Emmanuel",
    kind: "Leitura",
    description: "Texto curto de apoio para preparar o encontro da semana.",
    lessonId: "lesson-emmanuel-2026-07-13",
    sourcePath: "data/knowledge/emmanuel_demo.md",
    format: "markdown",
    publishedAt: "2026-07-09T08:00:00-03:00",
    publishedLabel: "Atualizado em 9 jul 2026",
  },
  {
    id: "material-emmanuel-002",
    groupSlug: "emmanuel",
    title: "Orientacoes gerais do grupo",
    kind: "Orientacao",
    description: "Combinados simples para acolher bem quem participa do encontro.",
    lessonId: null,
    sourcePath: "data/knowledge/orientacoes_do_grupo.md",
    format: "markdown",
    publishedAt: "2026-07-01T09:00:00-03:00",
    publishedLabel: "Atualizado em 1 jul 2026",
  },
  {
    id: "material-emmanuel-003",
    groupSlug: "emmanuel",
    title: "Resumo breve da ultima aula",
    kind: "Resumo",
    description: "Sintese curta com os pontos principais do encontro anterior.",
    lessonId: "lesson-emmanuel-2026-07-06",
    sourcePath: null,
    format: "internal",
    publishedAt: "2026-07-06T21:25:00-03:00",
    publishedLabel: "Atualizado em 6 jul 2026",
  },
  {
    id: "material-emmanuel-004",
    groupSlug: "emmanuel",
    title: "Atividade da semana",
    kind: "Atividade",
    description: "Registrar uma ideia pratica e uma duvida para o proximo encontro.",
    lessonId: "lesson-emmanuel-2026-07-13",
    sourcePath: null,
    format: "internal",
    publishedAt: "2026-07-09T08:10:00-03:00",
    publishedLabel: "Atualizado em 9 jul 2026",
  },
  {
    id: "material-a-caminho-da-luz-001",
    groupSlug: "a-caminho-da-luz",
    title: "Leitura demonstrativa do grupo A Caminho da Luz",
    kind: "Leitura",
    description: "Leitura breve para chegar ao encontro com o tema fresco na memoria.",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    sourcePath: "data/knowledge/a_caminho_da_luz_demo.md",
    format: "markdown",
    publishedAt: "2026-07-09T08:15:00-03:00",
    publishedLabel: "Atualizado em 9 jul 2026",
  },
  {
    id: "material-a-caminho-da-luz-002",
    groupSlug: "a-caminho-da-luz",
    title: "Orientacoes gerais do grupo",
    kind: "Orientacao",
    description: "Lembretes sobre participacao, respeito e convivio online.",
    lessonId: null,
    sourcePath: "data/knowledge/orientacoes_do_grupo.md",
    format: "markdown",
    publishedAt: "2026-07-01T09:00:00-03:00",
    publishedLabel: "Atualizado em 1 jul 2026",
  },
  {
    id: "material-a-caminho-da-luz-003",
    groupSlug: "a-caminho-da-luz",
    title: "Resumo breve da ultima aula",
    kind: "Resumo",
    description: "Resumo demonstrativo com linguagem simples para consulta rapida.",
    lessonId: "lesson-a-caminho-da-luz-2026-07-08",
    sourcePath: null,
    format: "internal",
    publishedAt: "2026-07-08T21:20:00-03:00",
    publishedLabel: "Atualizado em 8 jul 2026",
  },
  {
    id: "material-a-caminho-da-luz-004",
    groupSlug: "a-caminho-da-luz",
    title: "Perguntas sugeridas para a semana",
    kind: "Atividade",
    description: "Lista curta de perguntas para apoiar a preparacao da aula.",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    sourcePath: null,
    format: "internal",
    publishedAt: "2026-07-09T08:20:00-03:00",
    publishedLabel: "Atualizado em 9 jul 2026",
  },
];

export const summaries: DemoSummary[] = [
  {
    id: "summary-emmanuel-2026-07-06",
    groupSlug: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-06",
    title: "Resumo: acolhimento e constancia",
    lessonTitle: "A importancia de estudar com regularidade",
    createdAt: "2026-07-06T21:20:00-03:00",
    readingTimeMinutes: 2,
    readingTimeLabel: "Leitura de 2 min",
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
    groupSlug: "a-caminho-da-luz",
    lessonId: "lesson-a-caminho-da-luz-2026-07-08",
    title: "Resumo: estudo com serenidade",
    lessonTitle: "Como aprender em conjunto com mais clareza",
    createdAt: "2026-07-08T21:18:00-03:00",
    readingTimeMinutes: 2,
    readingTimeLabel: "Leitura de 2 min",
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
    groupSlug: "emmanuel",
    lessonId: "lesson-emmanuel-2026-06-29",
    title: "Resumo: duvidas e convivio fraterno",
    lessonTitle: "Perguntar tambem faz parte do aprendizado",
    createdAt: "2026-06-29T21:14:00-03:00",
    readingTimeMinutes: 1,
    readingTimeLabel: "Leitura de 1 min",
    content:
      "Os participantes refletiram sobre a importancia de perguntar com liberdade e respeito. O encontro terminou com incentivo para registrar pensamentos curtos ao longo da semana.",
    takeaways: [
      "Duvidas ajudam o grupo inteiro.",
      "Anotacoes curtas facilitam a revisao.",
      "Convivio fraterno fortalece o estudo.",
    ],
  },
];

export const questions: DemoQuestion[] = [
  {
    id: "question-1",
    authorName: "Ana Clara",
    groupSlug: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-13",
    lessonTitle: "Encontro sobre constancia no estudo",
    question: "Como manter o estudo vivo mesmo quando a semana fica mais corrida?",
    status: "new",
    createdAt: "2026-07-09T09:10:00-03:00",
    visibility: "group",
  },
  {
    id: "question-2",
    authorName: "Paulo Henrique",
    groupSlug: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-13",
    lessonTitle: "Encontro sobre constancia no estudo",
    question: "Vale anotar apenas uma ideia principal depois de cada leitura?",
    status: "answered",
    createdAt: "2026-07-08T18:42:00-03:00",
    visibility: "group",
  },
  {
    id: "question-3",
    authorName: "Marina Lopes",
    groupSlug: "a-caminho-da-luz",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    lessonTitle: "Encontro sobre convivio e responsabilidade",
    question: "Como participar mais sem interromper quem esta compartilhando?",
    status: "reviewing",
    createdAt: "2026-07-09T08:55:00-03:00",
    visibility: "teacher",
  },
  {
    id: "question-4",
    authorName: "Rafael Costa",
    groupSlug: "a-caminho-da-luz",
    lessonId: "lesson-a-caminho-da-luz-2026-07-15",
    lessonTitle: "Encontro sobre convivio e responsabilidade",
    question: "Podemos receber um resumo curto antes da proxima aula?",
    status: "new",
    createdAt: "2026-07-08T22:05:00-03:00",
    visibility: "group",
  },
  {
    id: "question-5",
    authorName: "Luciana Melo",
    groupSlug: "emmanuel",
    lessonId: "lesson-emmanuel-2026-07-06",
    lessonTitle: "Perguntar tambem faz parte do aprendizado",
    question: "Qual e a melhor forma de levar uma duvida pessoal para o grupo?",
    status: "answered",
    createdAt: "2026-07-06T21:28:00-03:00",
    visibility: "teacher",
  },
];

export const studentHighlights: DemoProgress[] = [
  {
    label: "Aulas concluidas",
    value: "13 de 17",
    note: "Ritmo constante e acompanhamento regular.",
  },
  {
    label: "Presenca media",
    value: "88%",
    note: "Boa participacao nos dois grupos demonstrativos.",
  },
  {
    label: "Perguntas enviadas",
    value: "5",
    note: "Duvidas registradas com clareza ajudam o grupo todo.",
  },
];

export const progress: DemoProgressResponse = {
  overview: {
    studentId: "student-001",
    studentName: "Joao Pedro",
    totalCompletedLessons: 13,
    totalPlannedLessons: 17,
    averageAttendanceRate: 0.88,
    assistantPrompt:
      "Pergunte ao assistente de estudo quando quiser revisar um ponto, preparar uma duvida ou retomar o tema da ultima aula.",
  },
  items: [
    {
      id: "progress-student-001-emmanuel",
      studentId: "student-001",
      studentName: "Joao Pedro",
      groupSlug: "emmanuel",
      completedLessons: 8,
      totalLessons: 10,
      attendanceRate: 0.9,
      currentStreakWeeks: 4,
      questionsSent: 3,
      lastAccessedAt: "2026-07-09T07:45:00-03:00",
      nextGoal: "Ler o material demonstrativo de apoio e levar uma pergunta curta para a aula.",
      encouragement:
        "Seu progresso esta constante. Continue com passos simples e presenca atenta no encontro.",
    },
    {
      id: "progress-student-001-a-caminho-da-luz",
      studentId: "student-001",
      studentName: "Joao Pedro",
      groupSlug: "a-caminho-da-luz",
      completedLessons: 5,
      totalLessons: 7,
      attendanceRate: 0.86,
      currentStreakWeeks: 2,
      questionsSent: 2,
      lastAccessedAt: "2026-07-08T22:12:00-03:00",
      nextGoal: "Revisar o resumo da ultima aula antes do encontro de quarta-feira.",
      encouragement:
        "Voce esta avancando bem. Revisar com calma antes da aula pode ajudar bastante.",
    },
  ],
};

export const studentAssistantPrompt =
  "Pergunte ao assistente de estudo quando quiser revisar um ponto, preparar uma duvida ou retomar o tema da ultima aula.";

const cloneGroup = (group: DemoGroup): DemoGroup => ({
  ...group,
  nextLesson: { ...group.nextLesson },
});

const cloneMaterial = (material: DemoMaterial): DemoMaterial => ({ ...material });

const cloneSummary = (summary: DemoSummary): DemoSummary => ({
  ...summary,
  takeaways: [...summary.takeaways],
});

const cloneQuestion = (question: DemoQuestion): DemoQuestion => ({ ...question });

const cloneProgressItem = (item: DemoProgressItem): DemoProgressItem => ({ ...item });

const createQuestionSeed = () => questions.map(cloneQuestion);

let questionStore: DemoQuestion[] = createQuestionSeed();

const lessonTitleFromGroups = new Map(groups.map((group) => [group.nextLesson.id, group.nextLesson.title]));
const lessonTitleFromSummaries = new Map(summaries.map((summary) => [summary.lessonId, summary.lessonTitle]));

const resolveLessonTitle = (groupSlug: GroupSlug, lessonId: string) => {
  return (
    lessonTitleFromGroups.get(lessonId) ??
    lessonTitleFromSummaries.get(lessonId) ??
    `Aula recente do grupo ${groups.find((group) => group.slug === groupSlug)?.name ?? "selecionado"}`
  );
};

export const listMockStudies = () => groups.map(cloneGroup);

export const getMockStudyBySlug = (slug: string) => {
  const group = groups.find((item) => item.slug === slug);

  return group ? cloneGroup(group) : undefined;
};

export const listMockSummaries = (groupSlug?: GroupSlug) =>
  summaries
    .filter((summary) => (groupSlug ? summary.groupSlug === groupSlug : true))
    .map(cloneSummary);

export const listMockMaterials = (filters?: {
  groupSlug?: GroupSlug;
  kind?: DemoMaterial["kind"];
}) =>
  materials
    .filter((material) => (filters?.groupSlug ? material.groupSlug === filters.groupSlug : true))
    .filter((material) => (filters?.kind ? material.kind === filters.kind : true))
    .map(cloneMaterial);

export const listMockQuestions = (filters?: {
  groupSlug?: GroupSlug;
  status?: DemoQuestion["status"];
}) =>
  questionStore
    .filter((question) => (filters?.groupSlug ? question.groupSlug === filters.groupSlug : true))
    .filter((question) => (filters?.status ? question.status === filters.status : true))
    .map(cloneQuestion);

export const createMockQuestion = (input: CreateMockQuestionInput): DemoQuestion => {
  const createdQuestion: DemoQuestion = {
    id: `question-local-${questionStore.length + 1}`,
    authorName: input.authorName.trim(),
    groupSlug: input.groupSlug,
    lessonId: input.lessonId.trim(),
    lessonTitle: resolveLessonTitle(input.groupSlug, input.lessonId.trim()),
    question: input.question.trim(),
    status: "new",
    createdAt: new Date().toISOString(),
    visibility: input.visibility ?? "group",
  };

  questionStore = [createdQuestion, ...questionStore];

  return cloneQuestion(createdQuestion);
};

export const getMockProgress = (filters?: {
  studentId?: string;
  groupSlug?: GroupSlug;
}): DemoProgressResponse => {
  const matchesStudent = !filters?.studentId || filters.studentId === progress.overview.studentId;
  const items = matchesStudent
    ? progress.items
        .filter((item) => (filters?.groupSlug ? item.groupSlug === filters.groupSlug : true))
        .map(cloneProgressItem)
    : [];

  return {
    overview: { ...progress.overview },
    items,
  };
};

export const resetMockQuestions = () => {
  questionStore = createQuestionSeed();
};
