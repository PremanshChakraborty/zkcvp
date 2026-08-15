// apps/web/app/projects/[id]/requirements/new/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../../lib/db";
import { requireStakeholder } from "../../../../../lib/auth/session";
import { createRequirement } from "../../../../../lib/requirements/service";

/**
 * Same shape as the new-project action, plus the field the message belongs to.
 * This form has two required controls, and a message rendered under the wrong
 * one tells the stakeholder to fix a field that is already correct.
 */
export type FormState =
  | { status: "idle" }
  | { status: "error"; field: "title" | "description"; message: string };

export async function createRequirementAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) {
    return { status: "error", field: "title", message: "Enter a title." };
  }
  if (!description) {
    return {
      status: "error",
      field: "description",
      message: "Enter a description.",
    };
  }

  const session = await requireStakeholder();
  await createRequirement(getDb(), session, projectId, { title, description });

  revalidatePath(`/projects/${projectId}`);
  /* redirect() throws a control-flow signal — it must be outside any try. */
  redirect(`/projects/${projectId}`);
}
