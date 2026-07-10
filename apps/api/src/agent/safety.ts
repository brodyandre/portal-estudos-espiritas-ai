import type { RetrievedChunk } from "../rag/types";

interface SanitizedTextOptions {
  maxLength: number;
}

const RISKY_QUOTE_PATTERN =
  /(^|\n)\s*>|["“”][^"“”]{35,}["“”]|['‘’][^'‘’]{35,}['‘’]/u;
const OVERCONFIDENT_PATTERN =
  /\b(com certeza absoluta|sem nenhuma duvida|resposta definitiva|palavra final|sem erro)\b/iu;
const KEYWORD_STOPWORDS = new Set([
  "como",
  "para",
  "com",
  "uma",
  "umas",
  "uns",
  "que",
  "isso",
  "essa",
  "esse",
  "meus",
  "minhas",
  "sobre",
  "mesmo",
  "entre",
  "pelos",
  "pelas",
  "depois",
  "antes",
  "grupo",
  "livro",
  "aula",
  "aulas",
  "tema",
  "temas",
  "aluno",
  "professor",
]);

interface SensitiveRule {
  topic: string;
  patterns: RegExp[];
  note: string;
}

export interface AnswerSafetyAssessment {
  sensitiveTopics: string[];
  safetyNotes: string[];
  needsTeacherReview: boolean;
  suggestedTeacherFollowUp: string;
}

const SENSITIVE_RULES: SensitiveRule[] = [
  {
    topic: "sofrimento intenso",
    patterns: [/luto/iu, /desanimad/iu, /culpa excessiva/iu, /sofrimento intenso/iu, /crise emocional/iu],
    note:
      "A pergunta toca sofrimento ou desanimo persistente. Vale acolher com cuidado e revisar com o professor.",
  },
  {
    topic: "mediunidade pessoal",
    patterns: [/mediunidade pessoal/iu, /minha mediunidade/iu, /sinto mediunidade/iu, /vejo espiritos/iu],
    note:
      "A pergunta toca mediunidade pessoal. Evite conclusoes fechadas e leve o tema ao professor.",
  },
  {
    topic: "conflito familiar",
    patterns: [/conflito familiar/iu, /familia/iu, /casa/iu, /meu marido/iu, /minha esposa/iu, /meus pais/iu, /meus filhos/iu],
    note:
      "A pergunta toca convivio familiar delicado. O melhor e revisar com o professor antes de orientar como conclusao.",
  },
  {
    topic: "Capela",
    patterns: [/capela/iu],
    note:
      "Capela pede leitura historica e espiritual prudente, sem transformar o tema em certeza fechada.",
  },
  {
    topic: "racas adamicas",
    patterns: [/racas adamicas/iu, /ra[cç]as ad[aâ]micas/iu],
    note:
      "Racas adamicas exigem prudencia redobrada e revisao do professor para evitar leituras ofensivas ou deterministas.",
  },
  {
    topic: "criticas religiosas",
    patterns: [/cr[ií]tica religiosa/iu, /criticar religi/iu, /ataque a religi/iu],
    note:
      "Comparacoes e criticas religiosas pedem linguagem respeitosa e revisao do professor.",
  },
  {
    topic: "futuro da humanidade",
    patterns: [/futuro da humanidade/iu, /fim do mundo/iu, /destino da humanidade/iu],
    note:
      "Temas sobre futuro da humanidade pedem prudencia, sem previsoes tratadas como certeza fechada.",
  },
];

const normalizeForKeywords = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
};

const uniqueStrings = (values: string[]): string[] => {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

export const normalizeInputText = (value: string): string => {
  return value.replace(/\r\n/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();
};

export const tokenizeKeywords = (value: string): string[] => {
  return uniqueStrings(
    normalizeForKeywords(value)
      .split(" ")
      .map((term) => term.trim())
      .filter((term) => term.length >= 4 && !KEYWORD_STOPWORDS.has(term)),
  );
};

export const buildAnswerKeywords = (
  question: string,
  theme: string,
  chunks: RetrievedChunk[] = [],
  limit = 6,
): string[] => {
  const questionKeywords = tokenizeKeywords([question, theme].filter(Boolean).join(" "));
  const chunkKeywords = uniqueStrings(
    chunks.flatMap((chunk) => [
      ...chunk.tags,
      ...chunk.sensitiveTopics,
      ...tokenizeKeywords(chunk.title),
    ]),
  );
  const matchedChunkKeywords = chunkKeywords.filter((keyword) => {
    const normalizedKeyword = normalizeForKeywords(keyword);

    return questionKeywords.some(
      (term) => normalizedKeyword.includes(term) || term.includes(normalizedKeyword),
    );
  });

  return uniqueStrings([
    ...matchedChunkKeywords,
    ...questionKeywords,
    ...chunkKeywords.slice(0, limit),
  ]).slice(0, limit);
};

export const detectSensitiveTopics = (
  question: string,
  chunks: RetrievedChunk[] = [],
): string[] => {
  const combinedText = normalizeInputText(question);
  const chunkTopics = chunks.flatMap((chunk) => chunk.sensitiveTopics);
  const matchedRuleTopics = SENSITIVE_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(combinedText)),
  ).map((rule) => rule.topic);

  return uniqueStrings([...chunkTopics, ...matchedRuleTopics]);
};

export const buildSuggestedTeacherFollowUp = (options: {
  question: string;
  groupLabel: string;
  hasEnoughContext: boolean;
  sensitiveTopics: string[];
}): string => {
  const normalizedQuestion = normalizeForKeywords(options.question);
  const normalizedTopics = options.sensitiveTopics.map((topic) => normalizeForKeywords(topic));
  const personalSensitiveTopics = [
    "sofrimento intenso",
    "mediunidade pessoal",
    "conflito familiar",
  ];
  const doctrinalSensitiveTopics = [
    "capela",
    "racas adamicas",
    "criticas religiosas",
    "futuro da humanidade",
  ];

  if (
    personalSensitiveTopics.some((topic) => normalizedTopics.includes(normalizeForKeywords(topic)))
  ) {
    return `Leve essa duvida ao professor do grupo ${options.groupLabel} com calma, contando o contexto de forma simples para revisar junto.`;
  }

  if (
    doctrinalSensitiveTopics.some((topic) => normalizedTopics.includes(normalizeForKeywords(topic)))
  ) {
    return `Vale pedir ao professor do grupo ${options.groupLabel} uma revisao cuidadosa desse tema antes de tirar conclusoes mais amplas.`;
  }

  if (
    /prece/iu.test(normalizedQuestion) ||
    /problema/iu.test(normalizedQuestion)
  ) {
    return `Se quiser aprofundar, leve ao professor como essa pergunta aparece na sua vivencia para revisar com serenidade.`;
  }

  if (!options.hasEnoughContext) {
    return `Leve ao professor do grupo ${options.groupLabel} a pergunta e o ponto que mais chamou sua atencao para revisar junto com a turma.`;
  }

  return `Se quiser aprofundar, vale levar esta pergunta ao professor do grupo ${options.groupLabel} com o trecho ou tema que mais chamou sua atencao.`;
};

export const assessAnswerSafety = (options: {
  question: string;
  answer: string;
  chunks?: RetrievedChunk[];
  hasEnoughContext: boolean;
  groupLabel: string;
}): AnswerSafetyAssessment => {
  const chunks = options.chunks ?? [];
  const sensitiveTopics = detectSensitiveTopics(options.question, chunks);
  const chunkTopicNotes = SENSITIVE_RULES.filter((rule) =>
    sensitiveTopics.some(
      (topic) => normalizeForKeywords(topic) === normalizeForKeywords(rule.topic),
    ),
  ).map((rule) => rule.note);
  const safetyNotes = uniqueStrings([
    ...chunkTopicNotes,
    ...(options.hasEnoughContext
      ? []
      : ["O contexto reunido ainda esta curto para uma resposta mais segura."]),
    ...(OVERCONFIDENT_PATTERN.test(options.answer)
      ? ["Evite ler esta resposta como palavra final. Revise o entendimento com o professor."]
      : []),
  ]);

  return {
    sensitiveTopics,
    safetyNotes,
    needsTeacherReview: true,
    suggestedTeacherFollowUp: buildSuggestedTeacherFollowUp({
      question: options.question,
      groupLabel: options.groupLabel,
      hasEnoughContext: options.hasEnoughContext,
      sensitiveTopics,
    }),
  };
};

export const sanitizeGeneratedText = (
  value: string,
  options: SanitizedTextOptions,
): { ok: true; text: string } | { ok: false; reason: string } => {
  const cleaned = normalizeInputText(
    value
      .replace(/```[\s\S]*?```/gu, "")
      .replace(/\b(com certeza absoluta|sem nenhuma duvida)\b/giu, "com cuidado")
      .replace(/\b(resposta definitiva|palavra final)\b/giu, "resposta inicial"),
  );

  if (!cleaned) {
    return {
      ok: false,
      reason: "O modelo nao retornou texto suficiente para montar um rascunho seguro.",
    };
  }

  if (cleaned.length > options.maxLength) {
    return {
      ok: false,
      reason: "O texto ficou longo demais para revisao simples e segura.",
    };
  }

  if (RISKY_QUOTE_PATTERN.test(cleaned)) {
    return {
      ok: false,
      reason: "O texto retornou trechos que parecem citacoes literais.",
    };
  }

  if (OVERCONFIDENT_PATTERN.test(cleaned)) {
    return {
      ok: false,
      reason: "O texto retornou um tom de autoridade forte demais para esta etapa.",
    };
  }

  return { ok: true, text: cleaned };
};

export const extractListItems = (value: string): string[] => {
  return normalizeInputText(value)
    .split("\n")
    .map((line) => line.replace(/^[-*•\d.)\s]+/u, "").trim())
    .filter((line) => line.length > 0);
};

export const formatList = (items: string[]): string => {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
};

export const buildShortExcerpt = (value: string, maxLength = 260): string => {
  const cleaned = normalizeInputText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, maxLength);
  const lastDot = truncated.lastIndexOf(".");

  if (lastDot > maxLength * 0.55) {
    return truncated.slice(0, lastDot + 1).trim();
  }

  return `${truncated.trim()}...`;
};

export const buildSentenceList = (value: string, maxItems = 3): string[] => {
  return normalizeInputText(value)
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, maxItems);
};
