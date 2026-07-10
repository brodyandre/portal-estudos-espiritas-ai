import type { StudyGroupId } from "../data/studies";

export type AgentTaskKind =
  | "lesson-plan"
  | "reflection-questions"
  | "summarize"
  | "answer";

export type AgentProvider = "ollama" | "fallback" | "local";
export type AgentAnswerGroupId = StudyGroupId | "both";
export type AgentGroupMatchMode =
  | "selected_group"
  | "question_hint"
  | "retrieved_context"
  | "broad_search";

export interface AgentBaseRequest {
  groupId: StudyGroupId;
  theme?: string;
  bookTitle?: string;
  context?: string;
}

export interface LessonPlanRequest extends AgentBaseRequest {
  theme: string;
  teacherNote?: string;
  durationMinutes?: number;
}

export interface ReflectionQuestionsRequest extends AgentBaseRequest {
  theme: string;
  questionCount?: number;
}

export interface SummarizeRequest extends AgentBaseRequest {
  sourceText: string;
}

export interface AnswerRequest extends AgentBaseRequest {
  question: string;
}

export interface AgentDraft {
  kind: AgentTaskKind;
  title: string;
  content: string;
  items?: string[];
  provider: AgentProvider;
  usedFallback: boolean;
  reviewNote: string;
  sourceNote: string;
  fallbackReason?: string;
}

export interface AgentAnswerGroup {
  id: AgentAnswerGroupId;
  name: string;
  bookTitle: string;
  matchMode: AgentGroupMatchMode;
}

export interface AgentAnswerSource {
  source: string;
  title: string;
  score: number;
  group?: string;
}

export interface AgentAnswerResult {
  answer: string;
  group: AgentAnswerGroup;
  sources: AgentAnswerSource[];
  keywords: string[];
  needsTeacherReview: boolean;
  safetyNotes: string[];
  suggestedTeacherFollowUp: string;
  provider: AgentProvider;
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface LlmSuccessResult {
  ok: true;
  provider: "ollama";
  text: string;
}

export interface LlmFailureResult {
  ok: false;
  provider: "fallback";
  reason: string;
}

export type LlmAttemptResult = LlmSuccessResult | LlmFailureResult;

export const AGENT_REVIEW_NOTE =
  "Conteudo de apoio gerado para revisao humana. Revise com cuidado antes de publicar ou compartilhar.";

export const AGENT_SOURCE_NOTE =
  "Use apenas conteudo demonstrativo ou autorizado e confirme pontos sensiveis com o professor.";
