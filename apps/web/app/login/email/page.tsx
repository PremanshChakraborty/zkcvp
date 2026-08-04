// apps/web/app/login/email/page.tsx
import { Card, CardBody, CardHeader, PageHeader } from "@zkcvp/design-system-ledger/components";
import { EmailForm } from "./EmailForm";

export default function LoginEmailPage() {
  return (
    <main className="lg-container app-page app-page--narrow">
      <PageHeader
        title="Sign in with email"
        lead="We'll send a one-time link — no password to remember."
      />
      <Card>
        <CardHeader title="Stakeholder sign-in" />
        <CardBody>
          <EmailForm />
        </CardBody>
      </Card>
    </main>
  );
}
