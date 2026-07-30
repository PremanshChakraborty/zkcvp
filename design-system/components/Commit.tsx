import type { ReactNode } from "react";
import { cx } from "./cx";
import { CommitSha, RepoRef } from "./Identifiers";

export interface CommitRowProps {
  sha: string;
  subject: string;
  repoFullName?: string;
  author?: string;
  authoredAt?: string;
  /** Renders as an option in the claim builder. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  trailing?: ReactNode;
  className?: string;
}

/**
 * One (repo, commitSha) pair.
 *
 * The same row serves the claim builder and the read-only record of a submitted
 * claim, because they must show identical information — a stakeholder reading
 * the record needs to see exactly what the developer selected, at the same
 * fidelity, with no summarisation in between.
 */
export function CommitRow({
  sha,
  subject,
  repoFullName,
  author,
  authoredAt,
  selectable,
  selected,
  onSelect,
  trailing,
  className,
}: CommitRowProps) {
  const select = selectable ? onSelect : undefined;

  return (
    <div
      className={cx("ds-commit", selectable && "ds-commit--selectable", className)}
      aria-selected={selectable ? Boolean(selected) : undefined}
      role={selectable ? "option" : undefined}
      tabIndex={select ? 0 : undefined}
      onClick={select}
      onKeyDown={
        select
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select();
              }
            }
          : undefined
      }
    >
      <span className="ds-commit__sha">
        <CommitSha sha={sha} />
      </span>

      <span className="ds-commit__body">
        <span className="ds-commit__subject">{subject}</span>
        <span className="ds-commit__meta">
          {repoFullName && <RepoRef fullName={repoFullName} />}
          {author && <span>{author}</span>}
          {authoredAt && <span>{authoredAt}</span>}
        </span>
      </span>

      {trailing}
    </div>
  );
}

export function CommitList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ds-commit-list", className)} role="listbox">
      {children}
    </div>
  );
}
