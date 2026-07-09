import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { StudyGroup } from "../data/studies";
import { studyGroups } from "../data/studies";
import { createKeywordRetriever } from "../rag/retriever";
import type { RetrievedChunk } from "../rag/types";
import {
  AGENT_REVIEW_NOTE,
  AGENT_SOURCE_NOTE,
  type AgentAnswerResult,
  type AgentAnswerSource,
  type AgentProvider,
  type AnswerRequest,
} from "./types";
import { buildAnswerPrompt } from "./prompts";
import { buildAnswerFallback, buildInsufficientContextAnswer } from "./fallbacks";
import { generateWithOllama } from "./llm";
import { buildShortExcerpt, normalizeInputText, sanitizeGeneratedText } from "./safety";

const AnswerGraphState = Annotation.Root({
  request: Annotation<AnswerRequest>(),
  groupName: Annotation<string>(),
  bookTitle: Annotation<string>(),
  normalizedQuestion: Annotation<string>(),
  normalizedTheme: Annotation<string>(),
  userContext: Annotation<string>(),
  retrievalQuery: Annotation<string>(),
  retrievedChunks: Annotation<RetrievedChunk[]>(),
  contextText: Annotation<string>(),
  hasEnoughContext: Annotation<boolean>(),
  sources: Annotation<AgentAnswerSource[]>(),
  answer: Annotation<string>(),
  safetyNotes: Annotation<string[]>(),
  needsTeacherReview: Annotation<boolean>(),
  provider: Annotation<AgentProvider>(),
  usedFallback: Annotation<boolean>(),
  fallbackReason: Annotation<string | undefined>(),
});

type AnswerGraphStateValue = typeof AnswerGraphState.State;
type AnswerGraphUpdate = Partial<AnswerGraphStateValue>;

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

const isGroupRelevant = (chunk: RetrievedChunk, groupName: string): boolean => {
  const normalizedChunkGroup = normalizeForMatch(chunk.group);
  const normalizedGroupName = normalizeForMatch(groupName);

  return normalizedChunkGroup === normalizedGroupName || normalizedChunkGroup === "geral";
};

const prioritizeChunks = (
  chunks: RetrievedChunk[],
  groupName: string,
): RetrievedChunk[] => {
  return [...chunks].sort((left, right) => {
    const leftRelevant = isGroupRelevant(left, groupName) ? 1 : 0;
    const rightRelevant = isGroupRelevant(right, groupName) ? 1 : 0;

    if (rightRelevant !== leftRelevant) {
      return rightRelevant - leftRelevant;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.chunkIndex - right.chunkIndex;
  });
};

const mapRetrievedSources = (chunks: RetrievedChunk[]): AgentAnswerSource[] => {
  return chunks.map((chunk) => ({
    source: chunk.source,
    title: chunk.title,
    score: chunk.score,
  }));
};

const createInitialState = (
  request: AnswerRequest,
  group: StudyGroup,
): AnswerGraphStateValue => {
  return {
    request,
    groupName: group.name,
    bookTitle: request.bookTitle ?? group.bookTitle,
    normalizedQuestion: "",
    normalizedTheme: "",
    userContext: "",
    retrievalQuery: "",
    retrievedChunks: [],
    contextText: "",
    hasEnoughContext: false,
    sources: [],
    answer: "",
    safetyNotes: [],
    needsTeacherReview: true,
    provider: "local",
    usedFallback: false,
    fallbackReason: undefined,
  };
};

let retrieverPromise:
  | ReturnType<typeof createKeywordRetriever>
  | undefined;

const getRetriever = () => {
  retrieverPromise ??= createKeywordRetriever();
  return retrieverPromise;
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
    state.groupName,
    state.bookTitle,
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
  };
};

const classifyStudyGroup = (state: AnswerGraphStateValue): AnswerGraphUpdate => {
  const combinedText = normalizeForMatch(
    [state.normalizedQuestion, state.normalizedTheme, state.userContext].join(" "),
  );
  const referencedOtherGroup = studyGroups.find((group) => {
    if (group.id === state.request.groupId) {
      return false;
    }

    return (
      combinedText.includes(normalizeForMatch(group.name)) ||
      combinedText.includes(normalizeForMatch(group.bookTitle))
    );
  });

  if (!referencedOtherGroup) {
    return {};
  }

  return {
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      `A pergunta menciona ${referencedOtherGroup.name}. Confira se o grupo selecionado esta correto antes de compartilhar a resposta.`,
    ]),
  };
};

const retrieveContext = async (
  state: AnswerGraphStateValue,
): Promise<AnswerGraphUpdate> => {
  const retriever = await getRetriever();
  const searchOptions = { limit: 4, minScore: 0.55 };
  let retrievedChunks = await retriever.search(state.retrievalQuery, searchOptions);

  if (retrievedChunks.length === 0) {
    retrievedChunks = await retriever.search(
      `${state.groupName} ${state.normalizedQuestion}`,
      { limit: 4, minScore: 0.35 },
    );
  }

  const prioritizedChunks = prioritizeChunks(retrievedChunks, state.groupName).slice(0, 3);
  const sources: AgentAnswerSource[] = [];
  const contextBlocks: string[] = [];

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
          `Fonte ${index + 1} - ${chunk.title} (${chunk.source}): ${buildShortExcerpt(chunk.content, 240)}`,
      ),
    );
  }

  return {
    retrievedChunks: prioritizedChunks,
    sources,
    contextText: contextBlocks.join("\n\n"),
  };
};

const checkContext = (state: AnswerGraphStateValue): AnswerGraphUpdate => {
  const topScore = state.retrievedChunks[0]?.score ?? 0;
  const hasMeaningfulUserContext = state.userContext.length >= 60;
  const hasEnoughContext =
    hasMeaningfulUserContext ||
    topScore >= 1.1 ||
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
    sources: answerResult.sources,
    needsTeacherReview: answerResult.needsTeacherReview,
    safetyNotes: answerResult.safetyNotes,
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
        {
          groupName: state.groupName,
          bookTitle: state.bookTitle,
        },
        state.sources,
      ),
    );
  }

  const prompt = buildAnswerPrompt();
  const messages = await prompt.formatMessages({
    groupName: state.groupName,
    bookTitle: state.bookTitle,
    theme: state.normalizedTheme || "Nao informado.",
    question: state.normalizedQuestion,
    context: state.contextText || "Nao ha contexto adicional autorizado.",
  });

  const llmResult = await generateWithOllama(messages);

  if (!llmResult.ok) {
    return mapAnswerResultToState(
      buildAnswerFallback(
        state.request,
        {
          groupName: state.groupName,
          bookTitle: state.bookTitle,
        },
        llmResult.reason,
        {
          contextText: state.contextText,
          sources: state.sources,
          extraSafetyNotes: state.safetyNotes,
        },
      ),
    );
  }

  const safeText = sanitizeGeneratedText(llmResult.text, { maxLength: 900 });

  if (!safeText.ok) {
    return mapAnswerResultToState(
      buildAnswerFallback(
        state.request,
        {
          groupName: state.groupName,
          bookTitle: state.bookTitle,
        },
        safeText.reason,
        {
          contextText: state.contextText,
          sources: state.sources,
          extraSafetyNotes: state.safetyNotes,
        },
      ),
    );
  }

  return {
    answer: safeText.text,
    needsTeacherReview: true,
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      AGENT_REVIEW_NOTE,
      AGENT_SOURCE_NOTE,
    ]),
    provider: "ollama",
    usedFallback: false,
    fallbackReason: undefined,
  };
};

const applySafetyReview = (
  state: AnswerGraphStateValue,
): AnswerGraphUpdate => {
  const teacherReminder =
    "Se a duvida continuar aberta ou sensivel, leve este ponto ao professor para revisao.";
  const answerWithReminder = /professor|revis[aã]o/iu.test(state.answer)
    ? state.answer
    : `${state.answer}\n\n${teacherReminder}`;
  const safeText = sanitizeGeneratedText(answerWithReminder, { maxLength: 980 });

  if (!safeText.ok) {
    return mapAnswerResultToState(
      buildAnswerFallback(
        state.request,
        {
          groupName: state.groupName,
          bookTitle: state.bookTitle,
        },
        safeText.reason,
        {
          contextText: state.contextText,
          sources: state.sources,
          extraSafetyNotes: state.safetyNotes,
        },
      ),
    );
  }

  return {
    answer: safeText.text,
    needsTeacherReview: true,
    safetyNotes: dedupeNotes([
      ...state.safetyNotes,
      ...(state.sources.length > 0
        ? []
        : ["Nenhuma fonte demonstrativa foi recuperada para esta resposta."]),
    ]),
  };
};

const returnResponse = (state: AnswerGraphStateValue): AnswerGraphUpdate => {
  return {
    safetyNotes: dedupeNotes(state.safetyNotes),
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

export const answerQuestionWithGraph = async (
  request: AnswerRequest,
  group: StudyGroup,
): Promise<AgentAnswerResult> => {
  try {
    const finalState = await answerGraph.invoke(createInitialState(request, group));

    return {
      answer: finalState.answer,
      sources: finalState.sources,
      needsTeacherReview: finalState.needsTeacherReview,
      safetyNotes: finalState.safetyNotes,
      provider: finalState.provider,
      usedFallback: finalState.usedFallback,
      fallbackReason: finalState.fallbackReason,
    };
  } catch (_error) {
    return buildAnswerFallback(
      request,
      {
        groupName: group.name,
        bookTitle: request.bookTitle ?? group.bookTitle,
      },
      "O fluxo de resposta encontrou um erro interno e retornou ao modo de contingencia.",
      {
        contextText: request.context,
      },
    );
  }
};
