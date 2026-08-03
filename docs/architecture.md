# Architecture

How ZKCVP is built and what is decided. `docs/plans/01-requirement-management.md` and
`docs/plans/02-repo-attachment.md` remain the authority on business rules — where this
document and those disagree about a rule, they win.

## Stack decisions

| Question | Decision |
|---|---|
| Repo layout | npm workspaces monorepo |
| Framework | Next.js **15.5.22, pinned exact**. React 19 |
| Auth | Auth.js v5 (`next-auth`, pinned exact), **two separate instances** |
| ORM / DB | Drizzle ORM over `pg`, against Supabase-as-hosted-Postgres |
| Magic-link delivery | Console transport behind a `MagicLinkSender` seam. No external provider |
| Tests | Vitest, integration-first against real Postgres |

Still deliberately open: the deployment host, the Transparency Log backend, claim-submission
request/response shape, evidence disclosure.

### Why Next 15, pinned exact

`next-auth@5` is a long-running beta validated against Next 15, not 16. Pinning removes a
compatibility risk at zero cost — nothing in the host-agnostic design needs a Next 16 feature.
`next-auth` is pinned exact for the same reason. React 19 matches what
`packages/design-system-ledger` already declares.

### Why Drizzle, and why Supabase is only Postgres

Drizzle emits readable `.sql` migrations and ships no query-engine binary, keeping cold starts
low if a serverless host is chosen. Supabase supplies the Postgres instance and nothing else:
no `supabase-js`, no Row Level Security, no Supabase Auth. Authorization lives in the app layer
where plan 01's matrix is written. Moving to Neon, Railway, or local Postgres is a
connection-string change.

### Why two Auth.js instances

Plan 01 mandates two disjoint identity tables and no shared session type. Auth.js's adapter
interface assumes exactly one user table, and with an adapter present it routes OAuth sign-ins
through `adapter.createUser`/`linkAccount` regardless of session strategy — so a single
instance would need an adapter that inspects which provider is mid-call and writes to a
different table.

- **Developer** — GitHub provider, **no adapter**, JWT strategy. Auth.js needs no adapter for
  OAuth + JWT, so nothing tries to create a user row; the `developers` upsert happens in our
  own `signIn` callback.
- **Stakeholder** — custom `type: 'email'` provider with a small adapter mapping only to
  `stakeholders` and `verification_tokens`. It never sees a GitHub sign-in.

### Why email delivery is a seam

```ts
type MagicLinkSender = (args: { email: string; url: string }) => Promise<void>;
```

The stakeholder provider's `sendVerificationRequest` delegates to whichever sender `env.ts`
selects. A console sender is the only implementation that ships. Adding Resend or SMTP later
is one function and one env value — provider, adapter, token table, and tests stay untouched.
The full stakeholder flow is demoable with zero external configuration.

---

## Repository layout

```
zkcvp/
├── apps/
│   └── web/                      Next.js — UI, CRUD API, orchestrator entrypoint
├── packages/
│   ├── contracts/                Evaluator I/O types, domain enums, GitHub tool interface
│   ├── db/                       Drizzle schema, migrations, client factory
│   ├── github/                   GitHub client — token funnel; methods added as needed
│   ├── design-system-ledger/     tokens, components, gallery
│   └── orchestrator/             LangGraph Evaluator — built in a parallel workstream
└── docs/
```

One deployable: Next transpiles workspace packages into the same bundle via
`transpilePackages`.

**Dependency rule:** packages never depend on `apps/web`. `packages/orchestrator` depends only
on `@zkcvp/contracts` in production — it receives a `GitHubReadTool` as a parameter and never
imports a concrete implementation.

---

## Status

Built: the workspace, `apps/web` with the design system wired in, `@zkcvp/contracts`,
and `@zkcvp/db` with all 10 tables migrated to Supabase (Gate A done — `DATABASE_URL` is
populated in `apps/web/.env.local` and `packages/db/.env`, both gitignored).

`next-auth@5.0.0-beta.32` is already installed in `apps/web` and pinned exact, but nothing
imports it yet. The `verification_tokens` table already exists for the stakeholder adapter.

Next: **M3 — OAuth and the GitHub token funnel.** Needs Gate B (see below).

---

## M3 — OAuth and the GitHub token funnel

Deliberately small: get both login flows working end to end, and stand up the seam that hands
a developer's GitHub token to whoever needs it. Nothing more — no GitHub API surface, no read
tool. Ordered before the plan-01 API so the orchestrator workstream has a real token source to
build against.

```
/api/auth/dev/*   GitHub provider · no adapter · JWT strategy
/api/auth/sh/*    custom email provider · stakeholders-only adapter · JWT strategy
```

**Developer callback** (plan 01, Identity & authentication):

1. Extract GitHub numeric user ID, username, avatar.
2. Upsert `developers` by `github_user_id`, refreshing cached `github_username`/`avatar_url`.
3. In one transaction: for every `project_developer_invites` row matching that
   `github_user_id` with `status = 'pending'`, create the `project_developers` row
   (`added_by` = the invite's `invited_by`) and set the invite to `accepted`.
4. Establish the session, retaining the OAuth access token **in the encrypted JWE cookie
   only** — never written to a table, never logged, never in an API response.

**Stakeholder callback**: upsert `stakeholders` by email; equivalent (currently no-op) pass
over `project_stakeholder_invites`; establish the session.

**Session resolution** — the only place plan 01's authorization matrix is expressed. No
authorization logic is duplicated into route handlers, server components, or middleware.

```ts
type Session =
  | { kind: 'stakeholder'; stakeholderId: string }
  | { kind: 'developer'; developerId: string; githubAccessToken: string };

requireSession(): Promise<Session>                                // 401
requireStakeholder(): Promise<StakeholderSession>
requireDeveloper(): Promise<DeveloperSession>
requireProjectMember(projectId): Promise<Session>                 // 403
requireStakeholderMember(projectId): Promise<StakeholderSession>  // 403
```

**Middleware carries no authorization** — unauthenticated redirects only. Middleware runs on
Edge on Vercel and in Node self-hosted; keeping authorization out of it eliminates the largest
behavioural difference between deployment targets.

### `packages/github` — token funnel only

M3 creates this package with **only** the auth-token plumbing: a client constructed from a
developer's session access token, and nothing else. No fetch calls, no API methods.

```ts
// the whole M3 surface
export function createGitHubClient(accessToken: string): GitHubClient;
```

Native `fetch`, no SDK, no dependency on Next.js. Methods get added **as a caller actually
needs them**, not up front — `resolveGithubUser` arrives in M4 with the invite endpoint.

**The `GitHubReadTool` implementation is not built here.** Reading repo contents at pinned
commits is the orchestrator workstream's concern; it owns that implementation and takes a
token. `apps/web`'s job is to hold the token in the session and hand it over — that seam is
what this package is for.

Wiring the two together end-to-end (a disposable endpoint that constructs a read tool and
calls `evaluate()`) belongs to whoever has a working read tool first. Not M3.

> **⏸ Gate B — GitHub OAuth app.** Produces `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`. Requests
> `repo` scope — no GitHub App, no installation, no service credential. Stakeholder login needs
> no gate; the magic link prints to the console.

Login pages ship here, styled with Ledger components: `/login`, `/login/email`.

---

## M4 — Requirement management and the stakeholder UI

Plan 01's ten endpoints plus the stakeholder-facing screens, built together rather than as two
separate passes. `packages/github` gains `resolveGithubUser` here — the invite endpoint is its
first real caller. Keep adding GitHub methods only when a caller needs one.

All ten endpoints, test-first:

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

Two behaviours carry real concurrency risk:

- **Requirement create** is one transaction: `requirements` row → `requirement_versions` row
  (`version_number = 1`, `status = 'new'`) → set `current_version_id`.
- **Requirement edit** takes `SELECT ... FOR UPDATE` on the parent `requirements` row before
  computing `version_number = max + 1`. Without it, concurrent edits collide on the
  `(requirement_id, version_number)` unique constraint.

A new `requirement_versions` row always starts at `status = 'new'` unconditionally (plan 01
invariant 4) — this is what makes "editing a verified requirement reopens it" fall out with no
special-case logic. It must not become conditional.

When the first `apps/web` code imports `@zkcvp/db` or `@zkcvp/contracts`, add them to
`apps/web/package.json`'s `dependencies` — they are in `transpilePackages` but currently
resolve only via workspace hoisting.

---

## M5 — Remaining checklist screens

Runs with M4 rather than after it; split out here only because the route list is long.

| Route | Role | Notes |
|---|---|---|
| `/projects` | both | project list |
| `/projects/new` | stakeholder | |
| `/projects/[id]` | both | checklist, `ChecklistProgress`, members summary |
| `/projects/[id]/requirements/new` | stakeholder | routed page, not a dialog |
| `/requirements/[id]` | both | detail plus version history as a `Timeline` |
| `/requirements/[id]/edit` | stakeholder | routed page, not a dialog |
| `/projects/[id]/members` | both | list; invite form is stakeholder-only |

Ledger ships no modal and no pagination — deliberately absent until a real caller shapes their
API. Create and edit are routed pages with inline forms. If a dialog proves necessary it is
added to the design system properly, with a render-check assertion, not hand-rolled in the app.

Display rules, all already encoded in the Ledger components:

- The string `eval_failed` never reaches a screen. `StatusBadge` renders it as **"Not
  satisfied"** — a legitimate verdict, not a malfunction.
- Infrastructure failures use `SystemErrorBadge` / `Alert tone="danger"` in red, never ink.
- `archived` is not a fourth status; it dims the title, keeps the badge, takes a dashed chip.
  `RequirementDisplayStatus` folds the two axes for display only and is never persisted.
- Dates are absolute, never relative.
- Language stays relationship-neutral — never "client", "investor", or "manager".

---

## Host-agnostic guarantees

The deployment host is undecided. These keep the decision cheap:

| Concern | Commitment |
|---|---|
| Build output | `output: 'standalone'` — self-contained Node server. Runs under `node server.js` on Railway/Render/Fly/Docker; ignored by Vercel |
| Runtime | Node everywhere. No `export const runtime = 'edge'` |
| DB driver | `pg` over a pooled connection string. Not `@vercel/postgres`, not an HTTP driver |
| Session | Stateless encrypted JWT cookie. No session table, no sticky sessions — also forced by token custody |
| Vercel primitives | None. No `waitUntil`, no `@vercel/blob`, no `vercel.json` crons |
| Middleware | Unauthenticated redirects only |
| Evaluator | A plain `async` function behind the `Evaluator` interface; the route handler is a thin adapter |
| Execution ceiling | `EVAL_CEILING_SECONDS`, read at runtime. Feeds `EvaluationProgress`'s `ceilingSeconds` |

Accepted consequence: Vercel Cron and edge-middleware performance are unavailable. Neither is
needed.

---

## Testing

Vitest, integration-first, against a real Postgres schema created and dropped per run
(`packages/db/tests/harness.ts`). Handlers are written after their tests.

Coverage targets invariants that actually break, not line count: transaction atomicity on
create, concurrent `PATCH` under the row lock, new versions starting at `new`, partial-index
behaviour on duplicate pending invites, the invite-to-existing-developer branch, every cell of
plan 01's authorization matrix, and archiving in any status.

Two structural guardrails:

1. **Host-agnosticism** — asserts no `runtime = 'edge'` export and no `@vercel/*` import in
   `apps/web`. Extend to `packages/**` when a package gains a runtime adapter.
2. **Enum parity** — asserts `@zkcvp/contracts` domain enums match
   `packages/design-system-ledger/components/types.ts`, which is the UI-facing source of truth.
   The two packages have no compile-time link, so textual comparison is the only available
   check.

`npm run verify` runs typecheck, tests, and the design system's render check — the render check
is where the `eval_failed` display rule is actually enforced.

---

## Out of scope

Repo attachment (`docs/plans/02`), claim submission, the Evaluator's internals, the
Transparency Log, stakeholder-invite endpoint or UI, un-archiving, evidence disclosure.

No surface may present real verdict output as if produced by the Evaluator — it does not exist
yet.
