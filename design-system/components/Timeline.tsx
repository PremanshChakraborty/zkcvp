import type { ReactNode } from "react";
import { cx } from "./cx";
import { StatusBadge } from "./Badge";
import type { RequirementDisplayStatus } from "./types";

/**
 * Audit history — requirement versions, claims, verification results.
 *
 * A superseded version's record is history, not an error: per plan 01, a result
 * that lands after an edit writes to the version it was invoked against and
 * stays there as accurate history. The timeline is where that reads correctly,
 * so old entries are never dimmed into looking like mistakes.
 */
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cx("ds-timeline", className)}>{children}</ol>;
}

export interface TimelineItemProps {
  title: ReactNode;
  meta?: ReactNode;
  /** Renders the status dot on the rail. Omit for non-status events. */
  status?: RequirementDisplayStatus;
  children?: ReactNode;
}

export function TimelineItem({ title, meta, status, children }: TimelineItemProps) {
  return (
    <li className="ds-timeline__item">
      <span className="ds-timeline__rail">
        {status ? (
          <StatusBadge status={status} dotOnly />
        ) : (
          <span className="ds-status-dot" data-status="new" />
        )}
      </span>

      <div className="ds-timeline__body">
        <span className="ds-timeline__title">{title}</span>
        {meta && <span className="ds-timeline__meta">{meta}</span>}
        {children}
      </div>
    </li>
  );
}
