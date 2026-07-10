import {
  AGENT_REVIEW_NOTE,
  AGENT_SOURCE_NOTE,
  type AgentAnswerGroup,
  type AgentAnswerResult,
  type AgentAnswerSource,
  type AgentDraft,
  type AnswerRequest,
  type LessonPlanRequest,
  type ReflectionQuestionsRequest,
  type SummarizeRequest,
} from "./types";
import {
  assessAnswerSafety,
  buildAnswerKeywords,
  buildShortExcerpt,
  buildSentenceList,
  formatList,
} from "./safety";

interface GroupContext {
  groupName: string;
  bookTitle: string;
}

interface AnswerFallbackOptions {
  contextText?: string;
  sources?: AgentAnswerSource[];
  extraSafetyNotes?: string[];
  group: AgentAnswerGroup;
  keywords?: string[];
}

const dedupeNotes = (notes: string[]): string[] => {
  return [...new Set(notes.map((note) => note.trim()).filter(Boolean))];
};

const buildFallbackMeta = (reason: string) => {
  return {
    provider: "fallback" as const,
    usedFallback: true,
    reviewNote: AGENT_REVIEW_NOTE,
    sourceNote: AGENT_SOURCE_NOTE,
    fallbackReason: reason,
  };
};

export const buildLessonPlanFallback = (
  input: LessonPlanRequest,
  group: GroupContext,
  reason: string,
): AgentDraft => {
  const steps = [
    `Objetivo da aula: acolher o grupo ${group.groupName} e estudar o tema "${input.theme}" com clareza e simplicidade.`,
    "Abertura: recepcionar os participantes, apresentar o foco da noite e combinar uma escuta respeitosa.",
    `Desenvolvimento: retomar uma leitura curta de ${group.bookTitle} e destacar a ideia principal da semana.`,
    "Desenvolvimento: abrir espaco para duas ou tres participacoes breves, com perguntas honestas e sem pressa.",
    `Encerramento: resumir o que mais ajudou o grupo e combinar um proximo passo simples para a semana${input.teacherNote ? `, lembrando a observacao do professor: ${input.teacherNote}.` : "."}`,
  ];

  return {
    kind: "lesson-plan",
    title: `Roteiro inicial para ${group.groupName}`,
    content: formatList(steps),
    ...buildFallbackMeta(reason),
  };
};

export const buildReflectionQuestionsFallback = (
  input: ReflectionQuestionsRequest,
  group: GroupContext,
  reason: string,
): AgentDraft => {
  const desiredCount = Math.min(Math.max(input.questionCount ?? 5, 3), 7);
  const baseQuestions = [
    `Qual ponto de "${input.theme}" mais conversa com a realidade do grupo ${group.groupName}?`,
    "Que atitude simples cada participante pode praticar durante a semana?",
    `Que duvida sincera vale levar para a proxima leitura de ${group.bookTitle}?`,
    "Como podemos conversar sobre este tema com mais calma e respeito?",
    "Que aprendizado merece ser retomado no encerramento da aula?",
    "Que exemplo simples ajuda a tornar este tema mais concreto?",
    "Como o grupo pode acolher opinioes diferentes sem perder a serenidade?",
  ].slice(0, desiredCount);

  return {
    kind: "reflection-questions",
    title: `Perguntas sugeridas para ${group.groupName}`,
    content: formatList(baseQuestions),
    items: baseQuestions,
    ...buildFallbackMeta(reason),
  };
};

export const buildSummarizeFallback = (
  input: SummarizeRequest,
  group: GroupContext,
  reason: string,
): AgentDraft => {
  const excerpt = buildShortExcerpt(input.sourceText, 320);
  const highlights = buildSentenceList(input.sourceText, 3);
  const contentLines = [
    `Resumo inicial: ${excerpt}`,
    "Pontos de apoio:",
    ...((highlights.length > 0 ? highlights : ["O texto pede leitura calma e confirmacao do professor."]).map(
      (item) => `- ${item}`,
    )),
    "Lembrete: este resumo e preliminar e precisa de revisao humana antes de circular no grupo.",
  ];

  return {
    kind: "summarize",
    title: `Resumo inicial para ${group.groupName}`,
    content: contentLines.join("\n"),
    ...buildFallbackMeta(reason),
  };
};

export const buildAnswerFallback = (
  input: AnswerRequest,
  group: GroupContext,
  reason: string,
  options: AnswerFallbackOptions,
): AgentAnswerResult => {
  const fallbackContext = options.contextText ?? input.context;
  const highlights = fallbackContext ? buildSentenceList(fallbackContext, 2) : [];
  const highlightsText = highlights
    .join(" ")
    .replace(/^Contexto informado na pergunta:\s*/u, "")
    .replace(/^Fonte \d+ - /u, "")
    .trim();
  const answerBody =
    highlightsText.length > 0
      ? `Resposta inicial: o material demonstrativo reunido para ${group.groupName} sugere este caminho: ${highlightsText}`
      : fallbackContext && fallbackContext.trim().length > 0
        ? `Resposta inicial: com base no contexto enviado, vale retomar com calma este ponto: ${buildShortExcerpt(fallbackContext, 220)}`
        : `Resposta inicial: ainda nao ha contexto suficiente para responder com seguranca sobre o grupo ${group.groupName}.`;
  const answer = `${answerBody}\n\nOrientacao: use esta resposta apenas como apoio inicial e confirme o entendimento com o professor antes de compartilhar como conclusao final.`;
  const keywords =
    options.keywords ??
    buildAnswerKeywords(input.question, input.theme ?? "", []);
  const safetyAssessment = assessAnswerSafety({
    question: input.question,
    answer,
    hasEnoughContext: Boolean(highlightsText || fallbackContext),
    groupLabel: options.group.name,
  });

  return {
    answer,
    group: options.group,
    sources: options.sources ?? [],
    keywords,
    needsTeacherReview: true,
    safetyNotes: dedupeNotes([
      ...(options.extraSafetyNotes ?? []),
      `Modo de contingencia ativo: ${reason}`,
      ...safetyAssessment.safetyNotes,
      AGENT_REVIEW_NOTE,
      AGENT_SOURCE_NOTE,
    ]),
    suggestedTeacherFollowUp: safetyAssessment.suggestedTeacherFollowUp,
    provider: "fallback",
    usedFallback: true,
    fallbackReason: reason,
  };
};

export const buildInsufficientContextAnswer = (
  group: AgentAnswerGroup,
  options: {
    question: string;
    theme?: string;
    sources?: AgentAnswerSource[];
    keywords?: string[];
    extraSafetyNotes?: string[];
  },
): AgentAnswerResult => {
  const answer = `Ainda nao encontrei contexto demonstrativo suficiente para responder com seguranca sobre ${group.name}. O melhor caminho e levar esta duvida ao professor, junto com o resumo e os materiais da semana.`;
  const keywords =
    options.keywords ??
    buildAnswerKeywords(options.question, options.theme ?? "", []);
  const safetyAssessment = assessAnswerSafety({
    question: options.question,
    answer,
    hasEnoughContext: false,
    groupLabel: group.name,
  });

  return {
    answer,
    group,
    sources: options.sources ?? [],
    keywords,
    needsTeacherReview: true,
    safetyNotes: dedupeNotes([
      ...safetyAssessment.safetyNotes,
      ...(options.extraSafetyNotes ?? []),
      AGENT_REVIEW_NOTE,
      AGENT_SOURCE_NOTE,
    ]),
    suggestedTeacherFollowUp: safetyAssessment.suggestedTeacherFollowUp,
    provider: "local",
    usedFallback: false,
  };
};
