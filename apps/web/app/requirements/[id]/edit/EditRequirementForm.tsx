// apps/web/app/requirements/[id]/edit/EditRequirementForm.tsx
"use client";

import { useActionState } from "react";
import {
  Alert,
  Button,
  Field,
  Input,
  REQUIREMENT_STATUS_LABEL,
  Textarea,
} from "@zkcvp/design-system-ledger/components";
import { editRequirementAction, type FormState } from "./actions";

const INITIAL_STATE: FormState = { status: "idle" };

export function EditRequirementForm({
  requirementId,
  title,
  description,
}: {
  requirementId: string;
  title: string;
  description: string;
}) {
  const [state, formAction, pending] = useActionState(
    editRequirementAction.bind(null, requirementId),
    INITIAL_STATE,
  );

  const errorFor = (field: "title" | "description") =>
    state.status === "error" && state.field === field
      ? state.message
      : undefined;

  return (
    <form action={formAction}>
      <div className="lg-stack">
        {/* Said before the submit, not after it. A new version always starts at
            `new` unconditionally, so saving reopens a requirement the Evaluator
            had already verified — and that is not something a stakeholder can
            infer from a button labelled "Save". `warning` rather than `info`
            because the consequence is permanent: versions are immutable and
            there is no way back to the verified one. */}
        <Alert tone="warning" title="Saving creates a new version">
          Versions are immutable, so this does not change the current one — it
          writes the next one. A new version always starts at &ldquo;
          {REQUIREMENT_STATUS_LABEL.new}&rdquo;, whatever the current version
          reached.
        </Alert>

        <Field label="Title" required error={errorFor("title")}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="title"
              required
              autoFocus
              defaultValue={title}
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
              defaultValue={description}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <div>
          <Button type="submit" tone="primary" loading={pending}>
            Save new version
          </Button>
        </div>
      </div>
    </form>
  );
}
