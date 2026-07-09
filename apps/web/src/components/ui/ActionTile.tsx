import type { ReactNode } from "react";

import { cn } from "../../app/cn";
import { Button } from "./Button";
import { Card } from "./Card";

interface ActionTileProps {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: string;
  actionLabel?: string;
  to?: string;
  href?: string;
  footer?: ReactNode;
  tone?: "default" | "soft" | "brand" | "sand";
  className?: string;
}

export const ActionTile = ({
  eyebrow,
  title,
  description,
  meta,
  actionLabel,
  to,
  href,
  footer,
  tone = "default",
  className,
}: ActionTileProps) => {
  return (
    <Card className={cn("action-tile", className)} tone={tone}>
      {eyebrow ? <p className="action-tile__eyebrow">{eyebrow}</p> : null}
      <h3>{title}</h3>
      <p className="action-tile__description">{description}</p>
      {meta ? <p className="action-tile__meta">{meta}</p> : null}
      {footer}
      {actionLabel && to ? (
        <Button className="action-tile__button" to={to} variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
      {actionLabel && href ? (
        <Button className="action-tile__button" href={href} target="_blank" rel="noreferrer" variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
};
