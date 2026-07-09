import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app";

describe("GET /health", () => {
  it("retorna status ok em JSON padronizado", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("API funcionando normalmente.");
    expect(response.body.data.status).toBe("ok");
    expect(typeof response.body.data.timestamp).toBe("string");
  });
});

describe("GET /api/studies", () => {
  it("retorna os grupos mockados com proxima aula", async () => {
    const response = await request(app).get("/api/studies");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBe(2);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      id: "emmanuel",
      name: "Emmanuel",
      participantCount: 88,
    });
    expect(response.body.data[0].nextLesson).toMatchObject({
      id: "lesson-emmanuel-2026-07-13",
      scheduledAt: "2026-07-13T20:00:00-03:00",
    });
  });
});
