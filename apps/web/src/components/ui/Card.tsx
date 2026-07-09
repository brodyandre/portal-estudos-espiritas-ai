import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "../../app/cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: "default" | "soft" | "brand" | "sand";
  padded?: boolean;
  children: ReactNode;
}

export const Card = ({
  as,
  tone = "default",
  padded = true,
  className,
  children,
  ...rest
}: CardProps) => {
  const Component = as ?? "section";

  return (
    <Component
      className={cn(
        "card",
        `card--${tone}`,
        padded && "card--padded",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
};
