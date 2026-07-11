import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl, getWhatsAppPhoneLabel } from "../utils/whatsapp";

describe("whatsapp utils", () => {
  it("gera link wa.me com telefone limpo e mensagem codificada", () => {
    const message = "Olá, Mariana! Tudo bem?";
    const url = buildWhatsAppUrl("+55 (11) 99876-1101", message);

    expect(url).toBe("https://wa.me/5511998761101?text=Ol%C3%A1%2C%20Mariana!%20Tudo%20bem%3F");
  });

  it("retorna o telefone limpo para exibir ao professor", () => {
    expect(getWhatsAppPhoneLabel("+55 (11) 99876-1101")).toBe("5511998761101");
  });
});
