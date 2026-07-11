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

  return (
    <Card className="group-card" tone="default">
      <div className="group-card__top">
        <Badge tone="brand">{group.participantCount} participantes</Badge>
        <StatusTag tone={group.nextLesson.status === "hoje" ? "active" : "upcoming"} />
      </div>

      <div className="group-card__content">
        <h3>{group.name}</h3>
        <p>{group.description}</p>
      </div>

      <dl className="group-card__meta">
        <div>
          <dt>Encontro</dt>
          <dd>
            {group.meetingDay}, {group.meetingTime}
          </dd>
        </div>
        <div>
          <dt>Proxima aula</dt>
          <dd>{group.nextLesson.scheduledLabel}</dd>
        </div>
        <div>
          <dt>Tema</dt>
          <dd>{group.nextLesson.title}</dd>
        </div>
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
