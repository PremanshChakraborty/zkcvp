import type { ReactNode } from "react";
import { cx } from "./cx";
import { VerdictBadge } from "./Badge";
import { Button } from "./Button";
import { HashRef } from "./Identifiers";
import { IconLock } from "./Icon";
import type { Verdict } from "./types";

export interface VerdictCardProps {
  requirementTitle: string;
  verdict: Verdict;
  /**
   * Human language only. Per the Evaluator contract, a rationale may cite a file
   * path or line range but must never embed verbatim source — enforced at
   * generation time in the agent, not here.
   */
  rationale: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * One entry from `report.perRequirement`.
 *
 * Styled as prose, deliberately — not as a code block. If the agent ever leaked
 * verbatim source into a rationale it would render as visibly wrong here, which
 * is a weak but free signal. It is not a filter and must not be relied on as one.
 */
export function VerdictCard({
  requirementTitle,
  verdict,
  rationale,
  footer,
  className,
}: VerdictCardProps) {
  return (
    <article className={cx("ds-verdict-card", className)} data-verdict={verdict}>
      <header className="ds-verdict-card__header">
        <h3 className="ds-verdict-card__title">{requirementTitle}</h3>
        <VerdictBadge verdict={verdict} />
      </header>

      <div className="ds-verdict-card__rationale">{rationale}</div>

      {footer && <footer className="ds-verdict-card__footer">{footer}</footer>}
    </article>
  );
}

export interface EvidenceLockProps {
  evidenceHash: string;
  algorithm?: string;
  /** Wired to the Transparency Log's verify() once that exists. */
  onVerify?: () => void;
  className?: string;
}

/**
 * The withheld evidence bundle.
 *
 * Two things have to land at once, and they are easy to conflate:
 *
 *   1. The bundle's contents are not viewable — it holds real source from a
 *      private repo and no disclosure mechanism exists in this phase.
 *   2. Its hash is still independently checkable. Verifying that the evidence
 *      was never altered and disclosing what the evidence *says* are separate
 *      operations, and the first never requires the second.
 *
 * So the verify action stays live while the content stays sealed. Removing that
 * button because the bundle is private would collapse the distinction the whole
 * trust model rests on.
 */
export function EvidenceLock({
  evidenceHash,
  algorithm = "sha256",
  onVerify,
  className,
}: EvidenceLockProps) {
  return (
    <div className={cx("ds-evidence", className)}>
      <span className="ds-evidence__icon">
        <IconLock size={15} />
      </span>

      <span className="ds-evidence__body">
        <span className="ds-evidence__label">
          Evidence bundle sealed · <HashRef hash={evidenceHash} algorithm={algorithm} />
        </span>
        <span className="ds-evidence__note">
          Contents are not disclosed in this phase. The digest can still be checked
          against the log without revealing them.
        </span>
      </span>

      {onVerify && (
        <span className="ds-evidence__actions">
          <Button size="sm" onClick={onVerify}>
            Verify digest
          </Button>
        </span>
      )}
    </div>
  );
}
