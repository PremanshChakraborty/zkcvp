"use client";

import { useCallback, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { IconCheck, IconCopy } from "./Icon";
import { LOG_REF_LABEL, type LogRefState } from "./types";

/* -----------------------------------------------------------------------------
   Copy

   Every identifier in this product is something a person may need to paste into
   a terminal or a verification tool. Copy is not a nicety here; it is the
   primary interaction on a hash.
   ----------------------------------------------------------------------------- */

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked by permissions policy. The identifier is
      // `user-select: all`, so manual selection remains a working fallback.
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      className={cx("ds-copy", className)}
      data-copied={copied || undefined}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
    >
      {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
    </button>
  );
}

/* -----------------------------------------------------------------------------
   Mono — the base identifier chip.
   ----------------------------------------------------------------------------- */

export interface MonoProps extends HTMLAttributes<HTMLSpanElement> {
  plain?: boolean;
  strong?: boolean;
  copyValue?: string;
  children: ReactNode;
}

export function Mono({ plain, strong, copyValue, className, children, ...rest }: MonoProps) {
  return (
    <span
      className={cx(
        "ds-ident",
        plain && "ds-ident--plain",
        strong && "ds-ident--strong",
        className,
      )}
      {...rest}
    >
      {children}
      {copyValue && <CopyButton value={copyValue} />}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Commit SHA

   Renders the short form; the full 40 characters stay in `title` and in the
   copy payload. Claims pin exact commits, so the full value must always be
   recoverable from the UI without a round trip.
   ----------------------------------------------------------------------------- */

export interface CommitShaProps {
  sha: string;
  length?: number;
  copyable?: boolean;
  className?: string;
}

export function CommitSha({ sha, length = 7, copyable = true, className }: CommitShaProps) {
  const short = sha.slice(0, length);

  return (
    <span className={cx("ds-ident ds-sha", className)} title={sha}>
      {short}
      {copyable && <CopyButton value={sha} label="Copy full SHA" />}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Hash digest — evidence_hash, canonicalPayloadHash.

   Truncates in the middle, never at the end: when a person eyeballs a digest
   against another source they compare the head *and* the tail, so a trailing
   ellipsis would destroy the only affordance that matters.
   ----------------------------------------------------------------------------- */

export interface HashRefProps {
  hash: string;
  /** e.g. "sha256" — rendered de-emphasised ahead of the digest. */
  algorithm?: string;
  head?: number;
  tail?: number;
  copyable?: boolean;
  className?: string;
}

export function HashRef({
  hash,
  algorithm,
  head = 8,
  tail = 6,
  copyable = true,
  className,
}: HashRefProps) {
  const full = algorithm ? `${algorithm}:${hash}` : hash;
  const truncated = hash.length > head + tail + 2;

  return (
    <span className={cx("ds-ident", className)} title={full}>
      {algorithm && <span className="ds-sha__prefix">{algorithm}:</span>}
      {truncated ? (
        <span className="ds-hash">
          <span className="ds-hash__head">{hash.slice(0, head)}</span>
          <span className="ds-hash__ellipsis">…</span>
          <span className="ds-hash__tail">{hash.slice(-tail)}</span>
        </span>
      ) : (
        hash
      )}
      {copyable && <CopyButton value={full} label="Copy digest" />}
    </span>
  );
}

/* -----------------------------------------------------------------------------
   Repo reference

   Display only. `github_repo_id` is the join key everywhere in the data model —
   `full_name` changes when a repo is renamed (plan 02, invariant 1). Never key
   anything off what this renders.
   ----------------------------------------------------------------------------- */

export function RepoRef({
  fullName,
  className,
}: {
  /** "owner/name" as returned by GitHub. */
  fullName: string;
  className?: string;
}) {
  const [owner, ...rest] = fullName.split("/");
  const name = rest.join("/");

  return (
    <span className={cx("ds-repo", className)} title={fullName}>
      <span className="ds-repo__owner">{owner}</span>
      <span className="ds-repo__sep">/</span>
      <span className="ds-repo__name">{name}</span>
    </span>
  );
}

/* -----------------------------------------------------------------------------
   File reference — permitted inside an evaluator rationale.

   The Evaluator may cite a path or a line range; it may never emit verbatim
   source. That is a generation-time constraint on the agent, not a display
   filter — this component exists so a compliant citation has somewhere correct
   to render, not to sanitise a non-compliant one.
   ----------------------------------------------------------------------------- */

export function FileRef({
  path,
  lines,
  className,
}: {
  path: string;
  lines?: string;
  className?: string;
}) {
  return (
    <code className={cx("ds-fileref", className)}>
      {path}
      {lines && `:${lines}`}
    </code>
  );
}

/* -----------------------------------------------------------------------------
   Transparency log reference
   ----------------------------------------------------------------------------- */

export function LogRef({
  logRef,
  state = "unavailable",
  className,
}: {
  logRef?: string;
  state?: LogRefState;
  className?: string;
}) {
  return (
    <span className={cx("ds-logref", className)} data-state={state}>
      <span className="ds-logref__state">
        <span className="ds-dot" />
        {LOG_REF_LABEL[state]}
      </span>
      {logRef && <HashRef hash={logRef} head={7} tail={5} />}
    </span>
  );
}
