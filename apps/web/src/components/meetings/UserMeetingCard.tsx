import type {
  UserStudyMeeting,
  UserStudyMeetingGroup,
} from "../../types/userStudyMeetings";
import {
  formatUserMeetingStart,
  formatUserMeetingTimeRange,
  getUserMeetingDurationMinutes,
} from "../../utils/userStudyMeetings";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { MeetAccessButton } from "./MeetAccessButton";
import { MeetingStatusBadge } from "./MeetingStatusBadge";

interface UserMeetingCardProps {
  group: UserStudyMeetingGroup;
  meeting: UserStudyMeeting;
  title?: string;
}

export const UserMeetingCard = ({
  group,
  meeting,
  title = "Encontro do seu grupo",
}: UserMeetingCardProps) => {
  const durationMinutes = getUserMeetingDurationMinutes(meeting);

  return (
    <Card className="user-meetings-card" tone="brand">
      <div className="user-meetings-card__header">
        <div>
          <p className="card-eyebrow">{title}</p>
          <h2>{meeting.title}</h2>
        </div>
        <MeetingStatusBadge status={meeting.status} />
      </div>

      <div className="user-meetings-card__meta">
        <Badge tone="sand">{group.name}</Badge>
        <span>{formatUserMeetingStart(meeting.startsAt)}</span>
        <span>{formatUserMeetingTimeRange(meeting)}</span>
        {durationMinutes !== null ? <span>{durationMinutes} min</span> : null}
      </div>

      {meeting.description ? (
        <p className="user-meetings-card__description">{meeting.description}</p>
      ) : null}

      <div className="button-row">
        <MeetAccessButton meetUrl={meeting.meetUrl} />
      </div>
    </Card>
  );
};
