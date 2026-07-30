import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from "react";
import { cx } from "./cx";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  dense?: boolean;
}

/**
 * Always wrapped in its own horizontal scroll container: commit and repo tables
 * carry unbreakable monospace cells, and the page body must never scroll
 * sideways to accommodate them.
 */
export function Table({ dense, className, children, ...rest }: TableProps) {
  return (
    <div className="ds-scroll-x">
      <table className={cx("ds-table", dense && "ds-table--dense", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export interface CellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  strong?: boolean;
  mono?: boolean;
  align?: "left" | "right";
  /** Collapses the column to its content width. */
  shrink?: boolean;
}

export function Td({
  strong,
  mono,
  align,
  shrink,
  className,
  children,
  ...rest
}: CellProps) {
  return (
    <td
      className={cx(
        strong && "ds-table__cell--strong",
        mono && "ds-table__cell--mono",
        align === "right" && "ds-table__cell--right",
        shrink && "ds-table__cell--shrink",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

/* -----------------------------------------------------------------------------
   Description list — evaluation provenance.

   modelId, promptTemplateVersion, createdAt: the fields that make a report
   reproducible-in-principle. They belong together in a fixed key column so two
   reports can be compared by scanning down.
   ----------------------------------------------------------------------------- */

export interface DescriptionListProps {
  items: Array<{ key: string; value: ReactNode }>;
  stacked?: boolean;
  className?: string;
}

export function DescriptionList({ items, stacked, className }: DescriptionListProps) {
  return (
    <dl className={cx("ds-dl", stacked && "ds-dl--stacked", className)}>
      {items.map((item) => (
        <div key={item.key} style={{ display: "contents" }}>
          <dt className="ds-dl__key">{item.key}</dt>
          <dd className="ds-dl__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
