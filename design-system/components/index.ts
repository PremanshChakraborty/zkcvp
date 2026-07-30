/**
 * ZKCVP Design System — public surface.
 *
 * Import from here, never from individual files, so component moves stay
 * internal. The stylesheet is a separate import and is required:
 *
 *   import "@/design-system/styles/design-system.css";
 *   import { Button, StatusBadge } from "@/design-system/components";
 */

export { cx } from "./cx";

export * from "./types";
export * from "./Icon";

export { Button, IconButton } from "./Button";
export type { ButtonProps, IconButtonProps } from "./Button";

export { Field, Input, Textarea, Select, Checkbox } from "./Form";
export type { FieldProps, InputProps, TextareaProps, SelectProps, CheckboxProps } from "./Form";

export { Badge, StatusBadge, VerdictBadge, SystemErrorBadge, VersionPill, RoleTag } from "./Badge";
export type { BadgeProps, StatusBadgeProps, VerdictBadgeProps, VersionPillProps } from "./Badge";

export { Card, CardHeader, CardBody, CardFooter, Well, PageHeader } from "./Card";
export type { CardProps, PageHeaderProps } from "./Card";

export { Table, Td, DescriptionList } from "./Table";
export type { TableProps, CellProps, DescriptionListProps } from "./Table";

export { CopyButton, Mono, CommitSha, HashRef, RepoRef, FileRef, LogRef } from "./Identifiers";
export type { MonoProps, CommitShaProps, HashRefProps } from "./Identifiers";

export { CommitRow, CommitList } from "./Commit";
export type { CommitRowProps } from "./Commit";

export { RequirementRow, RequirementList } from "./Requirement";
export type { RequirementRowProps } from "./Requirement";

export { VerdictCard, EvidenceLock } from "./Verdict";
export type { VerdictCardProps, EvidenceLockProps } from "./Verdict";

export {
  Alert,
  Spinner,
  ProgressBar,
  EmptyState,
  Skeleton,
  ToastRegion,
  Toast,
  UndoToast,
  EvaluationProgress,
} from "./Feedback";
export type { AlertTone, EvaluationProgressProps } from "./Feedback";

export { Tabs, Breadcrumb, SideNav, SideNavSection, NavItem } from "./Nav";
export type { TabItem, Crumb } from "./Nav";

export { Timeline, TimelineItem } from "./Timeline";
export type { TimelineItemProps } from "./Timeline";
