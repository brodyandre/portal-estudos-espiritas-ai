import { describe, expect, it } from "vitest";

import {
  formatEmailExpiryLabel,
  TRANSACTIONAL_EMAIL_BRAND_NAME,
  TRANSACTIONAL_EMAIL_TIME_ZONE,
} from "../src/modules/auth/transactional-email";

describe("transactional email helpers", () => {
  it("formata expiracao com timezone institucional deterministico", () => {
    expect(TRANSACTIONAL_EMAIL_BRAND_NAME).toBe("Portal de Educação Continuada");
    expect(TRANSACTIONAL_EMAIL_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(formatEmailExpiryLabel("2026-08-11T18:30:00.000Z")).toBe(
      "11/08/2026, 15:30 (horário de Brasília)",
    );
  });
});
