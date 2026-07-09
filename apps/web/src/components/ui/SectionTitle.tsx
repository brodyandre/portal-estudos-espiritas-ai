import type { ReactNode } from "react";

import { cn } from "../../app/cn";

interface SectionTitleProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const SectionTitle = ({
  title,
  description,
  action,
  className,
}: SectionTitleProps) => {
  return (
    <div className={cn("section-title", className)}>
      <div className="section-title__body">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-title__action">{action}</div> : null}
    </div>
  );
};
