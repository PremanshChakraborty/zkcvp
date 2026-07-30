import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  interactive?: boolean;
}

export function Card({ raised, interactive, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "ds-card",
        raised && "ds-card--raised",
        interactive && "ds-card--interactive",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("ds-card__header", className)}>
      {children ?? <span className="ds-card__title">{title}</span>}
      {actions}
    </div>
  );
}

export function CardBody({
  flush,
  className,
  children,
}: {
  /** Removes padding — for tables and lists that own their own row insets. */
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("ds-card__body", flush && "ds-card__body--flush", className)}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={cx("ds-card__footer", className)}>{children}</div>;
}

/**
 * Well — a recessed container, the inverse of a card.
 *
 * Cards sit above the surface and hold chrome. Wells are cut into it and hold
 * evidence: commit lists, digests, log references. Keeping the two visually
 * opposed is what makes "this is data the system read" legible at a glance.
 */
export function Well({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("ds-well", className)} {...rest}>
      {children}
    </div>
  );
}

/* There is deliberately no `eyebrow` slot. A small label stacked above the h1
   adds a line of chrome without adding information — the title carries its own
   weight. Where the reader genuinely needs to know where they are, that is
   navigation, so pass a <Breadcrumb> as `above`, which is a real wayfinding
   control rather than a decorative kicker. */
export interface PageHeaderProps {
  /** Wayfinding only — a <Breadcrumb>. Not a label for the title. */
  above?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Rendered flush to the bottom border — typically <Tabs>. */
  footer?: ReactNode;
}

export function PageHeader({ above, title, meta, actions, footer }: PageHeaderProps) {
  return (
    <header className="ds-page-header">
      {above}
      <div className="ds-page-header__top">
        <div className="ds-page-header__heading">
          <h1 className="ds-title">{title}</h1>
          {meta && <div className="ds-row ds-row--tight ds-row--wrap">{meta}</div>}
        </div>
        {actions && <div className="ds-page-header__actions">{actions}</div>}
      </div>
      {footer}
    </header>
  );
}
