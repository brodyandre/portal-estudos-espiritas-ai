import { describe, expect, it } from "vitest";

import { buildWebConfig } from "../config/appMode";

const productionLocalSource = {
  MODE: "production",
  BASE_URL: "/",
  VITE_APP_MODE: "local",
  VITE_API_URL: "https://api.portal-educacao-continuada.com.br/",
  VITE_SHOW_REAL_MEET_LINK: "true",
  VITE_ENABLE_ADMIN_FEATURES: "true",
  VITE_ENABLE_TEACHER_FEATURES: "false",
};

describe("buildWebConfig", () => {
  it("aceita modo local de produção com API oficial HTTPS e normaliza URL", () => {
    const config = buildWebConfig(productionLocalSource);

    expect(config.appMode).toBe("local");
    expect(config.apiUrl).toBe("https://api.portal-educacao-continuada.com.br");
    expect(config.canShowRealMeetLink).toBe(true);
    expect(config.canUseAdminFeatures).toBe(true);
    expect(config.canUseTeacherFeatures).toBe(false);
  });

  it("permite modo demo sem API real", () => {
    const config = buildWebConfig({
      MODE: "production",
      BASE_URL: "/portal-estudos-espiritas-ai/",
      VITE_APP_MODE: "demo",
      VITE_API_URL: "",
    });

    expect(config.appMode).toBe("demo");
    expect(config.apiUrl).toBeNull();
    expect(config.canShowRealMeetLink).toBe(false);
  });

  it("rejeita modo desconhecido", () => {
    expect(() =>
      buildWebConfig({
        MODE: "production",
        VITE_APP_MODE: "prod",
      }),
    ).toThrow("VITE_APP_MODE");
  });

  it("rejeita API ausente, HTTP, localhost, loopback, credenciais, query, hash e path em produção", () => {
    const invalidValues = [
      "",
      "http://api.portal-educacao-continuada.com.br",
      "https://localhost:3333",
      "https://127.0.0.1:3333",
      "https://[::1]:3333",
      "https://user:pass@api.portal-educacao-continuada.com.br",
      "https://api.portal-educacao-continuada.com.br?x=1",
      "https://api.portal-educacao-continuada.com.br#x",
      "https://api.portal-educacao-continuada.com.br/api",
    ];

    for (const value of invalidValues) {
      expect(() =>
        buildWebConfig({
          ...productionLocalSource,
          VITE_API_URL: value,
        }),
      ).toThrow();
    }
  });

  it("rejeita flags booleanas fora de true ou false", () => {
    for (const value of ["1", "0", "yes", "no", "sim"]) {
      expect(() =>
        buildWebConfig({
          ...productionLocalSource,
          VITE_SHOW_REAL_MEET_LINK: value,
        }),
      ).toThrow("VITE_SHOW_REAL_MEET_LINK");
    }
  });

  it("rejeita nomes VITE com aparência de segredo", () => {
    expect(() =>
      buildWebConfig({
        ...productionLocalSource,
        VITE_JWT_SECRET: "secret",
      }),
    ).toThrow("VITE_JWT_SECRET");
  });
});
