interface SanitizedTextOptions {
  maxLength: number;
}

const RISKY_QUOTE_PATTERN =
  /(^|\n)\s*>|["“”][^"“”]{35,}["“”]|['‘’][^'‘’]{35,}['‘’]/u;

export const normalizeInputText = (value: string): string => {
  return value.replace(/\r\n/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();
};

export const sanitizeGeneratedText = (
  value: string,
  options: SanitizedTextOptions,
): { ok: true; text: string } | { ok: false; reason: string } => {
  const cleaned = normalizeInputText(value.replace(/```[\s\S]*?```/gu, ""));

  if (!cleaned) {
    return {
      ok: false,
      reason: "O modelo nao retornou texto suficiente para montar um rascunho seguro.",
    };
  }

  if (cleaned.length > options.maxLength) {
    return {
      ok: false,
      reason: "O texto ficou longo demais para revisao simples e segura.",
    };
  }

  if (RISKY_QUOTE_PATTERN.test(cleaned)) {
    return {
      ok: false,
      reason: "O texto retornou trechos que parecem citacoes literais.",
    };
  }

  return { ok: true, text: cleaned };
};

export const extractListItems = (value: string): string[] => {
  return normalizeInputText(value)
    .split("\n")
    .map((line) => line.replace(/^[-*•\d.)\s]+/u, "").trim())
    .filter((line) => line.length > 0);
};

export const formatList = (items: string[]): string => {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
};

export const buildShortExcerpt = (value: string, maxLength = 260): string => {
  const cleaned = normalizeInputText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, maxLength);
  const lastDot = truncated.lastIndexOf(".");

  if (lastDot > maxLength * 0.55) {
    return truncated.slice(0, lastDot + 1).trim();
  }

  return `${truncated.trim()}...`;
};

export const buildSentenceList = (value: string, maxItems = 3): string[] => {
  return normalizeInputText(value)
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, maxItems);
};
