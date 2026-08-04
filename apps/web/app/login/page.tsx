// apps/web/app/login/page.tsx
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
} from "@zkcvp/design-system-ledger/components";
import { developerSignIn } from "../../lib/auth/developer";

export default function LoginPage() {
  return (
    <main className="lg-container app-page app-page--narrow">
      <PageHeader
        title="Sign in"
        lead="Stakeholders and developers authenticate differently — pick the one that's you."
      />

      {/* Without a stack the two cards butt together and read as one block
          split by a divider, rather than as two separate choices. */}
      <div className="lg-stack lg-stack--loose">
        <Card>
          <CardHeader title="Developer" />
          <CardBody>
            <div className="lg-stack">
              <p>
                Sign in with GitHub. This is also how a project attaches your
                repos and reads code at the commits you claim.
              </p>
              <form
                action={async () => {
                  "use server";
                  await developerSignIn("github");
                }}
              >
                <Button type="submit" tone="primary">
                  Continue with GitHub
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stakeholder" />
          <CardBody>
            <div className="lg-stack">
              <p>
                Sign in with an email link — no password, no GitHub account
                required.
              </p>
              <div>
                <Link href="/login/email">
                  <Button type="button">Continue with email</Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
