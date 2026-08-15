// apps/web/app/projects/[id]/requirements/new/page.tsx
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
} from "@zkcvp/design-system-ledger/components";
import { requireStakeholderMember } from "../../../../../lib/auth/session";
import { NewRequirementForm } from "./NewRequirementForm";

export default async function NewRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /* Membership, not just role: createRequirement rejects a stakeholder who is
   * not a stakeholder member of THIS project, so checking the role alone would
   * still render a form that cannot be submitted. The service enforces it
   * again on submit; this is what keeps the form off the screen. */
  await requireStakeholderMember(id);

  return (
    <main className="lg-container app-page app-page--narrow">
      <PageHeader title="New requirement" />
      <Card>
        <CardHeader title="Requirement details" />
        <CardBody>
          <NewRequirementForm projectId={id} />
        </CardBody>
      </Card>
    </main>
  );
}
