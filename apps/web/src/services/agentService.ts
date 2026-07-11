import type { DemoGroup, DemoMaterial, DemoSummary } from "../mocks";
import type { KnowledgeSupportFile } from "./knowledgeService";
import type { ServiceResult } from "./api";
import { loadWithFallback } from "./api";

type AgentProvider = "ollama" | "fallback" | "local";
type TeacherDraftKind = "lesson-plan" | "reflection-questions" | "summarize";

interface ApiAssistantSource {
  source: string;
  title: string;
  score: number;
  group?: string;
}

interface ApiAssistantGroup {
  id: string;
  name: string;
  bookTitle: string;
  matchMode: string;
}

interface ApiAssistantAnswer {
  answer: string;
  group?: ApiAssistantGroup;
  sources: ApiAssistantSource[];
  keywords?: string[];
  needsTeacherReview: boolean;
  safetyNotes: string[];
  suggestedTeacherFollowUp?: string;
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
  warnings: string[];
  keywords: string[];
  teacherFollowUp: string | null;
  groupLabel: string | null;
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
  supportFiles?: KnowledgeSupportFile[];
}

export interface TeacherAssistInput {
  group: DemoGroup;
  materials: DemoMaterial[];
  summary?: DemoSummary | null;
  supportFiles?: KnowledgeSupportFile[];
  theme: string;
  bookTitle: string;
  meetLink: string;
}

const SUPPORT_NOTICE = "Resposta baseada nos materiais cadastrados.";
const LOCAL_AGENT_FALLBACK_MESSAGE =
  "Esta é uma resposta demonstrativa baseada nos materiais locais. Para resposta completa, use o backend do agente.";
const KNOWLEDGE_STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "como",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "me",
  "meu",
  "minha",
  "na",
  "no",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "pra",
  "qual",
  "que",
  "se",
  "sem",
  "ser",
  "um",
  "uma",
]);

const questionKeywordExpansions: Array<{ match: RegExp; extraTerms: string[] }> = [
  { match: /desanim|cansad|desanimo/iu, extraTerms: ["constancia", "perseveranca", "estudo sereno"] },
  { match: /esforco proprio|disciplina|regularidade/iu, extraTerms: ["constancia", "aplicacao pratica", "regularidade"] },
  { match: /evangelho|pratica|cotidiano|dia a dia/iu, extraTerms: ["evangelho", "aplicacao pratica", "vida diaria"] },
  { match: /mediunidade/iu, extraTerms: ["mediunidade", "duvidas frequentes"] },
  { match: /historico|espiritual|historia/iu, extraTerms: ["historia espiritual", "visao geral"] },
  { match: /capela/iu, extraTerms: ["capela", "civilizacoes antigas"] },
  { match: /racas adamicas|racas adamic|prudencia/iu, extraTerms: ["racas adamicas", "prudencia", "civilizacoes antigas"] },
  { match: /futuro|humanidade/iu, extraTerms: ["futuro", "evangelho", "humanidade"] },
];

const dedupeStrings = (items: string[]) => {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
};

const normalizeQuestion = (value: string) => value.trim().toLowerCase();

const normalizeText = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
};

const extractKnowledgeTerms = (question: string) => {
  const normalizedQuestion = normalizeText(question);
  const baseTerms = normalizedQuestion
    .replace(/[^a-z0-9\s]/gu, " ")
    .split(/\s+/u)
    .filter((term) => term.length >= 3 && !KNOWLEDGE_STOPWORDS.has(term));
  const expandedTerms = questionKeywordExpansions
    .filter((entry) => entry.match.test(normalizedQuestion))
    .flatMap((entry) => entry.extraTerms)
    .map(normalizeText);

  return dedupeStrings([...baseTerms, ...expandedTerms]);
};

const countOccurrences = (text: string, term: string) => {
  if (!term) {
    return 0;
  }

  return text.split(term).length - 1;
};

const findKnowledgeMatches = (question: string, supportFiles: KnowledgeSupportFile[]) => {
  const terms = extractKnowledgeTerms(question);

  return supportFiles
    .map((file) => {
      const titleText = normalizeText(file.title);
      const tagText = normalizeText(file.tags.join(" "));
      const summaryText = normalizeText(file.summary);
      const topicText = normalizeText(file.sensitiveTopics.join(" "));

      let score = 0;

      for (const term of terms) {
        score += countOccurrences(titleText, term) * 5;
        score += countOccurrences(tagText, term) * 4;
        score += countOccurrences(summaryText, term) * 2;
        score += countOccurrences(topicText, term) * 3;
      }

      if (file.teacherReviewRecommended) {
        score += terms.some((term) => topicText.includes(term)) ? 2 : 0;
      }

      return { file, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.file);
};

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

const buildSupportContextLines = (supportFiles: KnowledgeSupportFile[] = []) => {
  return supportFiles
    .slice(0, 5)
    .map((file) => {
      const sensitiveTopics =
        file.sensitiveTopics.length > 0
          ? ` Temas sensiveis: ${file.sensitiveTopics.join(", ")}.`
          : "";

      return `- ${file.title} (${file.typeLabel}): ${file.summary}.${sensitiveTopics}`;
    })
    .join("\n");
};

const buildCommonTeacherContext = ({
  group,
  materials,
  summary,
  supportFiles,
  theme,
  bookTitle,
  meetLink,
}: TeacherAssistInput) => {
  const materialLines = materials
    .slice(0, 4)
    .map((material) => `- ${material.title}: ${material.description}`)
    .join("\n");
  const supportLines = buildSupportContextLines(supportFiles);
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
    supportLines ? `Base de apoio da aula:\n${supportLines}` : "",
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
  const supportText = (input.supportFiles ?? [])
    .slice(0, 5)
    .map((file) => `${file.title}: ${file.summary}`)
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
    supportText,
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
    warnings: dedupeStrings(payload.safetyNotes ?? []),
    keywords: dedupeStrings(payload.keywords ?? []),
    teacherFollowUp: payload.suggestedTeacherFollowUp?.trim() || null,
    groupLabel: payload.group?.name ?? null,
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
  supportFiles = [],
}: AskStudyAssistantInput): AssistantReply => {
  const normalized = normalizeQuestion(question);
  const readingMaterial = materials.find((material) => material.kind === "Leitura");
  const sourceLabels = buildSourceLabels({ group, materials, summary });
  const knowledgeMatches = findKnowledgeMatches(question, supportFiles);
  const firstKnowledgeMatch = knowledgeMatches[0] ?? null;
  const fallbackKeywords = extractKnowledgeTerms(question).slice(0, 6);

  if (firstKnowledgeMatch) {
    const caution = firstKnowledgeMatch.teacherReviewRecommended
      ? " Como esse tema pede cuidado, vale conversar com o professor antes de fechar uma conclusao."
      : "";

    return {
      answer: `${LOCAL_AGENT_FALLBACK_MESSAGE} Material local relacionado: ${firstKnowledgeMatch.title}.${caution}`,
      sources: dedupeStrings([
        ...knowledgeMatches.map((item) => item.title),
        ...sourceLabels,
      ]),
      supportNotice: SUPPORT_NOTICE,
      needsTeacherReview: firstKnowledgeMatch.teacherReviewRecommended,
      usedFallback: true,
      warnings: firstKnowledgeMatch.teacherReviewRecommended
        ? ["Tema sensivel identificado. Vale revisar com o professor."]
        : [],
      keywords: fallbackKeywords,
      teacherFollowUp: firstKnowledgeMatch.teacherReviewRecommended
        ? "Se a duvida continuar, leve este ponto ao professor no proximo encontro."
        : null,
      groupLabel: group.name,
    };
  }

  if (normalized.includes("meet") || normalized.includes("entr") || normalized.includes("aula")) {
    return {
      answer: `${LOCAL_AGENT_FALLBACK_MESSAGE} A proxima aula do grupo ${group.name} acontece em ${group.nextLesson.scheduledLabel}.`,
      sources: dedupeStrings([group.nextLesson.title, ...sourceLabels]),
      supportNotice: SUPPORT_NOTICE,
      needsTeacherReview: true,
      usedFallback: true,
      warnings: [],
      keywords: fallbackKeywords,
      teacherFollowUp: null,
      groupLabel: group.name,
    };
  }

  if (normalized.includes("leitura") || normalized.includes("material")) {
    return {
      answer: `${LOCAL_AGENT_FALLBACK_MESSAGE} Vale comecar por ${readingMaterial?.title ?? "uma leitura curta do grupo"} e depois retomar o resumo mais recente com calma.`,
      sources: dedupeStrings([readingMaterial?.title ?? "", ...sourceLabels]),
      supportNotice: SUPPORT_NOTICE,
      needsTeacherReview: true,
      usedFallback: true,
      warnings: [],
      keywords: fallbackKeywords,
      teacherFollowUp: null,
      groupLabel: group.name,
    };
  }

  if (normalized.includes("resumo") || normalized.includes("ultima")) {
    return {
      answer: `${LOCAL_AGENT_FALLBACK_MESSAGE} ${
        summary?.content ??
        "O ultimo encontro reforcou constancia, escuta respeitosa e simplicidade no estudo. Vale reler o resumo breve antes da aula."
      }`,
      sources: dedupeStrings([summary?.title ?? "", ...sourceLabels]),
      supportNotice: SUPPORT_NOTICE,
      needsTeacherReview: true,
      usedFallback: true,
      warnings: [],
      keywords: fallbackKeywords,
      teacherFollowUp: null,
      groupLabel: group.name,
    };
  }

  return {
    answer: `${LOCAL_AGENT_FALLBACK_MESSAGE} Uma boa forma de seguir e revisar o resumo mais recente, escolher uma leitura curta e registrar uma pergunta simples para levar ao encontro do grupo ${group.name}.`,
    sources: sourceLabels,
    supportNotice: SUPPORT_NOTICE,
    needsTeacherReview: true,
    usedFallback: true,
    warnings: [],
    keywords: fallbackKeywords,
    teacherFollowUp: null,
    groupLabel: group.name,
  };
};

const buildLessonPlanFallbackReply = (input: TeacherAssistInput): TeacherDraftReply => {
  const supportNote =
    input.supportFiles && input.supportFiles.length > 0
      ? `Leituras de apoio escolhidas: ${input.supportFiles
          .slice(0, 3)
          .map((file) => file.title)
          .join(", ")}.`
      : "";
  const content = [
    `Objetivo da aula: acolher o grupo ${input.group.name} e trabalhar o tema "${input.theme}" com linguagem simples e participacao respeitosa.`,
    `1. Abertura: receber os participantes, confirmar o link ${input.meetLink} e apresentar o foco principal da noite.`,
    `2. Leitura inicial: retomar ${input.bookTitle} com uma pergunta curta para orientar a escuta do grupo.`,
    "3. Conversa guiada: abrir duas ou tres participacoes breves, com tempo para escuta e duvidas honestas.",
    "4. Aplicacao pratica: convidar cada participante a separar um passo simples para a semana.",
    "5. Encerramento: resumir o que mais ajudou o grupo e lembrar o proximo encontro.",
    supportNote,
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
  const supportPrompt =
    input.supportFiles && input.supportFiles.length > 0
      ? ` ${input.supportFiles[0]?.title} pode servir como apoio para uma das perguntas.`
      : "";
  const questions = [
    `1. Qual ponto de ${input.theme.toLowerCase()} mais conversa com a realidade do grupo?`,
    "2. Que atitude simples pode ser levada para a semana com serenidade?",
    `3. Que parte de ${input.bookTitle} merece uma leitura mais atenta?`,
    "4. Como acolher opinioes diferentes sem perder o foco da aula?",
    `5. Que duvida sincera vale deixar aberta para o proximo encontro?${supportPrompt}`,
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
  const supportLine =
    input.supportFiles && input.supportFiles.length > 0
      ? `- Apoiar a mensagem final com ${input.supportFiles[0]?.title}.`
      : "";
  const content = [
    `Resumo inicial: ${summarySource}`,
    "",
    "- Retomar o tema da semana com linguagem clara e acolhedora.",
    supportLine,
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
    warnings: [],
    keywords: [],
    teacherFollowUp: null,
    groupLabel: null,
  };
};

export const askStudyAssistant = async ({
  question,
  group,
  materials,
  summary,
  supportFiles,
}: AskStudyAssistantInput) => {
  const fallbackSources = buildSourceLabels({ group, materials, summary });
  const supportContext = supportFiles
    ?.slice(0, 4)
    .map((file) => `- ${file.title}: ${file.summary}`)
    .join("\n");
  const requestContext = buildCommonTeacherContext({
    group,
    materials,
    summary,
    theme: group.nextLesson.theme,
    bookTitle: group.name,
    meetLink: group.meetUrl,
  }).concat(supportContext ? `\n\nMateriais de apoio do livro:\n${supportContext}` : "");

  return loadWithFallback<ApiAssistantAnswer, AssistantReply>({
    path: "/api/agent/answer",
    init: {
      method: "POST",
      body: JSON.stringify({
        groupId: group.slug,
        theme: group.nextLesson.theme,
        bookTitle: group.name,
        context: requestContext,
        question,
      }),
    },
    fallback: () => buildStudentFallbackReply({ question, group, materials, summary, supportFiles }),
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

export const generateGroupMessageDraft = async (
  input: TeacherAssistInput,
): Promise<ServiceResult<TeacherDraftReply>> => {
  const supportTitle = input.supportFiles?.[0]?.title;
  const content = [
    `Queridos amigos do grupo ${input.group.name},`,
    "",
    `Nesta semana vamos nos preparar para a aula sobre "${input.theme}".`,
    supportTitle
      ? `Se puderem, vale revisar o material "${supportTitle}" com calma antes do encontro.`
      : `Se puderem, vale separar alguns minutos para uma leitura breve antes do encontro.`,
    `Nos encontraremos em ${input.group.nextLesson.scheduledLabel} pelo link ${input.meetLink}.`,
    "Quem desejar pode levar uma pergunta simples para enriquecer a conversa.",
    "",
    "Mensagem inicial demonstrativa. Revise antes de publicar.",
  ].join("\n");

  return {
    data: {
      title: `Mensagem para o grupo ${input.group.name}`,
      content,
      usedFallback: true,
      reviewNote: "Revise antes de publicar.",
    },
    source: "mock",
    notice: "Mensagem inicial gerada localmente para voce revisar.",
  };
};

export const generateReviewPointsDraft = async (
  input: TeacherAssistInput,
): Promise<ServiceResult<TeacherDraftReply>> => {
  const sensitiveTopics = [...new Set((input.supportFiles ?? []).flatMap((file) => file.sensitiveTopics))];
  const content = [
    `Pontos que pedem revisao no grupo ${input.group.name}:`,
    "",
    sensitiveTopics.length > 0
      ? `- Temas sensiveis encontrados: ${sensitiveTopics.join(", ")}.`
      : "- Verificar se o tema da aula esta claro e adequado ao grupo.",
    "- Confirmar se a linguagem esta simples, respeitosa e educativa.",
    "- Evitar conclusoes fechadas em assuntos delicados.",
    "- Revisar se ha convite explicito para conversa com o professor quando necessario.",
    "- Conferir se o texto final esta pronto para os participantes.",
  ].join("\n");

  return {
    data: {
      title: `Pontos de revisao para ${input.group.name}`,
      content,
      usedFallback: true,
      reviewNote: "O professor deve revisar antes de publicar.",
    },
    source: "mock",
    notice: "Lista de revisao gerada localmente para apoiar sua conferencia.",
  };
};
