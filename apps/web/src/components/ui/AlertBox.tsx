import type { ReactNode } from "react";

import { cn } from "../../app/cn";

interface AlertBoxProps {
  title: string;
  children: ReactNode;
  tone?: "info" | "success" | "warning";
  className?: string;
}

export const AlertBox = ({
  title,
  children,
  tone = "info",
  className,
}: AlertBoxProps) => {
  return (
    <section
      className={cn("alert-box", `alert-box--${tone}`, className)}
      role={tone === "warning" ? "alert" : "status"}
    >
      <div className="alert-box__icon" aria-hidden="true">
        {tone === "warning" ? "!" : tone === "success" ? "OK" : "i"}
      </div>
      <div className="alert-box__body">
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
    </section>
  );
};
