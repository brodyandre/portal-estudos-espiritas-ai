import {
  listMockKnowledgeFilesByGroup,
  type KnowledgeSupportFile,
} from "../mocks/knowledge";
import type { GroupSlug } from "../mocks";
import { loadWithFallback } from "./api";

type ApiKnowledgeGroupId = "emmanuel" | "a_caminho_da_luz";

interface ApiKnowledgeFile {
  id: string;
  title: string;
  filename: string;
  path?: string;
  group: string;
  book: string;
  type: string;
  tags: string[];
  summary: string;
  teacherReviewRecommended: boolean;
  sensitiveTopics: string[];
}

const apiGroupBySlug: Record<GroupSlug, ApiKnowledgeGroupId> = {
  emmanuel: "emmanuel",
  "a-caminho-da-luz": "a_caminho_da_luz",
};

const normalizeText = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
};

const mapApiGroupToSlug = (group: string): GroupSlug => {
  return normalizeText(group) === normalizeText("A Caminho da Luz")
    ? "a-caminho-da-luz"
    : "emmanuel";
};

const trimSummary = (value: string) => {
  const compact = value.replace(/\s+/gu, " ").trim();

  if (compact.length <= 220) {
    return compact;
  }

  return `${compact.slice(0, 217).trim()}...`;
};

const mapApiTypeToLabel = (type: string): KnowledgeSupportFile["typeLabel"] => {
  switch (type) {
    case "capitulo":
      return "Capitulo";
    case "faq":
      return "FAQ";
    case "palavras_chave":
      return "Palavras-chave";
    case "visao_geral":
      return "Visao geral";
    default:
      return "Tema";
  }
};

const mapApiType = (type: string): KnowledgeSupportFile["type"] => {
  switch (type) {
    case "capitulo":
    case "faq":
    case "palavras_chave":
    case "visao_geral":
      return type;
    default:
      return "tema";
  }
};

const mapApiActionLabel = (type: string): KnowledgeSupportFile["actionLabel"] => {
  return type === "faq" || type === "palavras_chave" ? "Usar como apoio" : "Ver resumo";
};

const mapApiKnowledgeFile = (file: ApiKnowledgeFile): KnowledgeSupportFile => {
  const groupSlug = mapApiGroupToSlug(file.group);
  const normalizedType = mapApiType(file.type);

  return {
    id: file.id,
    title: file.title,
    filename: file.filename,
    path:
      file.path ??
      `data/knowledge/${
        groupSlug === "emmanuel" ? "emmanuel" : "a_caminho_da_luz"
      }/${file.filename}`,
    groupSlug,
    groupName: file.group,
    bookTitle: file.book,
    type: normalizedType,
    typeLabel: mapApiTypeToLabel(normalizedType),
    tags: file.tags.slice(0, 5),
    summary: trimSummary(file.summary),
    teacherReviewRecommended: file.teacherReviewRecommended,
    sensitiveTopics: [...file.sensitiveTopics],
    actionLabel: mapApiActionLabel(normalizedType),
  };
};

const sortKnowledgeFiles = (left: KnowledgeSupportFile, right: KnowledgeSupportFile) => {
  const typeOrder: Record<KnowledgeSupportFile["type"], number> = {
    visao_geral: 1,
    tema: 2,
    capitulo: 3,
    faq: 4,
    palavras_chave: 5,
  };

  if (typeOrder[left.type] !== typeOrder[right.type]) {
    return typeOrder[left.type] - typeOrder[right.type];
  }

  return left.title.localeCompare(right.title);
};

export type { KnowledgeSupportFile } from "../mocks/knowledge";

export const listKnowledgeFilesByGroup = (groupSlug: GroupSlug) => {
  return loadWithFallback<ApiKnowledgeFile[], KnowledgeSupportFile[]>({
    path: `/api/knowledge/${apiGroupBySlug[groupSlug]}/files`,
    fallback: () => listMockKnowledgeFilesByGroup(groupSlug),
    mapData: (items) => items.map(mapApiKnowledgeFile).sort(sortKnowledgeFiles),
    friendlyMessage:
      "Os materiais de apoio do livro selecionado nao puderam ser atualizados agora. Mantivemos a base demonstrativa local disponivel para voce continuar o estudo.",
  });
};
