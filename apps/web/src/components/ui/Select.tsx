import type { SelectHTMLAttributes } from "react";

import { cn } from "../../app/cn";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  id: string;
  label: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select = ({
  id,
  label,
  options,
  helperText,
  error,
  className,
  ...rest
}: SelectProps) => {
  return (
    <label className={cn("field", className)} htmlFor={id}>
      <span className="field__label">{label}</span>
      <select className={cn("field__control", error && "field__control--error")} id={id} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helperText ? <span className="field__message">{helperText}</span> : null}
    </label>
  );
};
