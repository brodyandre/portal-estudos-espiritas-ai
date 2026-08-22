import type { DemoGroup } from "../../data/demo";
import { PUBLIC_MEET_NOTICE, appConfig } from "../../config/appMode";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { StatusTag } from "../ui/StatusTag";

interface GroupCardProps {
  group: DemoGroup;
  actionLabel: string;
  actionTo?: string;
  actionHref?: string;
}

export const GroupCard = ({ group, actionLabel, actionTo, actionHref }: GroupCardProps) => {
  const canOpenMeet = Boolean(appConfig.canShowRealMeetLink && actionHref);
  const hasSchedule = Boolean(group.meetingDay && group.meetingTime);

  return (
    <Card className="group-card" tone="default">
      <div className="group-card__top">
        {group.participantCount !== null ? (
          <Badge tone="brand">{group.participantCount} participantes</Badge>
        ) : null}
        {group.nextLesson ? (
          <StatusTag tone={group.nextLesson.status === "hoje" ? "active" : "upcoming"} />
        ) : null}
      </div>

      <div className="group-card__content">
        <h3>{group.name}</h3>
        {group.description ? <p>{group.description}</p> : null}
      </div>

      <dl className="group-card__meta">
        {hasSchedule ? (
          <div>
            <dt>Encontro</dt>
            <dd>
              {group.meetingDay}, {group.meetingTime}
            </dd>
          </div>
        ) : null}
        {group.nextLesson ? (
          <>
            <div>
              <dt>Proxima aula</dt>
              <dd>{group.nextLesson.scheduledLabel}</dd>
            </div>
            <div>
              <dt>Tema</dt>
              <dd>{group.nextLesson.title}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {actionTo ? <Button to={actionTo}>{actionLabel}</Button> : null}
      {canOpenMeet && actionHref ? (
        <Button href={actionHref} rel="noreferrer" target="_blank">
          {actionLabel}
        </Button>
      ) : actionHref ? (
        <p className="student-panel__note">{PUBLIC_MEET_NOTICE}</p>
      ) : null}
    </Card>
  );
};
