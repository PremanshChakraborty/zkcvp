// apps/web/app/projects/[id]/requirements/new/NewRequirementForm.tsx
"use client";

import { useActionState } from "react";
import {
  Button,
  Field,
  Input,
  Textarea,
} from "@zkcvp/design-system-ledger/components";
import { createRequirementAction, type FormState } from "./actions";

const INITIAL_STATE: FormState = { status: "idle" };

export function NewRequirementForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    createRequirementAction.bind(null, projectId),
    INITIAL_STATE,
  );

  const errorFor = (field: "title" | "description") =>
    state.status === "error" && state.field === field
      ? state.message
      : undefined;

  return (
    <form action={formAction}>
      {/* The two fields and the submit button are separate blocks; without a
          stack the button sits flush against the textarea's bottom edge. */}
      <div className="lg-stack">
        <Field label="Title" required error={errorFor("title")}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="title"
              required
              autoFocus
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field
          label="Description"
          required
          help="What must be true for this requirement to be satisfied."
          error={errorFor("description")}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              name="description"
              rows={6}
              required
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <div>
          <Button type="submit" tone="primary" loading={pending}>
            Add requirement
          </Button>
        </div>
      </div>
    </form>
  );
}
