import type { UserStudyMeeting } from "../../types/userStudyMeetings";
import {
  formatUserMeetingStart,
  formatUserMeetingTimeRange,
} from "../../utils/userStudyMeetings";
import { MeetAccessButton } from "./MeetAccessButton";
import { MeetingStatusBadge } from "./MeetingStatusBadge";

interface UserMeetingListProps {
  meetings: UserStudyMeeting[];
}

export const UserMeetingList = ({ meetings }: UserMeetingListProps) => {
  if (meetings.length === 0) {
    return null;
  }

  return (
    <div className="user-meetings-list">
      {meetings.map((meeting) => (
        <article className="user-meetings-list__item" key={meeting.id}>
          <div>
            <div className="user-meetings-list__header">
              <strong>{meeting.title}</strong>
              <MeetingStatusBadge status={meeting.status} />
            </div>
            <p className="user-meetings__note">
              {formatUserMeetingStart(meeting.startsAt)} ·{" "}
              {formatUserMeetingTimeRange(meeting)}
            </p>
          </div>
          <MeetAccessButton meetUrl={meeting.meetUrl} />
        </article>
      ))}
    </div>
  );
};
