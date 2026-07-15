export interface AdminStudyMeeting {
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

export interface AdminStudyMeetingListParams {
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
  includeCanceled?: boolean;
}

export interface AdminStudyMeetingListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminStudyMeetingListResult {
  items: AdminStudyMeeting[];
  meta: AdminStudyMeetingListMeta;
}

export interface CreateAdminStudyMeetingInput {
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
}

export interface UpdateAdminStudyMeetingInput {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
}

export interface CancelAdminStudyMeetingInput {
  cancellationReason: string;
}

export type AdminStudyMeetingDerivedStatus =
  | "scheduled"
  | "in_progress"
  | "ended"
  | "canceled";
