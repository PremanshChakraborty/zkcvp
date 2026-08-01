import {
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatusBadge,
} from "@zkcvp/design-system-ledger/components";

export default function Home() {
  return (
    <main className="lg-container">
      <PageHeader title="ZKCVP" />
      <Card>
        <CardHeader>Design system wired</CardHeader>
        <CardBody>
          <p>
            Geist is loaded through next/font and the token layer is live. The
            three status chips below must read &ldquo;Not evaluated&rdquo;,
            &ldquo;Verified&rdquo; and &ldquo;Not satisfied&rdquo;.
          </p>
          <StatusBadge status="new" />
          <StatusBadge status="verified" />
          <StatusBadge status="eval_failed" />
          <Button>Action</Button>
        </CardBody>
      </Card>
    </main>
  );
}
