import type { InputHTMLAttributes } from "react";

import { cn } from "../../app/cn";

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
}

export const TextInput = ({
  id,
  label,
  helperText,
  error,
  className,
  ...rest
}: TextInputProps) => {
  return (
    <label className={cn("field", className)} htmlFor={id}>
      <span className="field__label">{label}</span>
      <input className={cn("field__control", error && "field__control--error")} id={id} {...rest} />
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helperText ? <span className="field__message">{helperText}</span> : null}
    </label>
  );
};
