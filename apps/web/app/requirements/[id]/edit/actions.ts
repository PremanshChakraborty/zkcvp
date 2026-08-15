// apps/web/app/requirements/[id]/edit/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../lib/db";
import { requireStakeholder } from "../../../../lib/auth/session";
import { editRequirement } from "../../../../lib/requirements/mutate";

/**
 * The same shape as the new-requirement action, including the field the message
 * belongs to: this form has two required controls, and a message rendered under
 * the wrong one tells the stakeholder to fix a field that is already correct.
 */
export type FormState =
  | { status: "idle" }
  | { status: "error"; field: "title" | "description"; message: string };

export async function editRequirementAction(
  requirementId: string,
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
  /* Both fields are always sent, so both are passed. `editRequirement` treats
   * an omitted key as "carry the previous version's text forward", which is not
   * what an emptied control means. */
  await editRequirement(getDb(), session, requirementId, { title, description });

  revalidatePath(`/requirements/${requirementId}`);
  /* redirect() throws a control-flow signal — it must be outside any try. */
  redirect(`/requirements/${requirementId}`);
}
