import type { UserStudyMeetingStatus } from "../../types/userStudyMeetings";
import { StatusTag } from "../ui/StatusTag";

interface MeetingStatusBadgeProps {
  status: UserStudyMeetingStatus;
}

export const MeetingStatusBadge = ({ status }: MeetingStatusBadgeProps) => (
  <StatusTag
    label={status === "ongoing" ? "Em andamento" : "Agendado"}
    tone={status === "ongoing" ? "active" : "upcoming"}
  />
);
