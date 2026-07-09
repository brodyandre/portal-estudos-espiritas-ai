import type { TextareaHTMLAttributes } from "react";

import { cn } from "../../app/cn";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
}

export const TextArea = ({
  id,
  label,
  helperText,
  error,
  className,
  ...rest
}: TextAreaProps) => {
  return (
    <label className={cn("field", className)} htmlFor={id}>
      <span className="field__label">{label}</span>
      <textarea
        className={cn("field__control field__control--textarea", error && "field__control--error")}
        id={id}
        {...rest}
      />
      {error ? <span className="field__message field__message--error">{error}</span> : null}
      {!error && helperText ? <span className="field__message">{helperText}</span> : null}
    </label>
  );
};
