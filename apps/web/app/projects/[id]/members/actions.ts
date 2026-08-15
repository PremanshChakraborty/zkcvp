// apps/web/app/projects/[id]/members/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../../../../lib/db";
import { requireStakeholder } from "../../../../lib/auth/session";
import { inviteDeveloper } from "../../../../lib/projects/members";
import { ServiceError } from "../../../../lib/api/errors";

/**
 * Four terminal states, not two, and the split is the point.
 *
 * `added` and `invited` are the two branches plan 01 gives
 * `POST /api/projects/:projectId/developers/invites`: an existing developer
 * identity becomes a membership row immediately, anyone else becomes a pending
 * invite that resolves on their first GitHub sign-in. What the stakeholder
 * should expect next differs completely, so the screen has to say which fired.
 *
 * `unavailable` is separated from `error` on purpose. An exhausted GitHub rate
 * limit is an infrastructure failure, not a rejection — errors.ts:
 * "reporting it as 404 would tell a stakeholder something false about a real
 * person" — so it renders as a danger Alert rather than as validation under the
 * username field, where it would read as "no such user".
 */
export type InviteState =
  | { status: "idle" }
  | { status: "added"; githubUsername: string }
  | { status: "invited"; githubUsername: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export async function inviteDeveloperAction(
  projectId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const githubUsername = String(formData.get("githubUsername") ?? "").trim();
  if (!githubUsername) {
    return { status: "error", message: "Enter a GitHub username." };
  }

  /* No redirect() anywhere in this action: the outcome is a message on the same
   * screen, and a redirect inside this try would be swallowed as an error. */
  try {
    const session = await requireStakeholder();
    /* inviteDeveloper re-checks stakeholder membership of THIS project — the
     * page hiding the form is the affordance, this is the enforcement. */
    const result = await inviteDeveloper(getDb(), session, projectId, {
      githubUsername,
    });

    /* The roster and the pending-invite list are rendered by the server
     * component above this form, so the new row only appears if the route is
     * revalidated. */
    revalidatePath(`/projects/${projectId}/members`);

    /* The username echoed back is GitHub's canonical `login`, resolved through
     * the numeric id, not the string the stakeholder typed. */
    return result.kind === "membership"
      ? { status: "added", githubUsername: result.membership.githubUsername }
      : { status: "invited", githubUsername: result.invite.githubUsername };
  } catch (e) {
    if (e instanceof ServiceError) {
      return e.code === "github_unavailable"
        ? { status: "unavailable", message: e.message }
        : { status: "error", message: e.message };
    }
    /* SessionError (401/403 from requireStakeholder) and anything unexpected
     * are not this form's to describe — let the error boundary have them. */
    throw e;
  }
}
