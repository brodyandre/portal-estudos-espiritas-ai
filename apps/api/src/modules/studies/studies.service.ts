import { AppError } from "../../lib/app-error";
import { studyGroups, type StudyGroup, type StudyGroupId } from "../../data/studies";
import {
  createDefaultStudiesRepository,
  StudyGroupCatalogUnavailableError,
  type StudiesRepository,
} from "./studies.repository";

const repository = createDefaultStudiesRepository();

const toCatalogUnavailableError = (error: unknown): never => {
  if (error instanceof StudyGroupCatalogUnavailableError) {
    throw new AppError({
      statusCode: 503,
      code: "STUDY_GROUP_CATALOG_UNAVAILABLE",
      message: "Catalogo de grupos de estudo indisponivel.",
      details: { reason: error.reason },
    });
  }

  throw error;
};

export const listStudies = async (
  studiesRepository: StudiesRepository = repository,
): Promise<StudyGroup[]> => {
  try {
    return await studiesRepository.list();
  } catch (error) {
    return toCatalogUnavailableError(error);
  }
};

export const isStudyGroupId = (value: string): value is StudyGroupId => {
  return studyGroups.some((study) => study.id === value);
};

export const getStudyBySlug = async (
  slug: string,
  studiesRepository: StudiesRepository = repository,
): Promise<StudyGroup | undefined> => {
  try {
    return (await studiesRepository.findBySlug(slug)) ?? undefined;
  } catch (error) {
    return toCatalogUnavailableError(error);
  }
};
