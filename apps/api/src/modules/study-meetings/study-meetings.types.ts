export type StudyMeetingDateInput = Date | string;
export type StudyMeetingSortOrder = "asc" | "desc";

export const DEFAULT_STUDY_MEETINGS_PAGE = 1;
export const DEFAULT_STUDY_MEETINGS_PAGE_SIZE = 10;
export const MAX_STUDY_MEETINGS_PAGE_SIZE = 50;
export const STUDY_MEETING_ID_MAX_LENGTH = 160;
export const STUDY_MEETING_TITLE_MAX_LENGTH = 120;
export const STUDY_MEETING_DESCRIPTION_MAX_LENGTH = 320;
export const STUDY_MEETING_CANCELLATION_REASON_MAX_LENGTH = 320;

export interface StudyMeetingRecord {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  canceledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudyMeetingInput {
  groupId: string;
  title: string;
  description?: string | null;
  startsAt: StudyMeetingDateInput;
  endsAt: StudyMeetingDateInput;
}

export interface UpdateStudyMeetingInput {
  meetingId: string;
  groupId: string;
  title?: string;
  description?: string | null;
  startsAt?: StudyMeetingDateInput;
  endsAt?: StudyMeetingDateInput;
}

export interface CancelStudyMeetingInput {
  meetingId: string;
  groupId: string;
  canceledAt: StudyMeetingDateInput;
  cancellationReason: string | null;
}

export interface StudyMeetingListInput {
  groupId: string;
  page: number;
  pageSize: number;
  sortOrder: StudyMeetingSortOrder;
  includeCanceled: boolean;
}

export interface StudyMeetingListResult {
  items: StudyMeetingRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GetAdminStudyMeetingInput {
  groupId: string;
  meetingId: string;
}

export interface CreateAdminStudyMeetingInput {
  groupId: string;
  title: string;
  description?: string | null;
  startsAt: StudyMeetingDateInput;
  endsAt: StudyMeetingDateInput;
}

export interface UpdateAdminStudyMeetingInput {
  groupId: string;
  meetingId: string;
  title?: string;
  description?: string | null;
  startsAt?: StudyMeetingDateInput;
  endsAt?: StudyMeetingDateInput;
}

export interface CancelAdminStudyMeetingInput {
  groupId: string;
  meetingId: string;
  cancellationReason: string | null;
}

export class InvalidStudyMeetingTimeRangeError extends RangeError {
  constructor(message = "Study meeting startsAt must be earlier than endsAt.") {
    super(message);
    this.name = "InvalidStudyMeetingTimeRangeError";
  }
}

export class InvalidStudyMeetingListInputError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStudyMeetingListInputError";
  }
}

export class StudyMeetingGroupNotFoundError extends Error {
  constructor(groupId: string) {
    super(`Study group ${groupId} was not found.`);
    this.name = "StudyMeetingGroupNotFoundError";
  }
}
