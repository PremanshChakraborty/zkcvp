// apps/web/app/requirements/[id]/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/db";
import { requireStakeholder } from "../../../lib/auth/session";
import { archiveRequirement } from "../../../lib/requirements/mutate";

/**
 * Soft delete. `archiveRequirement` has no status-based precondition — a
 * verified requirement archives exactly like a new one — and it does not touch
 * `requirement_versions`, so the version history survives untouched.
 */
export async function archiveRequirementAction(
  requirementId: string,
  projectId: string,
): Promise<void> {
  const session = await requireStakeholder();
  await archiveRequirement(getDb(), session, requirementId);

  /* The checklist drops the row, and the requirement's own page loses its edit
   * and archive affordances, so both are stale. */
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/requirements/${requirementId}`);
  /* redirect() throws a control-flow signal — it must be outside any try. */
  redirect(`/projects/${projectId}`);
}
