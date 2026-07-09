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
  it("retorna resposta segura com fontes e revisao humana", async () => {
    const response = await request(app).post("/api/agent/answer").send({
      groupId: "a-caminho-da-luz",
      question: "Como posso participar melhor sem interromper o grupo?",
      context:
        "O grupo valoriza escuta respeitosa, fala breve e acolhimento durante os encontros.",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.answer).toBe("string");
    expect(response.body.data.answer.length).toBeGreaterThan(20);
    expect(Array.isArray(response.body.data.sources)).toBe(true);
    expect(response.body.data.sources.length).toBeGreaterThan(0);
    expect(response.body.data.sources[0]).toEqual(
      expect.objectContaining({
        source: expect.any(String),
        title: expect.any(String),
        score: expect.any(Number),
      }),
    );
    expect(response.body.data.needsTeacherReview).toBe(true);
    expect(Array.isArray(response.body.data.safetyNotes)).toBe(true);
    expect(response.body.data.safetyNotes.length).toBeGreaterThan(0);
    expect(response.body.meta).toEqual(
      expect.objectContaining({
        provider: expect.any(String),
        usedFallback: expect.any(Boolean),
      }),
    );
  });
});
