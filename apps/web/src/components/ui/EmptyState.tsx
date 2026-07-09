import type { ReactNode } from "react";

import { Card } from "./Card";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => {
  return (
    <Card className="empty-state" tone="soft">
      <div className="empty-state__icon" aria-hidden="true">
        +
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </Card>
  );
};
