import {
  listMockKnowledgeFilesByGroup,
  type KnowledgeSupportFile,
} from "../mocks/knowledge";
import type { StudyGroupId } from "../types/studyGroup";
import { isDemoGroupSlug } from "../types/studyGroup";
import { loadWithFallback, type ServiceResult } from "./api";

type PublicKnowledgeGroupId = "emmanuel" | "a_caminho_da_luz";

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

export const getPublicKnowledgeGroupId = (groupId: StudyGroupId): PublicKnowledgeGroupId | null => {
  if (groupId === "emmanuel") {
    return "emmanuel";
  }

  if (groupId === "a-caminho-da-luz") {
    return "a_caminho_da_luz";
  }

  return null;
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

const mapApiKnowledgeFile = (
  file: ApiKnowledgeFile,
  groupSlug: StudyGroupId,
): KnowledgeSupportFile => {
  const normalizedType = mapApiType(file.type);

  return {
    id: file.id,
    title: file.title,
    filename: file.filename,
    path:
      file.path ??
      `data/knowledge/${getPublicKnowledgeGroupId(groupSlug) ?? groupSlug}/${file.filename}`,
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

export const listKnowledgeFilesByGroup = (
  groupSlug: StudyGroupId,
): Promise<ServiceResult<KnowledgeSupportFile[]>> => {
  const publicKnowledgeGroupId = getPublicKnowledgeGroupId(groupSlug);

  if (!publicKnowledgeGroupId) {
    return Promise.resolve({
      data: [],
      source: "api",
      notice: null,
    });
  }

  return loadWithFallback<ApiKnowledgeFile[], KnowledgeSupportFile[]>({
    path: `/api/knowledge/${publicKnowledgeGroupId}/files`,
    fallback: () => (isDemoGroupSlug(groupSlug) ? listMockKnowledgeFilesByGroup(groupSlug) : []),
    mapData: (items) =>
      items.map((item) => mapApiKnowledgeFile(item, groupSlug)).sort(sortKnowledgeFiles),
    friendlyMessage:
      "Os materiais de apoio do livro selecionado nao puderam ser atualizados agora. Mantivemos a base demonstrativa local disponivel para voce continuar o estudo.",
  });
};
