import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../app/cn";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: "neutral" | "brand" | "sand" | "success";
}

export const Badge = ({ children, tone = "neutral", className, ...rest }: BadgeProps) => {
  return (
    <span className={cn("badge", `badge--${tone}`, className)} {...rest}>
      {children}
    </span>
  );
};
