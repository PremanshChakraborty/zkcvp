// apps/web/app/projects/new/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/db";
import { requireStakeholder } from "../../../lib/auth/session";
import { createProject } from "../../../lib/projects/service";

export type FormState = { status: "idle" } | { status: "error"; message: string };

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { status: "error", message: "Enter a project name." };

  const session = await requireStakeholder();
  const project = await createProject(getDb(), session, { name });

  revalidatePath("/projects");
  /* redirect() throws a control-flow signal — it must be outside any try. */
  redirect(`/projects/${project.id}`);
}
