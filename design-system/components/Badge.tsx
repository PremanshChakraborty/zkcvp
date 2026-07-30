import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { IconCheck, IconCross, IconWarning } from "./Icon";
import {
  REQUIREMENT_STATUS_LABEL,
  ROLE_LABEL,
  VERDICT_LABEL,
  type RequirementDisplayStatus,
  type Role,
  type Verdict,
} from "./types";

/* -----------------------------------------------------------------------------
   Badge — generic. For anything without domain meaning (counts, labels, tags).
   If you are rendering a requirement status or a verdict, use the dedicated
   components below instead: they take the enum and pick the tone themselves.
   ----------------------------------------------------------------------------- */

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "danger" | "warning";
  square?: boolean;
  mono?: boolean;
  dot?: boolean;
}

export function Badge({
  tone = "neutral",
  square,
  mono,
  dot,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cx(
        "ds-badge",
        tone !== "neutral" && `ds-badge--${tone}`,
        square && "ds-badge--square",
        mono && "ds-badge--mono",
        className,
      )}
      {...rest}
    >
      {dot && <span className="ds-dot" />}
      {children}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   StatusBadge — requirement_versions.status (+ archived for display).

   Takes the raw enum. The label mapping lives in types.ts because the raw enum
   name `eval_failed` must never reach a stakeholder's screen: it means the
   verdict was negative, not that the system broke.
   ----------------------------------------------------------------------------- */

export interface StatusBadgeProps {
  status: RequirementDisplayStatus;
  /** Hides the text label, leaving the coloured dot. For dense table gutters. */
  dotOnly?: boolean;
  className?: string;
}

export function StatusBadge({ status, dotOnly, className }: StatusBadgeProps) {
  const label = REQUIREMENT_STATUS_LABEL[status];

  if (dotOnly) {
    return (
      <span
        className={cx("ds-status-dot", className)}
        data-status={status}
        role="img"
        aria-label={label}
        title={label}
      />
    );
  }

  return (
    <span className={cx("ds-status", className)} data-status={status}>
      <span className="ds-dot" />
      {label}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   VerdictBadge — report.perRequirement[].verdict
   ----------------------------------------------------------------------------- */

export interface VerdictBadgeProps {
  verdict: Verdict;
  className?: string;
}

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  return (
    <span className={cx("ds-verdict", className)} data-verdict={verdict}>
      <span className="ds-verdict__glyph" aria-hidden="true">
        {verdict === "satisfied" ? <IconCheck size={9} /> : <IconCross size={9} />}
      </span>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   SystemErrorBadge — the evaluation could not complete.

   Structurally separate from VerdictBadge and a different colour on purpose. A
   GitHub rate limit or a blown execution ceiling says nothing about whether the
   code satisfies the requirement, so it renders in the palette's error coral and
   never in the periwinkle reserved for a negative verdict.
   ----------------------------------------------------------------------------- */

export function SystemErrorBadge({
  children = "Evaluation incomplete",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("ds-syserror", className)}>
      <IconWarning size={11} />
      {children}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Version pill — requirement_versions.version_number
   ----------------------------------------------------------------------------- */

export interface VersionPillProps {
  version: number;
  /** Resolved via requirements.current_version_id — never stored on the row. */
  current?: boolean;
  superseded?: boolean;
  className?: string;
}

export function VersionPill({ version, current, superseded, className }: VersionPillProps) {
  return (
    <span
      className={cx("ds-version", superseded && "ds-version--superseded", className)}
      data-current={current ? "true" : undefined}
      title={current ? `Version ${version} (current)` : `Version ${version}`}
    >
      v{version}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Role & invite tags
   ----------------------------------------------------------------------------- */

export function RoleTag({ role, className }: { role: Role; className?: string }) {
  return (
    <span className={cx("ds-role", className)} data-role={role}>
      {ROLE_LABEL[role]}
    </span>
  );
}
