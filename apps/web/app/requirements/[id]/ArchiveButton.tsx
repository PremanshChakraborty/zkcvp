// apps/web/app/requirements/[id]/ArchiveButton.tsx
"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@zkcvp/design-system-ledger/components";
import { archiveRequirementAction } from "./actions";

/**
 * `useFormStatus` only reads the status of the form it is rendered inside, so
 * the control is its own component. It also stops a second submit landing while
 * the first is still in flight, which matters for an action with no undo.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" tone="danger" loading={pending}>
      Archive
    </Button>
  );
}

/**
 * Archiving is a soft delete with no un-archive in this phase, so the copy says
 * what it does rather than "Delete". It is allowed in any status — a verified
 * requirement archives exactly like a new one.
 */
export function ArchiveButton({
  requirementId,
}: {
  requirementId: string;
}) {
  return (
    <form action={archiveRequirementAction.bind(null, requirementId)}>
      <SubmitButton />
    </form>
  );
}
