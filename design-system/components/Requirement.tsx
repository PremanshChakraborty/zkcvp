import type { ReactNode } from "react";
import { cx } from "./cx";
import { StatusBadge, VersionPill } from "./Badge";
import type { RequirementDisplayStatus } from "./types";

export interface RequirementRowProps {
  title: string;
  description?: string;
  /**
   * The *effective* status — the current version's status, resolved through
   * requirements.current_version_id at read time. Plan 01 forbids storing this
   * on the requirement itself, so it must always arrive here from a join.
   */
  status: RequirementDisplayStatus;
  version?: number;
  /** From requirements.archived_at. Orthogonal to status — both can be true. */
  archived?: boolean;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * A single checklist item.
 *
 * The status lives in the gutter as a dot rather than a badge column so a long
 * checklist scans as one vertical status stripe. The full badge is reserved for
 * the requirement's own detail view, where there is only one to read.
 */
export function RequirementRow({
  title,
  description,
  status,
  version,
  archived,
  meta,
  trailing,
  onClick,
  className,
}: RequirementRowProps) {
  const activate = onClick;

  return (
    <div
      className={cx("ds-requirement", activate && "ds-requirement--interactive", className)}
      data-archived={archived ? "true" : undefined}
      onClick={activate}
      role={activate ? "button" : undefined}
      tabIndex={activate ? 0 : undefined}
      onKeyDown={
        activate
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate();
              }
            }
          : undefined
      }
    >
      <span className="ds-requirement__gutter">
        <StatusBadge status={archived ? "archived" : status} dotOnly />
      </span>

      <span className="ds-requirement__body">
        <span className="ds-requirement__title">{title}</span>
        {description && <span className="ds-requirement__description">{description}</span>}
        {(version !== undefined || meta) && (
          <span className="ds-requirement__meta">
            {version !== undefined && <VersionPill version={version} current />}
            {meta}
          </span>
        )}
      </span>

      {trailing && <span className="ds-requirement__trailing">{trailing}</span>}
    </div>
  );
}

export function RequirementList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(className)}>{children}</div>;
}
