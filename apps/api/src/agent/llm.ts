import { ChatOllama } from "@langchain/ollama";
import type { BaseMessage } from "@langchain/core/messages";

import { env, isDevelopment } from "../config/env";
import type { LlmAttemptResult } from "./types";

const OLLAMA_HEALTH_TIMEOUT_MS = 1200;
const AVAILABILITY_CACHE_TTL_MS = 15000;

let chatModel: ChatOllama | null = null;
let availabilityCache:
  | {
      checkedAt: number;
      available: boolean;
      reason?: string;
    }
  | null = null;

const getChatModel = () => {
  if (!chatModel) {
    chatModel = new ChatOllama({
      model: env.ollamaModel,
      baseUrl: env.ollamaBaseUrl,
      temperature: 0.2,
    });
  }

  return chatModel;
};

const extractTextContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (
        item &&
        typeof item === "object" &&
        "text" in item &&
        typeof item.text === "string"
      ) {
        return item.text;
      }

      return "";
    })
    .join("\n")
    .trim();
};

const checkOllamaAvailability = async (): Promise<{
  available: boolean;
  reason?: string;
}> => {
  if (env.nodeEnv === "test") {
    return {
      available: false,
      reason: "Ollama desativado durante os testes automatizados.",
    };
  }

  if (
    availabilityCache &&
    Date.now() - availabilityCache.checkedAt < AVAILABILITY_CACHE_TTL_MS
  ) {
    return {
      available: availabilityCache.available,
      reason: availabilityCache.reason,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.ollamaBaseUrl.replace(/\/$/u, "")}/api/tags`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const available = response.ok;
    const result = available
      ? { available: true }
      : {
          available: false,
          reason: "Ollama respondeu, mas nao esta pronto para atender agora.",
        };

    availabilityCache = {
      checkedAt: Date.now(),
      ...result,
    };

    return result;
  } catch (_error) {
    const result = {
      available: false,
      reason: "Ollama nao esta disponivel no momento.",
    };

    availabilityCache = {
      checkedAt: Date.now(),
      ...result,
    };

    return result;
  } finally {
    clearTimeout(timeout);
  }
};

export const generateWithOllama = async (
  messages: BaseMessage[],
): Promise<LlmAttemptResult> => {
  const availability = await checkOllamaAvailability();

  if (!availability.available) {
    return {
      ok: false,
      provider: "fallback",
      reason: availability.reason ?? "Ollama indisponivel.",
    };
  }

  try {
    const response = await getChatModel().invoke(messages);
    const text = extractTextContent(response.content).trim();

    if (!text) {
      return {
        ok: false,
        provider: "fallback",
        reason: "Ollama nao retornou texto util para esta tarefa.",
      };
    }

    return {
      ok: true,
      provider: "ollama",
      text,
    };
  } catch (error) {
    if (isDevelopment) {
      console.warn("[agent:ollama]", error);
    }

    availabilityCache = {
      checkedAt: Date.now(),
      available: false,
      reason: "Ollama ficou indisponivel durante a geracao do texto.",
    };

    return {
      ok: false,
      provider: "fallback",
      reason: "Ollama ficou indisponivel durante a geracao do texto.",
    };
  }
};
