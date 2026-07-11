import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app";

describe("GET /api/knowledge", () => {
  it("retorna a visao geral da base de conhecimento com grupos e arquivos compartilhados", async () => {
    const response = await request(app).get("/api/knowledge");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.totalGroups).toBe(2);
    expect(response.body.data.totalFiles).toBeGreaterThan(10);
    expect(response.body.data.groups).toHaveLength(2);
    expect(response.body.data.groups[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        book: expect.any(String),
        summary: expect.any(String),
        fileCount: expect.any(Number),
        tags: expect.any(Array),
        types: expect.any(Array),
      }),
    );
    expect(response.body.data.sharedFiles).toEqual(expect.any(Array));
  });
});

describe("GET /api/knowledge/groups", () => {
  it("retorna os grupos aceitos pela base de conhecimento", async () => {
    const response = await request(app).get("/api/knowledge/groups");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBe(2);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "emmanuel", name: "Emmanuel" }),
        expect.objectContaining({
          id: "a_caminho_da_luz",
          name: "A Caminho da Luz",
        }),
      ]),
    );
  });
});

describe("GET /api/knowledge/:group", () => {
  it("retorna a base resumida do grupo Emmanuel", async () => {
    const response = await request(app).get("/api/knowledge/emmanuel");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "emmanuel",
        name: "Emmanuel",
        book: "Emmanuel",
      }),
    );
    expect(response.body.data.featuredFiles.length).toBeGreaterThan(0);
    expect(response.body.data.featuredFiles[0]).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        type: expect.any(String),
        tags: expect.any(Array),
        summary: expect.any(String),
      }),
    );
    expect(response.body.data.featuredFiles[0].content).toBeUndefined();
  });

  it("retorna a base resumida do grupo A Caminho da Luz", async () => {
    const response = await request(app).get("/api/knowledge/a_caminho_da_luz");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.group).toEqual(
      expect.objectContaining({
        id: "a_caminho_da_luz",
        name: "A Caminho da Luz",
        book: "A Caminho da Luz",
      }),
    );
    expect(response.body.data.featuredFiles.length).toBeGreaterThan(0);
  });
});

describe("GET /api/knowledge/search", () => {
  it("encontra material compartilhado para a busca por prece", async () => {
    const response = await request(app).get("/api/knowledge/search").query({ q: "prece" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBeGreaterThan(0);
    expect(response.body.data.query).toBe("prece");
    expect(response.body.data.items.some((item: { filename: string }) => item.filename === "orientacoes_do_grupo.md")).toBe(true);
  });

  it("encontra material sensivel para a busca por capela", async () => {
    const response = await request(app).get("/api/knowledge/search").query({ q: "capela" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.count).toBeGreaterThan(0);
    expect(
      response.body.data.items.some(
        (item: { title: string; teacherReviewRecommended: boolean }) =>
          /capela|civilizacoes antigas/iu.test(item.title) && item.teacherReviewRecommended,
      ),
    ).toBe(true);
  });
});
