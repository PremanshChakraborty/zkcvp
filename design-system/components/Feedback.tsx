"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import { Button, IconButton } from "./Button";
import { IconCheck, IconCross, IconInfo, IconWarning } from "./Icon";

/* =============================================================================
   Alert
   ============================================================================= */

export type AlertTone = "info" | "success" | "danger" | "warning" | "neutral";

const ALERT_ICON: Record<AlertTone, ReactNode> = {
  info: <IconInfo />,
  success: <IconCheck />,
  danger: <IconCross />,
  warning: <IconWarning />,
  neutral: <IconInfo />,
};

export function Alert({
  tone = "info",
  title,
  children,
  actions,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx("ds-alert", tone !== "info" && `ds-alert--${tone}`, className)}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
    >
      <span className="ds-alert__icon">{ALERT_ICON[tone]}</span>
      <div className="ds-alert__content">
        {title && <span className="ds-alert__title">{title}</span>}
        {children && <div className="ds-alert__body">{children}</div>}
        {actions && <div className="ds-row ds-row--tight">{actions}</div>}
      </div>
    </div>
  );
}

/* =============================================================================
   Spinner & indeterminate progress
   ============================================================================= */

export function Spinner({
  size = "md",
  label = "Loading",
  className,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cx("ds-spinner", size !== "md" && `ds-spinner--${size}`, className)}
      role="status"
      aria-label={label}
    />
  );
}

/** Indeterminate only. There is no honest percentage for an LLM evaluation. */
export function ProgressBar({ className }: { className?: string }) {
  return (
    <div className={cx("ds-progress", className)} role="progressbar" aria-valuetext="In progress">
      <div className="ds-progress__bar" />
    </div>
  );
}

/* =============================================================================
   Empty state
   ============================================================================= */

export function EmptyState({
  title,
  children,
  actions,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ds-empty", className)}>
      <span className="ds-empty__title">{title}</span>
      {children && <p className="ds-empty__body">{children}</p>}
      {actions && <div className="ds-empty__actions">{actions}</div>}
    </div>
  );
}

/* =============================================================================
   Skeleton
   ============================================================================= */

export function Skeleton({
  width = "100%",
  height = 12,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return (
    <span
      className={cx("ds-skeleton", className)}
      style={{ display: "block", width, height }}
      aria-hidden="true"
    />
  );
}

/* =============================================================================
   Toast
   ============================================================================= */

export function ToastRegion({ children }: { children: ReactNode }) {
  return (
    <div className="ds-toast-region" role="region" aria-label="Notifications">
      {children}
    </div>
  );
}

export function Toast({
  children,
  actions,
  onDismiss,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div className={cx("ds-toast", className)} role="status">
      <div className="ds-toast__body">{children}</div>
      {(actions || onDismiss) && (
        <div className="ds-toast__actions">
          {actions}
          {onDismiss && (
            <IconButton size="sm" label="Dismiss" icon={<IconCross size={12} />} onClick={onDismiss} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Undo toast for the repo-removal window.
 *
 * Repo attachment is permanent once this expires — plan 02 has no detach
 * endpoint and no soft-delete state. So the countdown is not decoration: it is
 * the entire window in which the action is reversible, and the remaining time
 * has to be legible at a glance rather than inferred from a fading toast.
 */
export function UndoToast({
  message,
  seconds = 60,
  onUndo,
  onExpire,
  className,
}: {
  message: ReactNode;
  seconds?: number;
  onUndo: () => void;
  onExpire?: () => void;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (remaining <= 0) {
      onExpireRef.current?.();
      return;
    }
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining]);

  return (
    <Toast
      className={className}
      actions={
        <>
          <span
            className="ds-countdown"
            style={{ "--ds-undo-progress": remaining / seconds } as CSSProperties}
            aria-hidden="true"
          />
          <span className="ds-caption" aria-live="off">
            {remaining}s
          </span>
          <Button size="sm" onClick={onUndo}>
            Undo
          </Button>
        </>
      }
    >
      {message}
    </Toast>
  );
}

/* =============================================================================
   Evaluation progress
   ============================================================================= */

export interface EvaluationProgressProps {
  requirementCount: number;
  commitCount: number;
  /** Seconds elapsed. Owned by the caller so it survives re-renders. */
  elapsedSeconds: number;
  /**
   * The request's serverless execution ceiling, in seconds. Past 70% of it the
   * elapsed clock turns amber — the developer is holding an open request and
   * deserves warning before it is cut off, not after.
   */
  ceilingSeconds?: number;
  className?: string;
}

/**
 * The synchronous, browser-blocking evaluation wait.
 *
 * Evaluation runs inside the request that submits the claim, so the developer's
 * own tab is held open for its full duration. That makes this a full-attention
 * state, not a background toast — and it is why the total work is capped by the
 * platform's execution ceiling, which this surfaces as it approaches.
 */
export function EvaluationProgress({
  requirementCount,
  commitCount,
  elapsedSeconds,
  ceilingSeconds,
  className,
}: EvaluationProgressProps) {
  const pressure =
    ceilingSeconds && elapsedSeconds > ceilingSeconds * 0.7 ? "high" : "normal";

  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const ss = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div className={cx("ds-evaluating", className)} data-pressure={pressure} role="status">
      <div className="ds-evaluating__head">
        <Spinner size="lg" label="Evaluating" />
        <span className="ds-evaluating__title">
          Evaluating {requirementCount} requirement{requirementCount === 1 ? "" : "s"} against{" "}
          {commitCount} commit{commitCount === 1 ? "" : "s"}
        </span>
        <span className="ds-evaluating__elapsed">
          {mm}:{ss}
        </span>
      </div>

      <ProgressBar />

      <span className="ds-evaluating__note">
        {pressure === "high"
          ? "Approaching the request time limit. Keep this tab open — the result is written when the evaluation returns."
          : "Reading repository contents at the claimed commits. Keep this tab open; closing it abandons the evaluation."}
      </span>
    </div>
  );
}
