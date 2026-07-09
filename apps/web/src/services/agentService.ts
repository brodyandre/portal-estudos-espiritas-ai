import type { DemoGroup, DemoMaterial, DemoSummary } from "../mocks";
import { loadWithFallback } from "./api";

type AgentProvider = "ollama" | "fallback" | "local";
type TeacherDraftKind = "lesson-plan" | "reflection-questions" | "summarize";

interface ApiAssistantSource {
  source: string;
  title: string;
  score: number;
}

interface ApiAssistantAnswer {
  answer: string;
  sources: ApiAssistantSource[];
  needsTeacherReview: boolean;
  safetyNotes: string[];
  provider: AgentProvider;
  usedFallback: boolean;
  fallbackReason?: string;
}

interface ApiTeacherDraft {
  kind: TeacherDraftKind;
  title: string;
  content: string;
  items?: string[];
  provider: AgentProvider;
  usedFallback: boolean;
  reviewNote: string;
  sourceNote: string;
  fallbackReason?: string;
}

export interface AssistantReply {
  answer: string;
  sources: string[];
  supportNotice: string;
  needsTeacherReview: boolean;
  usedFallback: boolean;
}

export interface TeacherDraftReply {
  title: string;
  content: string;
  usedFallback: boolean;
  reviewNote: string;
}

interface AskStudyAssistantInput {
  question: string;
  group: DemoGroup;
  materials: DemoMaterial[];
  summary?: DemoSummary | null;
}

export interface TeacherAssistInput {
  group: DemoGroup;
  materials: DemoMaterial[];
  summary?: DemoSummary | null;
  theme: string;
  bookTitle: string;
  meetLink: string;
}

const SUPPORT_NOTICE = "Resposta baseada nos materiais cadastrados.";

const dedupeStrings = (items: string[]) => {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
};

const normalizeQuestion = (value: string) => value.trim().toLowerCase();

const buildSourceLabels = (options: {
  group: DemoGroup;
  materials: DemoMaterial[];
  summary?: DemoSummary | null;
}) => {
  return dedupeStrings([
    options.summary?.title ?? "",
    ...options.materials.slice(0, 3).map((material) => material.title),
    options.group.bookTitle,
  ]);
};

const mapAssistantSourceLabel = (source: ApiAssistantSource) => {
  if (source.title === "Contexto informado na pergunta") {
    return "Contexto da sua pergunta";
  }

  return source.title;
};

const buildCommonTeacherContext = ({
  group,
  materials,
  summary,
  theme,
  bookTitle,
  meetLink,
}: TeacherAssistInput) => {
  const materialLines = materials
    .slice(0, 4)
    .map((material) => `- ${material.title}: ${material.description}`)
    .join("\n");
  const summaryLines = summary
    ? [`Resumo mais recente: ${summary.title}.`, summary.content, ...summary.takeaways]
    : [];

  return [
    `Grupo: ${group.name}.`,
    `Tema: ${theme}.`,
    `Livro ou estudo base: ${bookTitle}.`,
    `Meet da aula: ${meetLink}.`,
    `Proxima aula: ${group.nextLesson.title}.`,
    `Observacao do professor: ${group.nextLesson.teacherNote}.`,
    materialLines ? `Materiais da semana:\n${materialLines}` : "",
    summaryLines.length > 0 ? `Resumo e pontos de apoio:\n${summaryLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const buildSummarySourceText = (input: TeacherAssistInput) => {
  const materialsText = input.materials
    .slice(0, 4)
    .map((material) => `${material.title}: ${material.description}`)
    .join(" ");
  const summaryText = input.summary
    ? `${input.summary.title}. ${input.summary.content} ${input.summary.takeaways.join(" ")}`
    : "";

  return [
    `Grupo ${input.group.name}.`,
    `Tema da semana: ${input.theme}.`,
    `Livro ou estudo base: ${input.bookTitle}.`,
    `Link da aula: ${input.meetLink}.`,
    input.group.nextLesson.theme,
    input.group.nextLesson.teacherNote,
    materialsText,
    summaryText,
  ]
    .filter(Boolean)
    .join(" ");
};

const mapAssistantReply = (
  payload: ApiAssistantAnswer,
  fallbackSources: string[],
): AssistantReply => {
  const sources = dedupeStrings(payload.sources.map(mapAssistantSourceLabel));

  return {
    answer: payload.answer,
    sources: sources.length > 0 ? sources : fallbackSources,
    supportNotice: SUPPORT_NOTICE,
    needsTeacherReview: payload.needsTeacherReview,
    usedFallback: payload.usedFallback,
  };
};

const mapTeacherDraftReply = (payload: ApiTeacherDraft): TeacherDraftReply => {
  return {
    title: payload.title,
    content: payload.content,
    usedFallback: payload.usedFallback,
    reviewNote: payload.reviewNote,
  };
};

const buildStudentFallbackReply = ({
  question,
  group,
  materials,
  summary,
}: AskStudyAssistantInput): AssistantReply => {
  const normalized = normalizeQuestion(question);
  const readingMaterial = materials.find((material) => material.kind === "Leitura");
  const sourceLabels = buildSourceLabels({ group, materials, summary });

  if (normalized.includes("meet") || normalized.includes("entr") || normalized.includes("aula")) {
    return {
      answer: `A proxima aula do grupo ${group.name} acontece em ${group.nextLesson.scheduledLabel}. Quando estiver perto do horario, use o botao Entrar no Google Meet no card da proxima aula.`,
      sources: dedupeStrings([group.nextLesson.title, ...sourceLabels]),
      supportNotice: SUPPORT_NOTICE,
      needsTeacherReview: true,
      usedFallback: true,
    };
  }

  if (normalized.includes("leitura") || normalized.includes("material")) {
    return {
      answer: `Para hoje, vale comecar por ${readingMaterial?.title ?? "uma leitura curta do grupo"} e depois retomar o resumo mais recente com calma.`,
      sources: dedupeStrings([readingMaterial?.title ?? "", ...sourceLabels]),
      supportNotice: SUPPORT_NOTICE,
      needsTeacherReview: true,
      usedFallback: true,
    };
  }

  if (normalized.includes("resumo") || normalized.includes("ultima")) {
    return {
      answer:
        summary?.content ??
        "O ultimo encontro reforcou constancia, escuta respeitosa e simplicidade no estudo. Vale reler o resumo breve antes da aula.",
      sources: dedupeStrings([summary?.title ?? "", ...sourceLabels]),
      supportNotice: SUPPORT_NOTICE,
      needsTeacherReview: true,
      usedFallback: true,
    };
  }

  return {
    answer: `Uma boa forma de seguir e revisar o resumo mais recente, escolher uma leitura curta e registrar uma pergunta simples para levar ao encontro do grupo ${group.name}.`,
    sources: sourceLabels,
    supportNotice: SUPPORT_NOTICE,
    needsTeacherReview: true,
    usedFallback: true,
  };
};

const buildLessonPlanFallbackReply = (input: TeacherAssistInput): TeacherDraftReply => {
  const content = [
    `Objetivo da aula: acolher o grupo ${input.group.name} e trabalhar o tema "${input.theme}" com linguagem simples e participacao respeitosa.`,
    `1. Abertura: receber os participantes, confirmar o link ${input.meetLink} e apresentar o foco principal da noite.`,
    `2. Leitura inicial: retomar ${input.bookTitle} com uma pergunta curta para orientar a escuta do grupo.`,
    "3. Conversa guiada: abrir duas ou tres participacoes breves, com tempo para escuta e duvidas honestas.",
    "4. Aplicacao pratica: convidar cada participante a separar um passo simples para a semana.",
    "5. Encerramento: resumir o que mais ajudou o grupo e lembrar o proximo encontro.",
    "Lembrete final: revise o texto antes de publicar.",
  ].join("\n");

  return {
    title: `Roteiro inicial para ${input.group.name}`,
    content,
    usedFallback: true,
    reviewNote: "Revise antes de publicar.",
  };
};

const buildReflectionQuestionsFallbackReply = (
  input: TeacherAssistInput,
): TeacherDraftReply => {
  const questions = [
    `1. Qual ponto de ${input.theme.toLowerCase()} mais conversa com a realidade do grupo?`,
    "2. Que atitude simples pode ser levada para a semana com serenidade?",
    `3. Que parte de ${input.bookTitle} merece uma leitura mais atenta?`,
    "4. Como acolher opinioes diferentes sem perder o foco da aula?",
    "5. Que duvida sincera vale deixar aberta para o proximo encontro?",
  ].join("\n");

  return {
    title: `Perguntas sugeridas para ${input.group.name}`,
    content: questions,
    usedFallback: true,
    reviewNote: "Revise antes de publicar.",
  };
};

const buildSummaryFallbackReply = (input: TeacherAssistInput): TeacherDraftReply => {
  const summarySource = input.summary?.content ?? input.group.nextLesson.theme;
  const content = [
    `Resumo inicial: ${summarySource}`,
    "",
    "- Retomar o tema da semana com linguagem clara e acolhedora.",
    "- Fechar a aula com uma sintese curta e um proximo passo simples.",
    "- Confirmar o texto final antes de compartilhar com os alunos.",
  ].join("\n");

  return {
    title: `Resumo inicial para ${input.group.name}`,
    content,
    usedFallback: true,
    reviewNote: "Revise antes de publicar.",
  };
};

export const getInitialAssistantReply = (): AssistantReply => {
  return {
    answer:
      "Posso ajudar a revisar a proxima aula, retomar um resumo ou sugerir uma leitura curta para hoje.",
    sources: ["Painel demonstrativo do aluno"],
    supportNotice: SUPPORT_NOTICE,
    needsTeacherReview: true,
    usedFallback: false,
  };
};

export const askStudyAssistant = async ({
  question,
  group,
  materials,
  summary,
}: AskStudyAssistantInput) => {
  const fallbackSources = buildSourceLabels({ group, materials, summary });

  return loadWithFallback<ApiAssistantAnswer, AssistantReply>({
    path: "/api/agent/answer",
    init: {
      method: "POST",
      body: JSON.stringify({
        groupId: group.slug,
        theme: group.nextLesson.theme,
        bookTitle: group.bookTitle,
        context: buildCommonTeacherContext({
          group,
          materials,
          summary,
          theme: group.nextLesson.theme,
          bookTitle: group.bookTitle,
          meetLink: group.meetUrl,
        }),
        question,
      }),
    },
    fallback: () => buildStudentFallbackReply({ question, group, materials, summary }),
    mapData: (payload) => mapAssistantReply(payload, fallbackSources),
    friendlyMessage:
      "Nao foi possivel consultar os materiais pelo servidor agora. Seguimos com uma resposta demonstrativa para voce continuar o estudo.",
  });
};

export const generateLessonPlanDraft = async (input: TeacherAssistInput) => {
  return loadWithFallback<ApiTeacherDraft, TeacherDraftReply>({
    path: "/api/agent/lesson-plan",
    init: {
      method: "POST",
      body: JSON.stringify({
        groupId: input.group.slug,
        theme: input.theme,
        bookTitle: input.bookTitle,
        teacherNote: `Link do Google Meet: ${input.meetLink}. ${input.group.nextLesson.teacherNote}`,
        context: buildCommonTeacherContext(input),
        durationMinutes: 60,
      }),
    },
    fallback: () => buildLessonPlanFallbackReply(input),
    mapData: mapTeacherDraftReply,
    friendlyMessage:
      "Nao foi possivel preparar o roteiro pelo servidor agora. Criamos uma versao demonstrativa para voce revisar.",
  });
};

export const generateReflectionQuestionsDraft = async (input: TeacherAssistInput) => {
  return loadWithFallback<ApiTeacherDraft, TeacherDraftReply>({
    path: "/api/agent/reflection-questions",
    init: {
      method: "POST",
      body: JSON.stringify({
        groupId: input.group.slug,
        theme: input.theme,
        bookTitle: input.bookTitle,
        context: buildCommonTeacherContext(input),
        questionCount: 5,
      }),
    },
    fallback: () => buildReflectionQuestionsFallbackReply(input),
    mapData: mapTeacherDraftReply,
    friendlyMessage:
      "Nao foi possivel criar as perguntas pelo servidor agora. Montamos uma versao demonstrativa para a sua revisao.",
  });
};

export const generateSummaryDraft = async (input: TeacherAssistInput) => {
  return loadWithFallback<ApiTeacherDraft, TeacherDraftReply>({
    path: "/api/agent/summarize",
    init: {
      method: "POST",
      body: JSON.stringify({
        groupId: input.group.slug,
        theme: input.theme,
        bookTitle: input.bookTitle,
        sourceText: buildSummarySourceText(input),
      }),
    },
    fallback: () => buildSummaryFallbackReply(input),
    mapData: mapTeacherDraftReply,
    friendlyMessage:
      "Nao foi possivel preparar o resumo pelo servidor agora. Criamos uma versao demonstrativa para voce revisar.",
  });
};
