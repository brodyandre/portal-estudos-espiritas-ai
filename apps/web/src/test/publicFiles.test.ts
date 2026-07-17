import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const readWebFile = (relativePath: string) => {
  return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
};

describe("public web metadata files", () => {
  it("index.html possui metadados públicos mínimos", () => {
    const html = readWebFile("index.html");

    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain("Portal de Estudos Espíritas com IA | Educação Continuada");
    expect(html).toContain('rel="canonical" href="https://portal-educacao-continuada.com.br/"');
    expect(html).toContain('rel="icon" href="%BASE_URL%branding/logo_EC.png"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('name="twitter:card" content="summary"');
  });

  it("robots.txt aponta sitemap e bloqueia áreas privadas", () => {
    const robots = readWebFile("public/robots.txt");

    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /login");
    expect(robots).toContain("Disallow: /aluno");
    expect(robots).toContain("Sitemap: https://portal-educacao-continuada.com.br/sitemap.xml");
  });

  it("sitemap.xml contém somente URLs públicas limpas", () => {
    const sitemap = readWebFile("public/sitemap.xml");
    const parser = new DOMParser();
    const document = parser.parseFromString(sitemap, "application/xml");
    const parseError = document.querySelector("parsererror");
    const urls = [...document.querySelectorAll("loc")].map((node) => node.textContent ?? "");

    expect(parseError).toBeNull();
    expect(urls).toEqual([
      "https://portal-educacao-continuada.com.br/",
      "https://portal-educacao-continuada.com.br/portal",
      "https://portal-educacao-continuada.com.br/educacao-continuada",
      "https://portal-educacao-continuada.com.br/inscricao",
      "https://portal-educacao-continuada.com.br/divulgacao",
      "https://portal-educacao-continuada.com.br/materiais",
      "https://portal-educacao-continuada.com.br/materiais/emmanuel",
      "https://portal-educacao-continuada.com.br/materiais/a-caminho-da-luz",
    ]);
    expect(sitemap).not.toContain(["/", "#", "/"].join(""));
    expect(sitemap).not.toContain("localhost");
  });
});
