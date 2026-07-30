"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  /** Irreversible and destructive. Reserve for actions with no undo path. */
  | "danger"
  /** Destructive but recoverable — archiving, removing within the undo window. */
  | "danger-outline";

type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the label for a spinner and blocks pointer events. Width is held. */
  loading?: boolean;
  block?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    block = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "ds-btn",
        `ds-btn--${variant}`,
        size !== "md" && `ds-btn--${size}`,
        block && "ds-btn--block",
        loading && "ds-btn--loading",
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — an icon-only control has no accessible name without it. */
  label: string;
  size?: "sm" | "md";
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, icon, size = "md", className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cx("ds-icon-btn", size === "sm" && "ds-icon-btn--sm", className)}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
