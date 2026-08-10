import { HumanMessage } from "@langchain/core/messages";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateWithConfiguredLlm,
  resetLlmForTesting,
  setLlmChatModelFactoryForTesting,
  setLlmLoggerForTesting,
  setLlmRuntimeConfigForTesting,
  setOllamaAvailabilityCheckerForTesting,
} from "../src/agent/llm";

const groqConfig = {
  provider: "groq" as const,
  ollamaModel: "llama3.1:8b",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  groqApiKey: "groq-secret-for-test",
  groqModel: "groq-model-for-test",
};

const ollamaConfig = {
  provider: "ollama" as const,
  ollamaModel: "llama3.1:8b",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  groqApiKey: null,
  groqModel: null,
};

const messages = [new HumanMessage("Como estudar com serenidade?")];

describe("configured LLM provider", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetLlmForTesting();
  });

  it("usa Groq mockado quando LLM_PROVIDER=groq", async () => {
    const invoke = vi.fn().mockResolvedValue({ content: "Resposta gerada pelo Groq." });
    const factory = vi.fn(() => ({ invoke }));

    setLlmRuntimeConfigForTesting(groqConfig);
    setLlmChatModelFactoryForTesting(factory);

    const result = await generateWithConfiguredLlm(messages);

    expect(factory).toHaveBeenCalledWith(groqConfig);
    expect(invoke).toHaveBeenCalledWith(messages, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result).toEqual({
      ok: true,
      provider: "groq",
      text: "Resposta gerada pelo Groq.",
    });
  });

  it("aciona fallback quando Groq falha", async () => {
    setLlmRuntimeConfigForTesting(groqConfig);
    setLlmChatModelFactoryForTesting(() => ({
      invoke: vi.fn().mockRejectedValue(new Error("upstream exploded with secret")),
    }));

    const result = await generateWithConfiguredLlm(messages);

    expect(result).toEqual({
      ok: false,
      provider: "fallback",
      reason: "Groq ficou indisponivel durante a geracao do texto.",
    });
    expect(JSON.stringify(result)).not.toContain(groqConfig.groqApiKey);
  });

  it("aciona fallback quando Groq excede timeout", async () => {
    vi.useFakeTimers();
    setLlmRuntimeConfigForTesting(groqConfig);
    setLlmChatModelFactoryForTesting(() => ({
      invoke: vi.fn(() => new Promise(() => undefined)),
    }));

    const pendingResult = generateWithConfiguredLlm(messages);
    await vi.advanceTimersByTimeAsync(9000);
    const result = await pendingResult;

    expect(result).toEqual({
      ok: false,
      provider: "fallback",
      reason: "Groq excedeu o tempo esperado para gerar texto.",
    });
  });

  it("aciona fallback quando Groq retorna conteudo vazio ou inesperado", async () => {
    setLlmRuntimeConfigForTesting(groqConfig);
    setLlmChatModelFactoryForTesting(() => ({
      invoke: vi.fn().mockResolvedValue({ content: [{ type: "unknown" }] }),
    }));

    const result = await generateWithConfiguredLlm(messages);

    expect(result).toEqual({
      ok: false,
      provider: "fallback",
      reason: "Groq nao retornou texto util para esta tarefa.",
    });
  });

  it("trata configuracao Groq sem chave ou modelo como fallback previsivel", async () => {
    setLlmRuntimeConfigForTesting({
      ...groqConfig,
      groqApiKey: null,
    });

    const missingKeyResult = await generateWithConfiguredLlm(messages);

    expect(missingKeyResult).toEqual({
      ok: false,
      provider: "fallback",
      reason: "Groq ficou indisponivel durante a geracao do texto.",
    });

    setLlmRuntimeConfigForTesting({
      ...groqConfig,
      groqModel: null,
    });

    const missingModelResult = await generateWithConfiguredLlm(messages);

    expect(missingModelResult).toEqual({
      ok: false,
      provider: "fallback",
      reason: "Groq ficou indisponivel durante a geracao do texto.",
    });
  });

  it("mantem Ollama funcional quando disponibilidade esta positiva", async () => {
    const invoke = vi.fn().mockResolvedValue({ content: "Resposta gerada pelo Ollama." });

    setLlmRuntimeConfigForTesting(ollamaConfig);
    setOllamaAvailabilityCheckerForTesting(vi.fn().mockResolvedValue({ available: true }));
    setLlmChatModelFactoryForTesting(() => ({ invoke }));

    const result = await generateWithConfiguredLlm(messages);

    expect(result).toEqual({
      ok: true,
      provider: "ollama",
      text: "Resposta gerada pelo Ollama.",
    });
  });

  it("nao executa health check do Ollama quando provider e Groq", async () => {
    const availabilityChecker = vi.fn().mockResolvedValue({ available: true });

    setLlmRuntimeConfigForTesting(groqConfig);
    setOllamaAvailabilityCheckerForTesting(availabilityChecker);
    setLlmChatModelFactoryForTesting(() => ({
      invoke: vi.fn().mockResolvedValue({ content: "Resposta Groq." }),
    }));

    await generateWithConfiguredLlm(messages);

    expect(availabilityChecker).not.toHaveBeenCalled();
  });

  it("nao registra secrets em logs ou resposta", async () => {
    const logs: unknown[] = [];

    setLlmRuntimeConfigForTesting(groqConfig);
    setLlmLoggerForTesting((event) => logs.push(event));
    setLlmChatModelFactoryForTesting(() => ({
      invoke: vi.fn().mockRejectedValue(new Error(`falha ${groqConfig.groqApiKey}`)),
    }));

    const result = await generateWithConfiguredLlm(messages);
    const serialized = JSON.stringify({ result, logs });

    expect(serialized).not.toContain(groqConfig.groqApiKey);
    expect(logs).toEqual([
      expect.objectContaining({
        provider: "groq",
        model: groqConfig.groqModel,
        success: false,
        usedFallback: true,
        errorCategory: "provider_error",
      }),
    ]);
  });
});
