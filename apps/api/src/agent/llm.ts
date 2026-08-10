import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import type { BaseMessage } from "@langchain/core/messages";

import { env, isDevelopment, type LlmProvider } from "../config/env";
import type { LlmAttemptResult } from "./types";

const OLLAMA_HEALTH_TIMEOUT_MS = 1200;
const AVAILABILITY_CACHE_TTL_MS = 15000;
const LLM_GENERATION_TIMEOUT_MS = 9000;
const GROQ_MAX_RETRIES = 1;

interface ChatModel {
  invoke(
    messages: BaseMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<{ content: unknown }>;
}

interface LlmRuntimeConfig {
  provider: LlmProvider;
  ollamaModel: string;
  ollamaBaseUrl: string;
  groqApiKey: string | null;
  groqModel: string | null;
}

interface LlmLogEvent {
  provider: LlmProvider;
  model: string;
  durationMs: number;
  success: boolean;
  usedFallback: boolean;
  errorCategory?: "configuration" | "timeout" | "empty_response" | "provider_error";
}

type ChatModelFactory = (config: LlmRuntimeConfig) => ChatModel;
type LlmLogger = (event: LlmLogEvent) => void;
type OllamaAvailabilityChecker = (
  config: LlmRuntimeConfig,
) => Promise<{ available: boolean; reason?: string }>;

let chatModel: ChatModel | null = null;
let chatModelKey: string | null = null;
let chatModelFactoryOverride: ChatModelFactory | null = null;
let runtimeConfigOverride: LlmRuntimeConfig | null = null;
let loggerOverride: LlmLogger | null = null;
let ollamaAvailabilityCheckerOverride: OllamaAvailabilityChecker | null = null;
let availabilityCache:
  | {
      checkedAt: number;
      available: boolean;
      reason?: string;
    }
  | null = null;

const getRuntimeConfig = (): LlmRuntimeConfig => {
  if (runtimeConfigOverride) {
    return runtimeConfigOverride;
  }

  return {
    provider: env.llmProvider,
    ollamaModel: env.ollamaModel,
    ollamaBaseUrl: env.ollamaBaseUrl,
    groqApiKey: env.groqApiKey,
    groqModel: env.groqModel,
  };
};

const getModelName = (config: LlmRuntimeConfig): string => {
  return config.provider === "groq"
    ? config.groqModel ?? "groq-model-unconfigured"
    : config.ollamaModel;
};

const getChatModelKey = (config: LlmRuntimeConfig): string => {
  return [
    config.provider,
    config.ollamaModel,
    config.ollamaBaseUrl,
    config.groqModel ?? "",
  ].join("|");
};

const createChatModel = (config: LlmRuntimeConfig): ChatModel => {
  if (config.provider === "groq") {
    if (!config.groqApiKey) {
      throw new Error("GROQ_API_KEY é obrigatório quando LLM_PROVIDER=groq.");
    }

    if (!config.groqModel) {
      throw new Error("GROQ_MODEL é obrigatório quando LLM_PROVIDER=groq.");
    }

    return new ChatGroq({
      apiKey: config.groqApiKey,
      model: config.groqModel,
      temperature: 0.2,
      timeout: LLM_GENERATION_TIMEOUT_MS,
      maxRetries: GROQ_MAX_RETRIES,
    });
  }

  return new ChatOllama({
    model: config.ollamaModel,
    baseUrl: config.ollamaBaseUrl,
    temperature: 0.2,
  });
};

const getChatModel = (config: LlmRuntimeConfig) => {
  const nextKey = getChatModelKey(config);

  if (!chatModel || chatModelKey !== nextKey) {
    chatModel = (chatModelFactoryOverride ?? createChatModel)(config);
    chatModelKey = nextKey;
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

const checkOllamaAvailability = async (
  config: LlmRuntimeConfig,
): Promise<{
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
    const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/u, "")}/api/tags`, {
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

const invokeWithTimeout = async (
  model: ChatModel,
  messages: BaseMessage[],
): Promise<{ content: unknown }> => {
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      model.invoke(messages, { signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("LLM generation timeout"));
        }, LLM_GENERATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const categorizeError = (error: unknown): LlmLogEvent["errorCategory"] => {
  if (error instanceof Error && /abort|timeout|timed out/iu.test(error.message)) {
    return "timeout";
  }

  if (error instanceof Error && /GROQ_|LLM_PROVIDER/iu.test(error.message)) {
    return "configuration";
  }

  return "provider_error";
};

const logLlmAttempt = (event: LlmLogEvent) => {
  if (env.nodeEnv === "test" && !loggerOverride) {
    return;
  }

  const logger = loggerOverride ?? ((payload: LlmLogEvent) => {
    console.log("[agent:llm]", JSON.stringify(payload));
  });

  logger(event);
};

export const generateWithConfiguredLlm = async (
  messages: BaseMessage[],
): Promise<LlmAttemptResult> => {
  const startedAt = Date.now();
  const config = getRuntimeConfig();
  const model = getModelName(config);

  if (config.provider === "ollama") {
    const availability = await (ollamaAvailabilityCheckerOverride ?? checkOllamaAvailability)(
      config,
    );

    if (!availability.available) {
      logLlmAttempt({
        provider: config.provider,
        model,
        durationMs: Date.now() - startedAt,
        success: false,
        usedFallback: true,
        errorCategory: "provider_error",
      });

      return {
        ok: false,
        provider: "fallback",
        reason: availability.reason ?? "Ollama indisponivel.",
      };
    }
  }

  try {
    const response = await invokeWithTimeout(getChatModel(config), messages);
    const text = extractTextContent(response.content).trim();

    if (!text) {
      logLlmAttempt({
        provider: config.provider,
        model,
        durationMs: Date.now() - startedAt,
        success: false,
        usedFallback: true,
        errorCategory: "empty_response",
      });

      return {
        ok: false,
        provider: "fallback",
        reason: `${config.provider === "groq" ? "Groq" : "Ollama"} nao retornou texto util para esta tarefa.`,
      };
    }

    logLlmAttempt({
      provider: config.provider,
      model,
      durationMs: Date.now() - startedAt,
      success: true,
      usedFallback: false,
    });

    return {
      ok: true,
      provider: config.provider,
      text,
    };
  } catch (error) {
    if (isDevelopment) {
      console.warn(`[agent:${config.provider}]`, error);
    }

    if (config.provider === "ollama") {
      availabilityCache = {
        checkedAt: Date.now(),
        available: false,
        reason: "Ollama ficou indisponivel durante a geracao do texto.",
      };
    }

    const errorCategory = categorizeError(error);

    logLlmAttempt({
      provider: config.provider,
      model,
      durationMs: Date.now() - startedAt,
      success: false,
      usedFallback: true,
      errorCategory,
    });

    return {
      ok: false,
      provider: "fallback",
      reason: errorCategory === "timeout"
        ? `${config.provider === "groq" ? "Groq" : "Ollama"} excedeu o tempo esperado para gerar texto.`
        : `${config.provider === "groq" ? "Groq" : "Ollama"} ficou indisponivel durante a geracao do texto.`,
    };
  }
};

export const setLlmRuntimeConfigForTesting = (config: LlmRuntimeConfig) => {
  runtimeConfigOverride = config;
  chatModel = null;
  chatModelKey = null;
  availabilityCache = null;
};

export const setLlmChatModelFactoryForTesting = (factory: ChatModelFactory) => {
  chatModelFactoryOverride = factory;
  chatModel = null;
  chatModelKey = null;
};

export const setLlmLoggerForTesting = (logger: LlmLogger) => {
  loggerOverride = logger;
};

export const setOllamaAvailabilityCheckerForTesting = (
  checker: OllamaAvailabilityChecker,
) => {
  ollamaAvailabilityCheckerOverride = checker;
  availabilityCache = null;
};

export const resetLlmForTesting = () => {
  runtimeConfigOverride = null;
  chatModelFactoryOverride = null;
  loggerOverride = null;
  ollamaAvailabilityCheckerOverride = null;
  chatModel = null;
  chatModelKey = null;
  availabilityCache = null;
};
