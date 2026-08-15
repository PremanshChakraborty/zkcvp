// apps/web/app/requirements/[id]/page.tsx
import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  PageHeader,
  Section,
  SectionHeading,
  StatusBadge,
  Timeline,
  TimelineItem,
  VersionPill,
  type DescriptionListProps,
} from "@zkcvp/design-system-ledger/components";
import { getDb } from "../../../lib/db";
import { requireSession } from "../../../lib/auth/session";
import { getRequirement } from "../../../lib/requirements/service";
import { ArchiveButton } from "./ArchiveButton";

/** Absolute dates throughout this product, never relative. */
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function RequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /* Any member reads this page; getRequirement enforces membership of the
   * requirement's project. Only the two mutating affordances below are
   * stakeholder-only. */
  const session = await requireSession();
  const { requirement, versionHistory } = await getRequirement(
    getDb(),
    session,
    id,
  );

  const archived = requirement.archivedAt !== null;
  const isStakeholder = session.kind === "stakeholder";

  /* `archived_at` and the current version's `status` are independent axes —
   * plan 01, invariant 5: "never let one imply or overwrite the other." A row
   * in a list folds them because it has room for one badge; this page has room
   * for both, so the status badge always reports the version's own status and
   * archival is stated separately, as the date it happened. */
  const facts: DescriptionListProps["items"] = [
    { term: "Status", value: <StatusBadge status={requirement.status} /> },
    {
      term: "Current version",
      value: <VersionPill version={requirement.versionNumber} current />,
    },
    { term: "Created", value: dateTimeFormat.format(requirement.createdAt) },
    ...(requirement.archivedAt
      ? [
          {
            term: "Archived",
            value: dateTimeFormat.format(requirement.archivedAt),
          },
        ]
      : []),
  ];

  return (
    <main className="lg-container app-page">
      <PageHeader
        title={requirement.title}
        actions={
          /* An archived requirement cannot be edited — editRequirement returns
           * 404 for one — so the affordance is not offered rather than offered
           * and then rejected. Archiving is likewise withheld: there is no
           * un-archive in this phase and nothing left to archive. */
          isStakeholder && !archived ? (
            <>
              <Link href={`/requirements/${id}/edit`}>
                <Button type="button" tone="secondary">
                  Edit
                </Button>
              </Link>
              <ArchiveButton
                requirementId={id}
                projectId={requirement.projectId}
              />
            </>
          ) : undefined
        }
      />

      {/* PageHeader carries its own bottom margin; the blocks after it do not,
          so they are stacked rather than left flush against each other. */}
      <div className="lg-stack lg-stack--loose">
        {archived ? (
          <Alert tone="info" title="This requirement is archived">
            It no longer appears on the project&rsquo;s checklist and can no
            longer be edited. Archiving is separate from verification — it says
            nothing about whether this requirement was ever verified — and there
            is no un-archive in this phase.
          </Alert>
        ) : null}

        <Card>
          <CardHeader title="Current version" />
          <CardBody>
            <div className="lg-stack">
              <p className="lg-prose">{requirement.description}</p>
              <DescriptionList items={facts} />
            </div>
          </CardBody>
        </Card>

        <Section>
          <SectionHeading>Version history</SectionHeading>
          {/* Versions are immutable: an edit writes a new one and never alters
              an old one, so this list is an audit trail and is shown in full,
              in version order, exactly as the service returns it. */}
          <Timeline label="Version history">
            {versionHistory.map((v) => (
              <TimelineItem
                key={v.id}
                title={
                  <>
                    <VersionPill
                      version={v.versionNumber}
                      current={v.id === requirement.currentVersionId}
                    />{" "}
                    {v.title}
                  </>
                }
                meta={dateTimeFormat.format(v.createdAt)}
              >
                {/* The chip is wrapped: a bare chip in the timeline's flex
                    column would be stretched to the column's full width. */}
                <span className="lg-row-flex">
                  {/* The raw enum never reaches the screen — StatusBadge owns
                      the label, and `eval_failed` reads "Not satisfied". */}
                  <StatusBadge status={v.status} />
                </span>
                <p className="lg-body">{v.description}</p>
              </TimelineItem>
            ))}
          </Timeline>
        </Section>
      </div>
    </main>
  );
}
