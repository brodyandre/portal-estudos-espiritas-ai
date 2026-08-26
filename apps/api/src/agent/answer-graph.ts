import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { env } from "../config/env";
import type { StudyGroup } from "../data/studies";
import { studyGroups } from "../data/studies";
import type { RetrievedChunk } from "../rag/types";
import {
  getGovernedRetrieverContext,
  type GovernedRetrieverContext,
} from "../rag/governedRetriever";
import {
  GovernedRetrieverError,
  isGovernedRetrievalOperationalError,
} from "../rag/governedRetrievalErrors";
import {
  AGENT_REVIEW_NOTE,
  AGENT_SOURCE_NOTE,
  type AgentAnswerResult,
  type AgentAnswerGroup,
  type AgentAnswerSource,
  type AgentGroupMatchMode,
  type AgentBookAccessContext,
  type AgentProvider,
  type AnswerRequest,
} from "./types";
import { buildAnswerPrompt } from "./prompts";
import { buildAnswerFallback, buildInsufficientContextAnswer } from "./fallbacks";
import { generateWithConfiguredLlm } from "./llm";
import {
  assessAnswerSafety,
  buildAnswerKeywords,
  buildShortExcerpt,
  normalizeInputText,
  sanitizeGeneratedText,
} from "./safety";

const ANSWER_GRAPH_TIMEOUT_MS = env.nodeEnv === "test" ? 1500 : 12000;

const AnswerGraphState = Annotation.Root({
  request: Annotation<AnswerRequest>(),
  access: Annotation<AgentBookAccessContext>(),
  group: Annotation<AgentAnswerGroup>(),
  normalizedQuestion: Annotation<string>(),
  normalizedTheme: Annotation<string>(),
  userContext: Annotation<string>(),
  retrievalQuery: Annotation<string>(),
  retrievedChunks: Annotation<RetrievedChunk[]>(),
  contextText: Annotation<string>(),
  hasEnoughContext: Annotation<boolean>(),
  sources: Annotation<AgentAnswerSource[]>(),
  keywords: Annotation<string[]>(),
  answer: Annotation<string>(),
  safetyNotes: Annotation<string[]>(),
  suggestedTeacherFollowUp: Annotation<string>(),
  needsTeacherReview: Annotation<boolean>(),
  provider: Annotation<AgentProvider>(),
  usedFallback: Annotation<boolean>(),
  fallbackReason: Annotation<string | undefined>(),
});

type AnswerGraphStateValue = typeof AnswerGraphState.State;
type AnswerGraphUpdate = Partial<AnswerGraphStateValue>;
type GetGovernedRetrieverContext = () => Promise<GovernedRetrieverContext>;

const GROUP_HINTS = {
  emmanuel: [
    "emmanuel",
    "constancia",
    "desanimado",
    "desanimo",
    "escuta respeitosa",
    "convivio fraterno",
    "aplicacao pratica",
  ],
  "a-caminho-da-luz": [
    "a caminho da luz",
    "capela",
    "racas adamicas",
    "civilizacoes antigas",
    "historia espiritual",
    "futuro da humanidade",
  ],
} as const;

const normalizeForMatch = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
};

const dedupeNotes = (notes: string[]): string[] => {
  return [...new Set(notes.map((note) => note.trim()).filter(Boolean))];
};

const createGroupDescriptor = (
  access: AgentBookAccessContext,
  matchMode: AgentGroupMatchMode,
): AgentAnswerGroup => {
  return {
    id: access.groupId,
    name: access.groupName,
    bookTitle: access.knowledgeBookTitle,
    matchMode,
  };
};

const inferGroupHintFromQuestion = (
  questionText: string,
): StudyGroup | undefined => {
  const normalizedText = normalizeForMatch(questionText);
  const scores = studyGroups.map((group) => {
    const groupHints =
      group.id === "emmanuel"
        ? GROUP_HINTS.emmanuel
        : GROUP_HINTS["a-caminho-da-luz"];
    const score = groupHints.reduce(
      (total, hint) => (normalizedText.includes(normalizeForMatch(hint)) ? total + 1 : total),
      0,
    );

    return { group, score };
  });
  const [bestMatch, secondMatch] = [...scores].sort((left, right) => right.score - left.score);

  if (!bestMatch || bestMatch.score === 0) {
    return undefined;
  }

  if (secondMatch && bestMatch.score === secondMatch.score) {
    return undefined;
  }

  return bestMatch.group;
};

const prioritizeChunks = (chunks: RetrievedChunk[]): RetrievedChunk[] => {
  return [...chunks].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.chunkIndex - right.chunkIndex;
  });
};

const mapRetrievedSources = (chunks: RetrievedChunk[]): AgentAnswerSource[] => {
  return chunks.map((chunk) => ({
    source: chunk.sourceLabel,
    title: chunk.title,
    score: chunk.score,
    group: chunk.group,
  }));
};

const createInitialState = (
  request: AnswerRequest,
  access: AgentBookAccessContext,
): AnswerGraphStateValue => {
  return {
    request,
    access,
    group: createGroupDescriptor(access, "selected_group"),
    normalizedQuestion: "",
    normalizedTheme: "",
    userContext: "",
    retrievalQuery: "",
    retrievedChunks: [],
    contextText: "",
    hasEnoughContext: false,
    sources: [],
    keywords: [],
    answer: "",
    safetyNotes: [],
    suggestedTeacherFollowUp: "",
    needsTeacherReview: true,
    provider: "local",
    usedFallback: false,
    fallbackReason: undefined,
  };
};

let getRetrieverContext: GetGovernedRetrieverContext = getGovernedRetrieverContext;

const searchGovernedChunks = async (
  context: GovernedRetrieverContext,
  query: string,
  options: Parameters<GovernedRetrieverContext["retriever"]["search"]>[1],
) => {
  try {
    return await context.retriever.search(query, options);
  } catch (error) {
    if (isGovernedRetrievalOperationalError(error)) {
      throw error;
    }

    throw new GovernedRetrieverError(
      "GOVERNED_RETRIEVER_BUILD_FAILED",
      "Falha ao buscar no retriever do corpus governado.",
    );
  }
};

const receiveQuestion = (state: AnswerGraphStateValue): AnswerGraphUpdate => {
  const normalizedQuestion = normalizeInputText(state.request.question);
  const normalizedTheme = state.request.theme
    ? normalizeInputText(state.request.theme)
    : "";
  const userContext = state.request.context
    ? normalizeInputText(state.request.context)
    : "";
  const retrievalQuery = [
    state.group.name,
    state.group.bookTitle,
    normalizedTheme,
    normalizedQuestion,
    userContext,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    normalizedQuestion,
    normalizedTheme,
    userContext,
    retrievalQuery,
    keywords: buildAnswerKeywords(normalizedQuestion, normalizedTheme),
  };
};

const classifyStudyGroup = (state: AnswerGraphStateValue): AnswerGraphUpdate => {
  const combinedText = normalizeForMatch(
    [state.normalizedQuestion, state.normalizedTheme, state.userContext].join(" "),
  );
  const explicitGroupHint = inferGroupHintFromQuestion(combinedText);
  const referencedOtherGroup = studyGroups.find((group) => {
    if (group.id === state.group.id) {
      return false;
    }

    return (
      combinedText.includes(normalizeForMatch(group.name)) ||
      combinedText.includes(normalizeForMatch(group.bookTitle))
    );
  });
  const hintedOtherGroup =
    explicitGroupHint && explicitGroupHint.id !== state.group.id
      ? explicitGroupHint
      : referencedOtherGroup;

  if (!hintedOtherGroup) {
    return {
      group: state.group,
    };
  }

  return {
    group: state.group,
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      `A pergunta menciona ${hintedOtherGroup.name}. A resposta permanece limitada ao grupo selecionado.`,
    ]),
  };
};

const retrieveContext = async (
  state: AnswerGraphStateValue,
): Promise<AnswerGraphUpdate> => {
  const retrieverContext = await getRetrieverContext();
  const primarySearchOptions = {
    limit: 4,
    minScore: 0.55,
    editorialScope: {
      bookId: state.access.knowledgeBookId,
      includeShared: true,
    },
  };
  let retrievedChunks = await searchGovernedChunks(
    retrieverContext,
    state.retrievalQuery,
    primarySearchOptions,
  );
  const primaryTopScore = retrievedChunks[0]?.score ?? 0;

  if (
    retrievedChunks.length === 0 ||
    (retrievedChunks[0]?.score ?? 0) < 1
  ) {
    const fallbackChunks = await searchGovernedChunks(
      retrieverContext,
      `${state.normalizedQuestion} ${state.normalizedTheme}`.trim(),
      {
        limit: 6,
        minScore: 0.35,
        editorialScope: {
          bookId: state.access.knowledgeBookId,
          includeShared: true,
        },
      },
    );

    if ((fallbackChunks[0]?.score ?? 0) >= primaryTopScore) {
      retrievedChunks = fallbackChunks;
    }
  }

  const prioritizedChunks = prioritizeChunks(retrievedChunks).slice(0, 3);
  const sources: AgentAnswerSource[] = [];
  const contextBlocks: string[] = [];
  const sensitiveTopics = [
    ...new Set(
      prioritizedChunks.flatMap((chunk) => chunk.sensitiveTopics).filter(Boolean),
    ),
  ];

  if (state.userContext.length > 0) {
    sources.push({
      source: "contexto-informado-na-pergunta",
      title: "Contexto informado na pergunta",
      score: 1,
    });
    contextBlocks.push(
      `Contexto informado na pergunta: ${buildShortExcerpt(state.userContext, 280)}`,
    );
  }

  if (prioritizedChunks.length > 0) {
    sources.push(...mapRetrievedSources(prioritizedChunks));
    contextBlocks.push(
      ...prioritizedChunks.map(
        (chunk, index) =>
          `Fonte ${index + 1} - ${chunk.title} (${chunk.sourceLabel}): ${buildShortExcerpt(chunk.content, 220)}`,
      ),
    );
  }

  const keywords = buildAnswerKeywords(
    state.normalizedQuestion,
    state.normalizedTheme,
    prioritizedChunks,
  );
  return {
    group: state.group,
    retrievedChunks: prioritizedChunks,
    sources,
    keywords,
    contextText: contextBlocks.join("\n\n"),
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      ...(sensitiveTopics.length > 0
        ? [
            `Os materiais recuperados tocam temas sensiveis (${sensitiveTopics.join(", ")}). Vale revisar a resposta com o professor.`,
          ]
        : []),
    ]),
  };
};

const checkContext = (state: AnswerGraphStateValue): AnswerGraphUpdate => {
  const topScore = state.retrievedChunks[0]?.score ?? 0;
  const hasMeaningfulUserContext = state.userContext.length >= 60;
  const hasSensitiveContext = state.retrievedChunks.some(
    (chunk) => chunk.teacherReviewRecommended && chunk.score >= 0.9,
  );
  const hasEnoughContext =
    hasMeaningfulUserContext ||
    topScore >= 0.95 ||
    hasSensitiveContext ||
    state.retrievedChunks.length >= 2;

  return {
    hasEnoughContext,
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      ...(hasEnoughContext
        ? []
        : ["O contexto reunido ainda esta curto para uma resposta mais segura."]),
    ]),
  };
};

const mapAnswerResultToState = (
  answerResult: AgentAnswerResult,
): AnswerGraphUpdate => {
  return {
    answer: answerResult.answer,
    group: answerResult.group,
    sources: answerResult.sources,
    keywords: answerResult.keywords,
    needsTeacherReview: answerResult.needsTeacherReview,
    safetyNotes: answerResult.safetyNotes,
    suggestedTeacherFollowUp: answerResult.suggestedTeacherFollowUp,
    provider: answerResult.provider,
    usedFallback: answerResult.usedFallback,
    fallbackReason: answerResult.fallbackReason,
  };
};

const generateAnswer = async (
  state: AnswerGraphStateValue,
): Promise<AnswerGraphUpdate> => {
  if (!state.hasEnoughContext) {
    return mapAnswerResultToState(
      buildInsufficientContextAnswer(
        state.group,
        {
          question: state.normalizedQuestion,
          theme: state.normalizedTheme,
          sources: state.sources,
          keywords: state.keywords,
          extraSafetyNotes: state.safetyNotes,
        },
      ),
    );
  }

  const prompt = buildAnswerPrompt();
  const messages = await prompt.formatMessages({
    groupName: state.group.name,
    bookTitle: state.group.bookTitle,
    theme: state.normalizedTheme || "Nao informado.",
    question: state.normalizedQuestion,
    keywords: state.keywords.join(", ") || "nao informado",
    context: state.contextText || "Nao ha contexto adicional autorizado.",
  });

  const llmResult = await generateWithConfiguredLlm(messages);

  if (!llmResult.ok) {
    return mapAnswerResultToState(
      buildAnswerFallback(
        state.request,
        {
          groupName: state.group.name,
          bookTitle: state.group.bookTitle,
        },
        llmResult.reason,
        {
          contextText: state.contextText,
          sources: state.sources,
          extraSafetyNotes: state.safetyNotes,
          group: state.group,
          keywords: state.keywords,
        },
      ),
    );
  }

  const safeText = sanitizeGeneratedText(llmResult.text, { maxLength: 720 });

  if (!safeText.ok) {
    return mapAnswerResultToState(
      buildAnswerFallback(
        state.request,
        {
          groupName: state.group.name,
          bookTitle: state.group.bookTitle,
        },
        safeText.reason,
        {
          contextText: state.contextText,
          sources: state.sources,
          extraSafetyNotes: state.safetyNotes,
          group: state.group,
          keywords: state.keywords,
        },
      ),
    );
  }

  return {
    answer: safeText.text,
    group: state.group,
    keywords: state.keywords,
    needsTeacherReview: true,
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      AGENT_REVIEW_NOTE,
      AGENT_SOURCE_NOTE,
    ]),
    suggestedTeacherFollowUp: state.suggestedTeacherFollowUp,
    provider: llmResult.provider,
    usedFallback: false,
    fallbackReason: undefined,
  };
};

const applySafetyReview = (
  state: AnswerGraphStateValue,
): AnswerGraphUpdate => {
  const safetyAssessment = assessAnswerSafety({
    question: state.normalizedQuestion,
    answer: state.answer,
    chunks: state.retrievedChunks,
    hasEnoughContext: state.hasEnoughContext,
    groupLabel: state.group.name,
  });
  const teacherReminder =
    safetyAssessment.suggestedTeacherFollowUp ||
    "Se a duvida continuar aberta ou sensivel, leve este ponto ao professor para revisao.";
  const answerWithReminder = /professor|revis[aã]o/iu.test(state.answer)
    ? state.answer
    : `${state.answer}\n\n${teacherReminder}`;
  const safeText = sanitizeGeneratedText(answerWithReminder, { maxLength: 820 });

  if (!safeText.ok) {
    return mapAnswerResultToState(
      buildAnswerFallback(
        state.request,
        {
          groupName: state.group.name,
          bookTitle: state.group.bookTitle,
        },
        safeText.reason,
        {
          contextText: state.contextText,
          sources: state.sources,
          extraSafetyNotes: state.safetyNotes,
          group: state.group,
          keywords: state.keywords,
        },
      ),
    );
  }

  return {
    answer: safeText.text,
    group: state.group,
    keywords: state.keywords,
    needsTeacherReview: safetyAssessment.needsTeacherReview,
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      ...safetyAssessment.safetyNotes,
      ...(state.sources.length > 0
        ? []
        : ["Nenhuma fonte demonstrativa foi recuperada para esta resposta."]),
    ]),
    suggestedTeacherFollowUp: safetyAssessment.suggestedTeacherFollowUp,
  };
};

const returnResponse = (state: AnswerGraphStateValue): AnswerGraphUpdate => {
  return {
    group: state.group,
    keywords: state.keywords,
    safetyNotes: dedupeNotes(state.safetyNotes),
    suggestedTeacherFollowUp: state.suggestedTeacherFollowUp,
  };
};

const answerGraph = new StateGraph(AnswerGraphState)
  .addNode("receiveQuestion", receiveQuestion)
  .addNode("classifyStudyGroup", classifyStudyGroup)
  .addNode("retrieveContext", retrieveContext)
  .addNode("checkContext", checkContext)
  .addNode("generateAnswer", generateAnswer)
  .addNode("applySafetyReview", applySafetyReview)
  .addNode("returnResponse", returnResponse)
  .addEdge(START, "receiveQuestion")
  .addEdge("receiveQuestion", "classifyStudyGroup")
  .addEdge("classifyStudyGroup", "retrieveContext")
  .addEdge("retrieveContext", "checkContext")
  .addEdge("checkContext", "generateAnswer")
  .addEdge("generateAnswer", "applySafetyReview")
  .addEdge("applySafetyReview", "returnResponse")
  .addEdge("returnResponse", END)
  .compile({
    name: "study-answer-graph",
  });

const invokeAnswerGraphWithTimeout = async (
  request: AnswerRequest,
  access: AgentBookAccessContext,
) => {
  const graphPromise = answerGraph.invoke(createInitialState(request, access));

  return await new Promise<AnswerGraphStateValue>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          "O fluxo de resposta excedeu o tempo esperado e voltou ao modo de contingencia.",
        ),
      );
    }, ANSWER_GRAPH_TIMEOUT_MS);

    graphPromise.then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
};

export const answerQuestionWithGraph = async (
  request: AnswerRequest,
  access: AgentBookAccessContext,
): Promise<AgentAnswerResult> => {
  try {
    const finalState = await invokeAnswerGraphWithTimeout(request, access);

    return {
      answer: finalState.answer,
      group: finalState.group,
      sources: finalState.sources,
      keywords: finalState.keywords,
      needsTeacherReview: finalState.needsTeacherReview,
      safetyNotes: finalState.safetyNotes,
      suggestedTeacherFollowUp: finalState.suggestedTeacherFollowUp,
      provider: finalState.provider,
      usedFallback: finalState.usedFallback,
      fallbackReason: finalState.fallbackReason,
    };
  } catch (error) {
    if (isGovernedRetrievalOperationalError(error)) {
      throw error;
    }

    return buildAnswerFallback(
      request,
      {
        groupName: access.groupName,
        bookTitle: access.knowledgeBookTitle,
      },
      "O fluxo de resposta encontrou um erro interno e retornou ao modo de contingencia.",
      {
        contextText: request.context,
        group: createGroupDescriptor(access, "selected_group"),
      },
    );
  }
};

export const setAnswerGraphRetrieverContextForTesting = (provider: GetGovernedRetrieverContext) => {
  getRetrieverContext = provider;
};

export const resetAnswerGraphRetrieverContextForTesting = () => {
  getRetrieverContext = getGovernedRetrieverContext;
};
