/**
 * Domain vocabulary shared across the design system.
 *
 * These mirror the database enums in docs/plans/01-requirement-management.md
 * exactly. Components accept these raw values rather than presentational props
 * ("green", "success") so a status can never be mis-rendered at a call site.
 */

/** `requirement_versions.status` — the persisted enum. */
export type RequirementStatus = "new" | "verified" | "eval_failed";

/**
 * What the UI actually renders for a requirement.
 *
 * `archived` is NOT a status — it comes from `requirements.archived_at`, which
 * is orthogonal to the version status (plan 01, "Archiving vs. status"). It is
 * folded in here only for display, because a row can show one badge at a time.
 * Never persist this type.
 */
export type RequirementDisplayStatus = RequirementStatus | "archived";

/** Per-requirement Evaluator output, from `report.perRequirement[].verdict`. */
export type Verdict = "satisfied" | "not_satisfied";

export type Role = "stakeholder" | "developer";

/** `project_developer_invites.status` / `project_stakeholder_invites.status`. */
export type InviteStatus = "pending" | "accepted";

/**
 * Result of checking a record against the Transparency Log.
 *
 * `unavailable` is the honest default for this phase: the log is not built yet,
 * so nothing has been checked. Do not render `unverified` in its place — that
 * implies a check ran and came back inconclusive.
 */
export type LogRefState = "verified" | "unverified" | "mismatch" | "unavailable";

/** Human labels. Single source of truth — do not inline these strings in JSX. */
export const REQUIREMENT_STATUS_LABEL: Record<RequirementDisplayStatus, string> = {
  new: "Not evaluated",
  verified: "Verified",
  eval_failed: "Not satisfied",
  archived: "Archived",
};

/**
 * Note the label above: `eval_failed` reads as "Not satisfied", not "Failed".
 *
 * The column name is misleading — per plan 01's transition table, the Evaluator
 * returning a *negative verdict* writes `eval_failed`. It does not mean the
 * evaluation errored. Never surface the raw enum name to a stakeholder; an
 * infrastructure failure is a separate concern rendered by `SystemErrorBadge`.
 */

export const VERDICT_LABEL: Record<Verdict, string> = {
  satisfied: "Satisfied",
  not_satisfied: "Not satisfied",
};

export const ROLE_LABEL: Record<Role, string> = {
  stakeholder: "Stakeholder",
  developer: "Developer",
};

export const LOG_REF_LABEL: Record<LogRefState, string> = {
  verified: "Inclusion proof valid",
  unverified: "Not yet checked",
  mismatch: "Proof mismatch",
  unavailable: "Log not enabled",
};
