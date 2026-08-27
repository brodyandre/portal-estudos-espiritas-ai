export type StudyGroupId = string;

export type DemoGroupSlug = "emmanuel" | "a-caminho-da-luz";

export interface StudyLesson {
  id: string;
  title: string;
  theme: string;
  scheduledAt: string;
  scheduledLabel: string;
  status: "proxima" | "hoje";
  teacherNote: string;
}

export interface StudyGroup {
  slug: StudyGroupId;
  name: string;
  meetingDay: string | null;
  meetingTime: string | null;
  participantCount: number | null;
  meetUrl: string | null;
  bookTitle: string;
  description: string | null;
  nextLesson: StudyLesson | null;
}

export const isDemoGroupSlug = (value: string): value is DemoGroupSlug => {
  return value === "emmanuel" || value === "a-caminho-da-luz";
};
