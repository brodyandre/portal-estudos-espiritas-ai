import type { DemoFlowStep } from "../../data/demo";
import { Card } from "../ui/Card";
import { StatusTag } from "../ui/StatusTag";

interface FlowStepCardProps {
  step: DemoFlowStep;
}

const stepStateMap = {
  pending: "attention",
  active: "active",
  done: "published",
} as const;

export const FlowStepCard = ({ step }: FlowStepCardProps) => {
  return (
    <Card className="flow-step-card" tone={step.state === "active" ? "brand" : "soft"}>
      <div className="flow-step-card__number" aria-hidden="true">
        {step.step}
      </div>
      <div className="flow-step-card__body">
        <div className="flow-step-card__header">
          <h3>{step.title}</h3>
          {step.state ? <StatusTag tone={stepStateMap[step.state]} /> : null}
        </div>
        <p>{step.description}</p>
      </div>
    </Card>
  );
};
