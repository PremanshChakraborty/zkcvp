"use client";

import { Fragment } from "react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconChevronRight } from "./Icon";

/* =============================================================================
   Tabs
   ============================================================================= */

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cx("ds-tabs", className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="ds-tab"
          aria-selected={item.id === value}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className="ds-tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* =============================================================================
   Breadcrumb
   ============================================================================= */

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav className={cx("ds-breadcrumb", className)} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {item.href && !last ? (
              <a className="ds-breadcrumb__item" href={item.href}>
                {item.label}
              </a>
            ) : (
              <span className="ds-breadcrumb__item" aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!last && (
              <span className="ds-breadcrumb__sep" aria-hidden="true">
                <IconChevronRight size={11} />
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

/* =============================================================================
   Side navigation
   ============================================================================= */

export function SideNav({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <nav className={cx("ds-sidenav", className)} aria-label="Primary">
      {children}
    </nav>
  );
}

export function SideNavSection({ children }: { children: ReactNode }) {
  return <div className="ds-sidenav__section ds-micro-label">{children}</div>;
}

export function NavItem({
  icon,
  children,
  trailing,
  current,
  href,
  onClick,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  current?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      {icon && <span className="ds-nav-item__icon">{icon}</span>}
      {children}
      {trailing && <span className="ds-nav-item__trailing">{trailing}</span>}
    </>
  );

  // Split rather than a dynamic tag: an <a> takes href, a <div> takes the button
  // role and tabIndex, and a union of the two does not typecheck cleanly.
  if (href) {
    return (
      <a
        className={cx("ds-nav-item", className)}
        href={href}
        aria-current={current ? "page" : undefined}
        onClick={onClick}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      className={cx("ds-nav-item", className)}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {inner}
    </div>
  );
}
