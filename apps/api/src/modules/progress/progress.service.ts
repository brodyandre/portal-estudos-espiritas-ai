import { progress, progressOverview, type StudentProgress } from "../../data/progress";

export interface ProgressResponse {
  overview: typeof progressOverview;
  items: StudentProgress[];
}

export const getProgress = (filters?: {
  studentId?: string;
  groupId?: string;
}): ProgressResponse => {
  const items = progress.filter((entry) => {
    if (filters?.studentId && entry.studentId !== filters.studentId) {
      return false;
    }

    if (filters?.groupId && entry.groupId !== filters.groupId) {
      return false;
    }

    return true;
  });

  return {
    overview: progressOverview,
    items,
  };
};
