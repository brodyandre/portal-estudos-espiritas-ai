import { studyGroups, type StudyGroup, type StudyGroupId } from "../../data/studies";

export const listStudies = (): StudyGroup[] => {
  return studyGroups;
};

export const getStudyBySlug = (slug: string): StudyGroup | undefined => {
  return studyGroups.find((study) => study.id === slug);
};

export const isStudyGroupId = (value: string): value is StudyGroupId => {
  return studyGroups.some((study) => study.id === value);
};
