import type { ReactNode } from "react";

import { Badge } from "../ui/Badge";

interface MetaItem {
  label: string;
  value: string;
}

interface ProfileHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  badge?: string;
  meta?: MetaItem[];
  actions?: ReactNode;
  visual?: ReactNode;
}

export const ProfileHeader = ({
  eyebrow,
  title,
  description,
  badge,
  meta,
  actions,
  visual,
}: ProfileHeaderProps) => {
  return (
    <section className="profile-header">
      <div className="profile-header__body">
        {badge ? <Badge tone="sand">{badge}</Badge> : null}
        {eyebrow ? <p className="profile-header__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p className="profile-header__description">{description}</p>

        {meta && meta.length > 0 ? (
          <dl className="profile-header__meta">
            {meta.map((item) => (
              <div className="profile-header__meta-item" key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="profile-header__side">
        {visual ? <div className="profile-header__visual">{visual}</div> : null}
        {actions ? <div className="profile-header__actions">{actions}</div> : null}
      </div>
    </section>
  );
};
