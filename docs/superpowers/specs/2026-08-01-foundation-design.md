# Design: Application Foundation (scaffold → auth → schema → plan 01 → checklist UI)

**Date:** 2026-08-01
**Status:** Approved. Ready for implementation planning.
**Implements:** `docs/plans/01-requirement-management.md`
**Does not implement:** `docs/plans/02-repo-attachment.md`, claim submission, the Evaluator, the Transparency Log.

---

## Purpose

Take ZKCVP from "design system only, no application code" to "plan 01 fully implemented,
with a working checklist UI". Along the way, produce the package the parallel orchestrator
workstream needs to build against.

This document settles the stack choices `README.md` left open (auth library, ORM, repo
layout) and fixes the build order. It does not restate plan 01's business rules — that
document remains the authority on schema, lifecycle, authorization, and API contracts. Where
this document and plan 01 disagree about a business rule, plan 01 wins.

---

## Decisions settled here

| Open question | Decision |
|---|---|
| Auth implementation (README, Open questions) | Auth.js v5 (`next-auth@5.0.0-beta.32`), **two separate instances** |
| ORM / DB access | Drizzle ORM over `pg`, against Supabase-as-hosted-Postgres |
| Repo layout | npm workspaces monorepo |
| Framework version | **Next.js 15.5.x**, pinned. React 19 |
| Email delivery | Console transport. No external provider in this build |
| Test strategy | Vitest integration tests against real Postgres, written before handlers |

Deliberately still open, and untouched by this document: the deployment host, the
Transparency Log backend, claim-submission request/response shape, any evidence-disclosure
feature.

### Why Next 15 and not 16

`next-auth@5` has been in beta since well before Next 16 and is validated against Next 15.
Pinning 15.5.22 removes a compatibility risk from the critical path at zero cost — nothing
in the host-agnostic design depends on a Next 16 feature. React 19 is shared with
`design-system-ledger`, which already declares `react@^19`, so there is no version
negotiation between the app and the component layer.

### Why Drizzle, and why Supabase is used as nothing but Postgres

Drizzle emits readable `.sql` migrations and ships no query-engine binary, which keeps cold
starts low if the serverless host is chosen. Supabase provides the Postgres instance and
nothing else: no `supabase-js`, no Row Level Security, no Supabase Auth. Authorization lives
in the application layer where plan 01's matrix is written. This keeps the database layer
host-agnostic — moving to Neon, Railway, or local Postgres is a connection-string change.

### Why two Auth.js instances

Plan 01 mandates two disjoint identity tables and states there is "no shared login form or
shared session type". Auth.js's adapter interface assumes exactly one user table.

With an adapter present, Auth.js routes OAuth sign-ins through `adapter.createUser` and
`adapter.linkAccount` regardless of session strategy. A single instance serving both
providers would therefore need an adapter that inspects which provider is mid-call and
writes to a different table — a hack, and precisely the friction plan 01's design creates.

Splitting into two instances removes it:

- **Developer instance** — GitHub provider, **no adapter**, JWT strategy. Auth.js requires
  no adapter for OAuth + JWT, so nothing attempts to create a user row. The `developers`
  upsert happens in our own `signIn` callback.
- **Stakeholder instance** — a custom `type: 'email'` provider, with a small adapter mapping
  only to `stakeholders` and `verification_tokens`. The email flow genuinely needs
  verification-token persistence, and that adapter never sees a GitHub sign-in.

### Why email delivery is a seam, not a provider

Magic links are printed to the server console in this build — no Resend, no SMTP, no
external account. But the mechanism is isolated behind a single function rather than a
provider choice:

```ts
type MagicLinkSender = (args: { email: string; url: string }) => Promise<void>;
```

The stakeholder instance is a custom provider whose `sendVerificationRequest` delegates to
whichever `MagicLinkSender` `env.ts` selects. The console sender is the only implementation
that ships. Adding Resend or SMTP later is a new ~10-line function and one env value — the
provider, the adapter, the token table, and every test stay untouched.

This is deliberate for the same reason the deployment host is: it keeps a decision cheap
rather than making it now. It also means the full stakeholder auth flow is testable and
demoable with zero external configuration.

---

## Repository layout

```
zkcvp/
├── package.json                  npm workspaces root
├── apps/
│   └── web/                      Next.js 15 — UI, CRUD API, orchestrator entrypoint
├── packages/
│   ├── contracts/                Evaluator I/O types, domain enums, GitHub tool interface
│   ├── db/                       Drizzle schema, migrations, client factory
│   ├── design-system-ledger/     moved from repo root via `git mv`
│   └── orchestrator/             stub; owned by the parallel workstream
├── design-system/                first visual direction — untouched
└── docs/
```

Still a single deployable: Next transpiles workspace packages into the same bundle via
`transpilePackages`.

`design-system-ledger` moves with `git mv` so its history survives. Its internal structure,
its `types.ts`, and its render check are not modified — only the `vite.config.ts` and
`tsconfig.json` paths that assume a repo-root location.

`design-system/` (the first direction) stays exactly where it is. The two directions are
drop-in swappable by design; relocating only one of them would break that symmetry for no
gain.

---

## Milestones and configuration gates

Ordering note: **schema lands before auth.** Both auth flows write to `developers` /
`stakeholders` and activate invite rows, so those tables must exist first. This is the one
reordering from the originally-proposed sequence.

### M0 — Monorepo and scaffold · *no gate*

- npm workspaces root; `apps/web` created with Next 15.5.22, TypeScript, App Router.
- `git mv design-system-ledger packages/design-system-ledger`; fix its internal paths.
- Ledger integrated into the app, per its README's Next adapter:
  - `ledger.css` imported once in the root layout.
  - `styles/fonts.css` `@import` removed from the bundle; Geist supplied via `next/font`,
    with `--lg-font-sans` / `--lg-font-mono` pointed at the generated variables. (The Ledger
    README is explicit that the `@import` must not ship — it blocks render and cannot be
    preloaded.)
  - App wrapped once in `<LedgerIcons>`.
  - `@/*` path alias added to `tsconfig.json`.
- `/ledger` route rendering the existing gallery, so the design system stays verifiable
  from inside the real app.
- Vitest configured at the root, projects per workspace.
- `env.ts` — a Zod-validated, **runtime**-read environment module. Never baked at build time.
- Host-agnostic Next config (see Host-agnostic guarantees, below).
- **Auth.js compatibility is verified here**, before anything depends on it.

### M1 — `packages/contracts` · *no gate* · **orchestrator handoff**

Pure types plus one stub. No runtime dependencies. This is what unblocks the parallel
orchestrator workstream, which is why it lands this early despite nothing in M2–M5 needing
it yet.

```ts
export type RepoCommit = { repo: string; commitSha: string };

export type EvaluatorInput = {
  claim: { repoCommits: RepoCommit[] };
  requirements: {
    requirementVersionId: string;
    title: string;
    description: string;
  }[];
  github: GitHubReadTool;
};

/** File/diff access scoped to specific commit SHAs, authenticated as the requesting
 *  developer's own live OAuth token. The token is injected by the caller and is never
 *  stored, logged, or serialised into either output artifact. */
export interface GitHubReadTool {
  readFile(repo: string, sha: string, path: string): Promise<string>;
  listTree(repo: string, sha: string, path?: string): Promise<TreeEntry[]>;
  diff(repo: string, baseSha: string, headSha: string): Promise<string>;
}

export type EvidenceBundle = {
  evaluationId: string;
  claimId: string;
  toolCallLog: ToolCall[];
};

export type Report = {
  evaluationId: string;
  claimId: string;
  modelId: string;
  promptTemplateVersion: string;
  createdAt: string;
  perRequirement: {
    requirementVersionId: string;
    verdict: 'satisfied' | 'not_satisfied';
    rationale: string;
  }[];
};

export interface Evaluator {
  evaluate(input: EvaluatorInput): Promise<{
    evidence: EvidenceBundle;
    report: Report;
  }>;
}
```

The two output artifacts are returned as structurally separate objects and are never merged
— per README's black-box contract, which is explicit that merging them is a design error.

`packages/orchestrator` ships in this milestone as a stub implementing `Evaluator` and
throwing `NotImplementedError`. The parallel workstream replaces its internals; nothing in
this build imports it yet.

### M2 — `packages/db` · *authoring unblocked; applying needs **Gate A***

All nine tables from plan 01, transcribed exactly:
`stakeholders`, `developers`, `projects`, `project_stakeholders`, `project_developers`,
`project_developer_invites`, `project_stakeholder_invites`, `requirements`,
`requirement_versions` — plus `verification_tokens` for the stakeholder magic-link adapter.

`project_stakeholder_invites` is created but has no endpoint and no UI, exactly as plan 01
specifies. Its purpose is that multi-stakeholder support later needs no migration.

Constraints enforced **in Postgres**, not in application code:

- partial unique index on `(project_id, github_user_id) WHERE status = 'pending'`
- unique `(project_id, stakeholder_id)`, unique `(project_id, developer_id)`
- unique `(requirement_id, version_number)`
- `requirements.current_version_id` **nullable**, exactly as plan 01 specifies — null only
  transiently inside the create transaction (insert requirement → insert version → update
  pointer), never null once the transaction commits. This and `requirement_versions.
  requirement_id` form a circular reference, which Drizzle expresses with an
  `AnyPgColumn` return-type annotation on the `.references()` callback
- `developers.github_user_id` unique; it is the join key everywhere. `github_username` is
  cache-only and carries no constraint, per plan 01 invariant 2.

There is deliberately **no `status` column on `requirements`**. Effective status is resolved
through `current_version_id` at read time, per plan 01 and the Ledger README, which both
state that storing it would desync.

Migrations are authored and their SQL generated without a live database. Only `drizzle-kit
push`/`migrate` needs Gate A.

> ### ⏸ Gate A — Supabase project
> Full step-by-step instructions delivered when this gate is reached. Produces:
> `DATABASE_URL` (pooled connection string).

Tests create and drop a uniquely-named schema per run inside that same project, so no second
database and no Docker is required.

### M3 — Authentication · *needs **Gate B***

```
/api/auth/dev/*   GitHub provider · no adapter · JWT strategy
/api/auth/sh/*    custom email provider · stakeholders-only adapter · JWT strategy
                  sendVerificationRequest → MagicLinkSender (console)
```

**Developer flow**, on every successful callback (plan 01, Identity & authentication):

1. Extract GitHub numeric user ID, username, avatar.
2. Upsert `developers` by `github_user_id`, refreshing cached `github_username` and
   `avatar_url`.
3. In a single transaction: for every `project_developer_invites` row matching that
   `github_user_id` with `status = 'pending'`, create the `project_developers` row with
   `added_by` = the invite's `invited_by`, and set the invite to `accepted`.
4. Establish the session, retaining the OAuth access token **in the encrypted JWE cookie
   only**. It is never written to any table, never logged, and never included in an API
   response.

**Stakeholder flow**: upsert `stakeholders` by email; run the equivalent (currently no-op)
pass over `project_stakeholder_invites`; establish the session.

**Session resolution:**

```ts
type Session =
  | { kind: 'stakeholder'; stakeholderId: string }
  | { kind: 'developer'; developerId: string; githubAccessToken: string };

requireSession(): Promise<Session>            // 401 if neither cookie resolves
requireStakeholder(): Promise<StakeholderSession>
requireDeveloper(): Promise<DeveloperSession>
requireProjectMember(projectId): Promise<Session>              // 403
requireStakeholderMember(projectId): Promise<StakeholderSession> // 403
```

These helpers are the **only** place plan 01's authorization matrix is expressed. No
authorization logic is duplicated into route handlers, server components, or middleware.

**Middleware carries no authorization** — only unauthenticated redirects. On Vercel,
middleware runs on the Edge runtime; self-hosted, it runs in Node. Keeping authorization out
of it eliminates the single largest behavioural difference between the two deployment
targets.

Login pages ship in this milestone, styled with Ledger components:
`/login` (role entry), `/login/email` (magic-link request and confirmation).

> ### ⏸ Gate B — GitHub OAuth app
> Full step-by-step instructions delivered when reached. Produces:
> `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`. Requests `repo` scope — no GitHub App, no
> installation, no service credential, per README.

Stakeholder login needs no gate at all: the magic link is printed to the server console, so
the flow is complete and clickable from the first run.

### M4 — Plan 01 API · *no gate*

All ten endpoints from plan 01's API contract, implemented test-first:

```
POST   /api/projects
GET    /api/projects
GET    /api/projects/:projectId
POST   /api/projects/:projectId/developers/invites
GET    /api/projects/:projectId/developers
POST   /api/projects/:projectId/requirements
GET    /api/projects/:projectId/requirements
GET    /api/requirements/:id
PATCH  /api/requirements/:id
DELETE /api/requirements/:id
```

Two behaviours that carry real concurrency risk and are called out explicitly:

- **Requirement create** is one transaction: `requirements` row → `requirement_versions` row
  (`version_number = 1`, `status = 'new'`) → set `current_version_id`.
- **Requirement edit** takes `SELECT ... FOR UPDATE` on the parent `requirements` row before
  computing `version_number = max + 1`, per plan 01's row-lock requirement. Without it,
  concurrent edits collide on the `(requirement_id, version_number)` unique constraint.

A new `requirement_versions` row always starts at `status = 'new'` unconditionally — plan 01
invariant 4. This is what makes "editing a verified requirement reopens it" fall out with no
special-case logic, so it must not be made conditional.

### M5 — Checklist UI · *no gate*

| Route | Role | Notes |
|---|---|---|
| `/projects` | both | project list |
| `/projects/new` | stakeholder | |
| `/projects/[id]` | both | requirement checklist, `ChecklistProgress`, members summary |
| `/projects/[id]/requirements/new` | stakeholder | routed page, not a dialog |
| `/requirements/[id]` | both | detail plus full version history as a `Timeline` |
| `/requirements/[id]/edit` | stakeholder | routed page, not a dialog |
| `/projects/[id]/members` | both | list; invite form is stakeholder-only |

Ledger ships no modal/dialog and no pagination — its README states these are deliberately
absent until a real page needs them, so their API is shaped by a real caller. Accordingly,
requirement create and edit are **routed pages with inline forms**. If a dialog turns out to
be genuinely necessary, it is added to the design system properly, with a render-check
assertion, rather than hand-rolled inside the app.

Display rules the UI must respect, all already encoded in the Ledger components:

- The string `eval_failed` never reaches a screen. `StatusBadge` renders it as
  **"Not satisfied"** in solid ink. It is a legitimate verdict, not a malfunction.
- Genuine infrastructure failures use `SystemErrorBadge` / `Alert tone="danger"` in red,
  never ink — they say nothing about whether code satisfies a requirement.
- `archived` is not a fourth status. An archived row dims its title, keeps its badge at full
  strength, and takes a dashed chip. `RequirementDisplayStatus` folds the two axes for
  display only and is never persisted.
- Dates are absolute, never relative.
- Language stays relationship-neutral — never "client", "investor", or "manager".

---

## Host-agnostic guarantees

The deployment host is deliberately undecided. These keep that decision cheap:

| Concern | Commitment |
|---|---|
| Build output | `output: 'standalone'` — a self-contained Node server. Runs under `node server.js` on Railway/Render/Fly/Docker; harmlessly ignored by Vercel |
| Runtime | Node everywhere. No `export const runtime = 'edge'` |
| DB driver | `pg` over a standard pooled connection string. Not `@vercel/postgres`, not an HTTP driver |
| Session | Stateless encrypted JWT cookie. No session table, no sticky sessions. Also forced by the token-custody rule |
| Vercel primitives | None. No `waitUntil`, no `@vercel/blob`, no `vercel.json` crons |
| Middleware | Unauthenticated redirects only — the Edge/Node split never affects authorization |
| Evaluator | A plain `async` function behind the `Evaluator` interface. The route handler is a thin adapter. Moving to a long-lived host changes where it is called from, not the function |
| Execution ceiling | `EVAL_CEILING_SECONDS`, read at runtime. Feeds `EvaluationProgress`'s `ceilingSeconds` prop, which turns the elapsed clock ochre past 70% — so the warning threshold is host-configurable rather than hardcoded |

Consequence accepted: Vercel Cron and edge-middleware performance are unavailable. Neither
is needed.

---

## Testing

Vitest, integration-first, against a real Postgres schema created and dropped per run.
Handlers are written after their tests.

Coverage targets the invariants that actually break, not line count:

- transaction atomicity on project create and requirement create
- concurrent `PATCH` producing distinct `version_number`s under the row lock
- new versions starting at `new` even when the prior version was `verified`
- unique-constraint behaviour on duplicate pending invites
- the invite-to-existing-developer branch skipping the pending state entirely
- every cell of plan 01's authorization matrix, including non-member 403s
- archiving permitted in any status; no un-archive endpoint exists

### Two structural guardrails

1. **Host-agnosticism test** — asserts no `runtime = 'edge'` export and no `@vercel/*` import
   anywhere in `apps/web`. Without it the guarantee above rots silently.
2. **Enum parity test** — asserts `packages/contracts` domain enums match
   `packages/design-system-ledger/components/types.ts`. That file is byte-identical across
   both design directions on purpose; the typechecker cannot catch drift between a design
   system and a separate contracts package, and drift there means one surface tells a user
   something another does not.

The Ledger's existing `npm run verify` (typecheck + render check) continues to run
unchanged, and is extended as new components are added.

---

## Out of scope

Repo attachment (`docs/plans/02`), claim submission, the LangGraph Evaluator's internals,
the Transparency Log, any stakeholder-invite endpoint or UI, un-archiving, and any
evidence-disclosure mechanism.

No surface built here may present real verdict output as if produced by the Evaluator — it
does not exist yet.
