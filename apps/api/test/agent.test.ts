import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app";

describe("POST /api/agent/lesson-plan", () => {
  it("retorna fallback claro quando Ollama nao esta disponivel", async () => {
    const response = await request(app).post("/api/agent/lesson-plan").send({
      groupId: "emmanuel",
      theme: "Constancia no estudo durante a semana",
      teacherNote: "Reservar um momento para acolhimento inicial.",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.usedFallback).toBe(true);
    expect(response.body.data.kind).toBe("lesson-plan");
    expect(response.body.data.provider).toBe("fallback");
    expect(response.body.data.usedFallback).toBe(true);
    expect(response.body.data.reviewNote).toContain("revisao humana");
    expect(response.body.data.fallbackReason).toBeTruthy();
  });
});

describe("POST /api/agent/answer", () => {
  it.each([
    {
      groupId: "emmanuel",
      question: "Como continuar estudando mesmo desanimado?",
      expectedGroupName: "Emmanuel",
      expectedKeyword: "desanimado",
      expectedSensitiveTopic: /sofrimento|desanimo|professor/iu,
    },
    {
      groupId: "emmanuel",
      question: "A prece muda meus problemas?",
      expectedGroupName: undefined,
      expectedKeyword: "prece",
      expectedSensitiveTopic: /professor|serenidade|revis/iu,
    },
    {
      groupId: "emmanuel",
      question: "O que e Capela?",
      expectedGroupName: "A Caminho da Luz",
      expectedKeyword: "capela",
      expectedSensitiveTopic: /capela|prudencia|professor/iu,
    },
    {
      groupId: "emmanuel",
      question: "Como entender racas adamicas?",
      expectedGroupName: "A Caminho da Luz",
      expectedKeyword: "racas adamicas",
      expectedSensitiveTopic: /racas adamicas|prudencia|professor/iu,
    },
    {
      groupId: "a-caminho-da-luz",
      question: "Como viver o Evangelho na pratica?",
      expectedGroupName: undefined,
      expectedKeyword: "evangelho",
      expectedSensitiveTopic: /professor|revis|evangelho/iu,
    },
  ])(
    "retorna resposta curta e revisavel para a pergunta: $question",
    async ({ groupId, question, expectedGroupName, expectedKeyword, expectedSensitiveTopic }) => {
      const response = await request(app).post("/api/agent/answer").send({
        groupId,
        question,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.answer).toBe("string");
      expect(response.body.data.answer.length).toBeGreaterThan(20);
      expect(response.body.data.answer.length).toBeLessThan(900);
      expect(response.body.data.group).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          bookTitle: expect.any(String),
          matchMode: expect.any(String),
        }),
      );

      if (expectedGroupName) {
        expect(response.body.data.group.name).toBe(expectedGroupName);
      }

      expect(Array.isArray(response.body.data.sources)).toBe(true);
      expect(response.body.data.sources.length).toBeGreaterThan(0);
      expect(response.body.data.sources[0]).toEqual(
        expect.objectContaining({
          source: expect.any(String),
          title: expect.any(String),
          score: expect.any(Number),
        }),
      );
      expect(Array.isArray(response.body.data.keywords)).toBe(true);
      expect(
        response.body.data.keywords.some((keyword: string) =>
          keyword.toLowerCase().includes(expectedKeyword),
        ),
      ).toBe(true);
      expect(response.body.data.needsTeacherReview).toBe(true);
      expect(Array.isArray(response.body.data.safetyNotes)).toBe(true);
      expect(response.body.data.safetyNotes.join(" ")).toMatch(expectedSensitiveTopic);
      expect(typeof response.body.data.suggestedTeacherFollowUp).toBe("string");
      expect(response.body.data.suggestedTeacherFollowUp).toContain("professor");
      expect(response.body.meta).toEqual(
        expect.objectContaining({
          provider: expect.any(String),
          usedFallback: expect.any(Boolean),
        }),
      );
    },
  );
});
