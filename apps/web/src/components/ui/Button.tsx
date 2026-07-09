import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../app/cn";

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "regular" | "compact";
  fullWidth?: boolean;
};

type LinkButtonProps = CommonProps & {
  to: string;
  href?: never;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">;

type AnchorButtonProps = CommonProps & {
  href: string;
  to?: never;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children">;

type NativeButtonProps = CommonProps & {
  to?: never;
  href?: never;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export type ButtonProps = LinkButtonProps | AnchorButtonProps | NativeButtonProps;

const buildClassName = ({
  variant = "primary",
  size = "regular",
  fullWidth,
  className,
}: Pick<ButtonProps, "variant" | "size" | "fullWidth" | "className">) => {
  return cn(
    "button",
    `button--${variant}`,
    `button--${size}`,
    fullWidth && "button--full",
    className,
  );
};

export const Button = (props: ButtonProps) => {
  const className = buildClassName(props);

  if ("to" in props && props.to) {
    const { children, to, variant: _variant, size: _size, fullWidth: _fullWidth, ...rest } = props;
    return (
      <Link className={className} to={to} {...rest}>
        {children}
      </Link>
    );
  }

  if ("href" in props && props.href) {
    const { children, href, variant: _variant, size: _size, fullWidth: _fullWidth, ...rest } = props;
    return (
      <a className={className} href={href} {...rest}>
        {children}
      </a>
    );
  }

  const nativeProps = props as NativeButtonProps;
  const {
    children,
    variant: _variant,
    size: _size,
    fullWidth: _fullWidth,
    type = "button",
    ...rest
  } = nativeProps;
  return (
    <button className={className} type={type} {...rest}>
      {children}
    </button>
  );
};
