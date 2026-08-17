// apps/web/app/projects/[id]/members/InviteForm.tsx
"use client";

import { useActionState } from "react";
import {
  Alert,
  Button,
  Field,
  Input,
} from "@zkcvp/design-system-ledger/components";
import { inviteDeveloperAction, type InviteState } from "./actions";

const INITIAL_STATE: InviteState = { status: "idle" };

export function InviteForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    inviteDeveloperAction.bind(null, projectId),
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      {/* The outcome message, the field and the submit button are separate
          blocks; without a stack the button sits flush against the input. */}
      <div className="lg-stack">
        {/* Two success wordings, never one. The person is either on the project
            now or is not on it yet, and what the stakeholder should expect next
            is different in each case. */}
        {state.status === "added" && (
          <Alert tone="success" title={`Added ${state.githubUsername}`}>
            They already had an account here, so they are a member of this
            project now and can see its requirements.
          </Alert>
        )}
        {state.status === "invited" && (
          <Alert tone="success" title={`Invited ${state.githubUsername}`}>
            They join this project the first time they sign in with GitHub.
            Until then they are listed under pending invites.
          </Alert>
        )}

        {/* An infrastructure failure, in red, well away from the field. The
            lookup did not happen, so this says nothing at all about whether
            that GitHub account exists — telling a stakeholder a real person is
            not there because we could not check would be a false statement
            about a third party. */}
        {state.status === "unavailable" && (
          <Alert tone="danger" title="Could not check GitHub">
            {state.message} Nobody was invited. This is a problem reaching
            GitHub, not a verdict on whether that account exists.
          </Alert>
        )}

        <Field
          label="GitHub username"
          required
          help="Resolved to GitHub's permanent numeric id, so a later username change does not break the link."
          error={state.status === "error" ? state.message : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="githubUsername"
              required
              autoComplete="off"
              spellCheck={false}
              aria-describedby={describedBy}
              invalid={invalid}
              mono
            />
          )}
        </Field>

        <div>
          <Button type="submit" tone="primary" loading={pending}>
            Invite developer
          </Button>
        </div>
      </div>
    </form>
  );
}
