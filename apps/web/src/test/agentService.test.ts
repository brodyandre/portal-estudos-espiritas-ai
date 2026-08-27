import { afterEach, describe, expect, it, vi } from "vitest";

import type { DemoGroup } from "../mocks";

const canonicalGroup: DemoGroup = {
  slug: "emmanuel",
  name: "Grupo Emmanuel",
  meetingDay: null,
  meetingTime: null,
  participantCount: null,
  meetUrl: null,
  bookTitle: "Emmanuel",
  description: null,
  nextLesson: {
    id: "lesson-emmanuel",
    title: "Aula Emmanuel",
    theme: "Tema Emmanuel",
    scheduledAt: "2026-07-15T20:00:00.000-03:00",
    scheduledLabel: "Quarta, 15 de julho de 2026, 20h",
    status: "proxima",
    teacherNote: "Nota do professor.",
  },
};

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const errorEnvelope = (code: string) => ({
  success: false,
  error: {
    code,
    message: "Erro seguro.",
  },
});

const loadServiceModule = async () => {
  vi.resetModules();
  vi.doMock("../config/appMode", () => ({
    appConfig: {
      appMode: "local",
      apiUrl: "http://localhost:3333",
      canUseDemoFallback: true,
    },
  }));

  return import("../services/agentService");
};

const getRequestBody = () => {
  const init = vi.mocked(fetch).mock.calls[0]?.[1];
  const body = init && "body" in init && typeof init.body === "string" ? init.body : "{}";
  return JSON.parse(body) as Record<string, unknown>;
};

describe("agentService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../config/appMode");
  });

  it("askStudyAssistant envia bookTitle canônico do grupo autorizado", async () => {
    const { askStudyAssistant } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          success: true,
          data: {
            answer: "Resposta canônica.",
            group: {
              id: "emmanuel",
              name: "Emmanuel",
              bookTitle: "Emmanuel",
              matchMode: "selected_group",
            },
            sources: [],
            needsTeacherReview: true,
            safetyNotes: [],
            provider: "local",
            usedFallback: false,
          },
        }),
      ),
    );

    await askStudyAssistant({
      question: "Como estudar?",
      group: canonicalGroup,
      materials: [],
      summary: null,
      supportFiles: [],
    });

    expect(getRequestBody()).toMatchObject({
      groupId: "emmanuel",
      bookTitle: "Emmanuel",
    });
  });

  it.each([
    "BOOK_ACCESS_FORBIDDEN",
    "BOOK_ACCESS_CATALOG_UNAVAILABLE",
    "KNOWLEDGE_CORPUS_UNAVAILABLE",
  ])("não usa fallback local para erro governado %s", async (code) => {
    const { askStudyAssistant } = await loadServiceModule();
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(errorEnvelope(code), false)));

    await expect(
      askStudyAssistant({
        question: "Como estudar?",
        group: canonicalGroup,
        materials: [],
        summary: null,
        supportFiles: [],
      }),
    ).rejects.toMatchObject({
      code,
    });
  });

  it("mantém fallback local para falha de rede em modo local não produtivo", async () => {
    const { askStudyAssistant } = await loadServiceModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const result = await askStudyAssistant({
      question: "Como estudar?",
      group: canonicalGroup,
      materials: [],
      summary: null,
      supportFiles: [],
    });

    expect(result.source).toBe("mock");
    expect(result.data.usedFallback).toBe(true);
  });
});
