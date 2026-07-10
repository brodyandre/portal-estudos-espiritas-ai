import knowledgeCatalog from "../../../../data/knowledge/index.json";

import type { GroupSlug } from "../mocks";
import { loadWithFallback } from "./api";

type ApiKnowledgeGroupId = "emmanuel" | "a_caminho_da_luz";
type KnowledgeFileType = "tema" | "capitulo" | "faq" | "palavras_chave" | "visao_geral";

interface ApiKnowledgeFile {
  id: string;
  title: string;
  filename: string;
  group: string;
  book: string;
  type: string;
  tags: string[];
  summary: string;
  teacherReviewRecommended: boolean;
  sensitiveTopics: string[];
}

interface KnowledgeCatalogFile {
  id: string;
  title: string;
  group: string;
  book: string;
  filename: string;
  path: string;
  type: string;
  tags: string[];
  description: string;
  sensitiveTopics: string[];
  teacherReviewRecommended: boolean;
}

interface KnowledgeCatalog {
  files: KnowledgeCatalogFile[];
}

export interface KnowledgeSupportFile {
  id: string;
  title: string;
  filename: string;
  path: string;
  groupSlug: GroupSlug;
  groupName: string;
  bookTitle: string;
  type: KnowledgeFileType;
  typeLabel: string;
  tags: string[];
  summary: string;
  teacherReviewRecommended: boolean;
  sensitiveTopics: string[];
  actionLabel: "Ver resumo" | "Usar como apoio";
}

const groupNameBySlug: Record<GroupSlug, string> = {
  emmanuel: "Emmanuel",
  "a-caminho-da-luz": "A Caminho da Luz",
};

const apiGroupBySlug: Record<GroupSlug, ApiKnowledgeGroupId> = {
  emmanuel: "emmanuel",
  "a-caminho-da-luz": "a_caminho_da_luz",
};

const visibleTypes = new Set<KnowledgeFileType>([
  "tema",
  "capitulo",
  "faq",
  "palavras_chave",
  "visao_geral",
]);

const knowledgeTypeLabels: Record<KnowledgeFileType, string> = {
  tema: "Tema",
  capitulo: "Capitulo",
  faq: "FAQ",
  palavras_chave: "Palavras-chave",
  visao_geral: "Visao geral",
};

const knowledgeTypeOrder: Record<KnowledgeFileType, number> = {
  visao_geral: 1,
  tema: 2,
  capitulo: 3,
  faq: 4,
  palavras_chave: 5,
};

const normalizeText = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
};

const isKnowledgeFileType = (value: string): value is KnowledgeFileType => {
  return visibleTypes.has(value as KnowledgeFileType);
};

const sortKnowledgeFiles = (left: KnowledgeSupportFile, right: KnowledgeSupportFile) => {
  if (knowledgeTypeOrder[left.type] !== knowledgeTypeOrder[right.type]) {
    return knowledgeTypeOrder[left.type] - knowledgeTypeOrder[right.type];
  }

  return left.title.localeCompare(right.title);
};

const mapKnowledgeActionLabel = (type: KnowledgeFileType): "Ver resumo" | "Usar como apoio" => {
  return type === "faq" || type === "palavras_chave" ? "Usar como apoio" : "Ver resumo";
};

const trimSummary = (value: string) => {
  const compact = value.replace(/\s+/gu, " ").trim();

  if (compact.length <= 220) {
    return compact;
  }

  return `${compact.slice(0, 217).trim()}...`;
};

const mapApiGroupToSlug = (group: string): GroupSlug => {
  return normalizeText(group) === normalizeText(groupNameBySlug["a-caminho-da-luz"])
    ? "a-caminho-da-luz"
    : "emmanuel";
};

const mapKnowledgeFile = (file: {
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
}): KnowledgeSupportFile | null => {
  if (!isKnowledgeFileType(file.type)) {
    return null;
  }

  const groupSlug = mapApiGroupToSlug(file.group);

  return {
    id: file.id,
    title: file.title,
    filename: file.filename,
    path: file.path ?? "",
    groupSlug,
    groupName: groupNameBySlug[groupSlug],
    bookTitle: file.book,
    type: file.type,
    typeLabel: knowledgeTypeLabels[file.type],
    tags: file.tags.slice(0, 5),
    summary: trimSummary(file.summary),
    teacherReviewRecommended: file.teacherReviewRecommended,
    sensitiveTopics: [...file.sensitiveTopics],
    actionLabel: mapKnowledgeActionLabel(file.type),
  };
};

const listLocalKnowledgeFiles = (groupSlug: GroupSlug): KnowledgeSupportFile[] => {
  const catalog = knowledgeCatalog as KnowledgeCatalog;
  const expectedGroupName = groupNameBySlug[groupSlug];

  return catalog.files
    .filter((file) => {
      return (
        isKnowledgeFileType(file.type) &&
        normalizeText(file.group) === normalizeText(expectedGroupName)
      );
    })
    .map((file) =>
      mapKnowledgeFile({
        ...file,
        summary: file.description,
      }),
    )
    .filter((file): file is KnowledgeSupportFile => file !== null)
    .sort(sortKnowledgeFiles);
};

const mapApiKnowledgeFile = (file: ApiKnowledgeFile): KnowledgeSupportFile | null => {
  return mapKnowledgeFile({
    ...file,
    path: "",
  });
};

export const listKnowledgeFilesByGroup = (groupSlug: GroupSlug) => {
  return loadWithFallback<ApiKnowledgeFile[], KnowledgeSupportFile[]>({
    path: `/api/knowledge/${apiGroupBySlug[groupSlug]}/files`,
    fallback: () => listLocalKnowledgeFiles(groupSlug),
    mapData: (items) =>
      items
        .map(mapApiKnowledgeFile)
        .filter((file): file is KnowledgeSupportFile => file !== null)
        .sort(sortKnowledgeFiles),
    friendlyMessage:
      "Os materiais de apoio do livro selecionado nao puderam ser atualizados agora. Mantivemos a base demonstrativa disponivel para voce continuar o estudo.",
  });
};
