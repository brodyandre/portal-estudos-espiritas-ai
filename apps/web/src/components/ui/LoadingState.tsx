import { Card } from "./Card";

interface LoadingStateProps {
  title: string;
  description?: string;
}

export const LoadingState = ({ title, description }: LoadingStateProps) => {
  return (
    <Card className="loading-state" tone="soft" aria-live="polite" aria-busy="true">
      <div className="loading-state__spinner" aria-hidden="true" />
      <div className="loading-state__body">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        <div className="loading-state__line loading-state__line--long" />
        <div className="loading-state__line loading-state__line--medium" />
        <div className="loading-state__line loading-state__line--short" />
      </div>
    </Card>
  );
};
