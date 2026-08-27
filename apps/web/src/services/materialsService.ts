import { listMockMaterials, type DemoMaterial } from "../mocks";
import type { StudyGroupId } from "../types/studyGroup";
import { isDemoGroupSlug } from "../types/studyGroup";
import { formatPublishedLabel, mapMaterialKind } from "./formatters";
import { loadWithFallback } from "./api";

export type StudyMaterial = Omit<DemoMaterial, "groupSlug"> & {
  groupSlug: StudyGroupId;
};

interface ApiMaterial {
  id: string;
  groupId: string;
  title: string;
  type: "reading" | "summary" | "guide" | "activity";
  lessonId: string | null;
  sourcePath: string | null;
  format: "markdown" | "internal";
  description: string;
  publishedAt: string;
}

const mapMaterial = (material: ApiMaterial): StudyMaterial => {
  return {
    id: material.id,
    groupSlug: material.groupId,
    title: material.title,
    kind: mapMaterialKind(material.type),
    description: material.description,
    lessonId: material.lessonId,
    sourcePath: material.sourcePath,
    format: material.format,
    publishedAt: material.publishedAt,
    publishedLabel: formatPublishedLabel(material.publishedAt),
  };
};

export const listMaterials = (groupSlug?: StudyGroupId) => {
  return loadWithFallback<ApiMaterial[], StudyMaterial[]>({
    path: "/api/materials",
    query: groupSlug ? { groupId: groupSlug } : undefined,
    fallback: () =>
      listMockMaterials({
        groupSlug: groupSlug && isDemoGroupSlug(groupSlug) ? groupSlug : undefined,
      }),
    mapData: (items) => items.map(mapMaterial),
    friendlyMessage:
      "Os materiais da semana nao puderam ser atualizados agora. Mantivemos a colecao demonstrativa disponivel para consulta.",
  });
};
