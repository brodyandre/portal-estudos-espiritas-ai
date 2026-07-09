import { listMockMaterials, type DemoMaterial, type GroupSlug } from "../mocks";
import { formatPublishedLabel, mapMaterialKind } from "./formatters";
import { loadWithFallback } from "./api";

interface ApiMaterial {
  id: string;
  groupId: GroupSlug;
  title: string;
  type: "reading" | "summary" | "guide" | "activity";
  lessonId: string | null;
  sourcePath: string | null;
  format: "markdown" | "internal";
  description: string;
  publishedAt: string;
}

const mapMaterial = (material: ApiMaterial): DemoMaterial => {
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

export const listMaterials = (groupSlug?: GroupSlug) => {
  return loadWithFallback<ApiMaterial[], DemoMaterial[]>({
    path: "/api/materials",
    query: groupSlug ? { groupId: groupSlug } : undefined,
    fallback: () => listMockMaterials({ groupSlug }),
    mapData: (items) => items.map(mapMaterial),
    friendlyMessage:
      "Os materiais da semana nao puderam ser atualizados agora. Mantivemos a colecao demonstrativa disponivel para consulta.",
  });
};
