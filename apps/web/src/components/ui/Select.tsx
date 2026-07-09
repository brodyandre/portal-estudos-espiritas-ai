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
}

export const Select = ({
  id,
  label,
  options,
  helperText,
  className,
  ...rest
}: SelectProps) => {
  return (
    <label className={cn("field", className)} htmlFor={id}>
      <span className="field__label">{label}</span>
      <select className="field__control" id={id} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <span className="field__message">{helperText}</span> : null}
    </label>
  );
};
