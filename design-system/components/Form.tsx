"use client";

import { forwardRef, useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

/* -----------------------------------------------------------------------------
   Field — label + control + hint/error, wired together.

   `Field` owns the id and the aria-describedby relationship so no call site has
   to remember them. It passes both down through a render prop rather than
   cloning children, which keeps the control's own typing intact.
   ----------------------------------------------------------------------------- */

export interface FieldProps {
  label: string;
  hint?: string;
  /** When set, the control renders invalid and the hint is replaced. */
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={id}>
        {label}
        {required && (
          <span className="ds-label__required" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
      })}

      {message && (
        <span
          id={messageId}
          className={error ? "ds-error-text" : "ds-hint"}
          role={error ? "alert" : undefined}
        >
          {message}
        </span>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   Controls
   ----------------------------------------------------------------------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Monospace + tighter tracking, for SHAs, repo names and digests. */
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, mono, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(
        "ds-input",
        invalid && "ds-input--invalid",
        mono && "ds-input--mono",
        className,
      )}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx("ds-textarea", invalid && "ds-textarea--invalid", className)}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx("ds-select", invalid && "ds-select--invalid", className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  hint?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className, ...rest },
  ref,
) {
  return (
    <label className={cx("ds-checkbox", className)}>
      <input ref={ref} type="checkbox" className="ds-checkbox__control" {...rest} />
      <span className="ds-checkbox__body">
        <span className="ds-checkbox__label">{label}</span>
        {hint && <span className="ds-hint">{hint}</span>}
      </span>
    </label>
  );
});
