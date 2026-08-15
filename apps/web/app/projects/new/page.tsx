// apps/web/app/projects/new/page.tsx
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
} from "@zkcvp/design-system-ledger/components";
import { requireStakeholder } from "../../../lib/auth/session";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  /* Only a stakeholder may create a project. The service enforces it too; this
   * is what keeps a developer from seeing a form they cannot submit. */
  await requireStakeholder();

  return (
    <main className="lg-container app-page app-page--narrow">
      <PageHeader title="New project" />
      <Card>
        <CardHeader title="Project details" />
        <CardBody>
          <NewProjectForm />
        </CardBody>
      </Card>
    </main>
  );
}
