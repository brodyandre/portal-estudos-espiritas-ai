import { materials, type StudyMaterial } from "../../data/materials";

export const listMaterials = (filters?: {
  groupId?: string;
  type?: StudyMaterial["type"];
}): StudyMaterial[] => {
  return materials.filter((material) => {
    if (filters?.groupId && material.groupId !== filters.groupId) {
      return false;
    }

    if (filters?.type && material.type !== filters.type) {
      return false;
    }

    return true;
  });
};
