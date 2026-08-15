# M4 — Requirement Management and the Stakeholder UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Transient artifact.** This file is live context for the duration of M4 only. Delete it when M4 completes — `docs/architecture.md` is the durable record.

**Goal:** Ship plan 01's ten endpoints, `resolveGithubUser`, `middleware.ts`, and seven stakeholder-facing screens, on top of the M3 auth layer.

**Architecture:** Business rules live in `(db, session, args)` service functions under `apps/web/lib/projects/` and `apps/web/lib/requirements/`. Each calls the existing predicates in `lib/auth/authorization.ts` and throws `ServiceError`. Route handlers are thin JSON adapters; Server Components and Server Actions call the same services directly. Neither path holds a rule, so they cannot diverge.

**Tech Stack:** Next.js 15.5.22 (App Router, pinned exact) · React 19 · Drizzle ORM 0.45 over `pg` · Zod 4 · Vitest against real Postgres via `withTestSchema` · `@zkcvp/design-system-ledger`.

## Global Constraints

- **Node runtime everywhere.** Never write `export const runtime = 'edge'`. Never import `@vercel/*`. `apps/web/tests/host-agnostic.test.ts` enforces both.
- **`github_user_id` is GitHub's numeric id stored as `text`** — never the username, never a join key on username. Plan 01 invariant 2.
- **A new `requirement_versions` row is always `status: 'new'`**, written explicitly at the insert, never conditional. Plan 01 invariant 4.
- **`archived_at` and version `status` are orthogonal.** Never let one imply or overwrite the other. Plan 01 invariant 5.
- **`eval_failed` never reaches a screen as a raw string.** It renders only through `StatusBadge`, which maps it to "Not satisfied".
- **Infrastructure failures use `Alert tone="danger"` / `SystemErrorBadge`**, never ink, and are never conflated with a negative verdict.
- **Dates are absolute, never relative.** No "3 days ago".
- **Copy is relationship-neutral.** Never "client", "investor", "manager".
- **Requirement text is immutable.** Editing creates a version; it never updates one.
- Import Ledger components from `@zkcvp/design-system-ledger/components` only — never from individual files.
- Every DB-touching test wraps its body in `withTestSchema` and passes the `HOUR` timeout constant, matching `apps/web/tests/auth/authorization.test.ts`.

**Verification gate for every task:** `npm run verify` (typecheck + Vitest + design system render check) must pass before the commit step.

---

### Task 1: Error vocabulary and the DB accessor

**Files:**
- Create: `apps/web/lib/db.ts`
- Create: `apps/web/lib/api/errors.ts`
- Create: `apps/web/lib/api/respond.ts`
- Test: `apps/web/tests/api/respond.test.ts`

**Interfaces:**
- Consumes: `SessionError` from `apps/web/lib/auth/session.ts` (existing, carries `status: 401 | 403`).
- Produces: `getDb(): Db` · `ServiceError(status, code, message, details?)` · `forbidden()` · `notFound()` · `conflict()` · `invalidBody()` · `githubUnavailable()` · `errorResponse(e: unknown): Response` · `handle(fn): Promise<Response>`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/api/respond.test.ts`:

```ts
// apps/web/tests/api/respond.test.ts
import { describe, expect, it } from "vitest";
import { SessionError } from "../../lib/auth/session";
import { ServiceError, conflict, notFound } from "../../lib/api/errors";
import { errorResponse, handle } from "../../lib/api/respond";

describe("errorResponse", () => {
  it("maps a ServiceError to its status and code", async () => {
    const res = errorResponse(conflict("Already a member of this project"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "conflict", message: "Already a member of this project" },
    });
  });

  it("maps a 401 SessionError to code unauthenticated", async () => {
    const res = errorResponse(new SessionError(401, "Authentication required"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  it("maps a 403 SessionError to code forbidden", async () => {
    const res = errorResponse(new SessionError(403, "Not a member of this project"));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("includes details when present", async () => {
    const e = new ServiceError(400, "invalid_body", "Invalid request body", [
      { path: "name", message: "Required" },
    ]);
    expect((await errorResponse(e).json()).error.details).toEqual([
      { path: "name", message: "Required" },
    ]);
  });

  it("rethrows anything it does not recognise, so a bug surfaces as a 500", () => {
    expect(() => errorResponse(new Error("boom"))).toThrow("boom");
  });
});

describe("handle", () => {
  it("returns the handler's response when nothing throws", async () => {
    const res = await handle(async () => Response.json({ ok: true }, { status: 201 }));
    expect(res.status).toBe(201);
  });

  it("converts a thrown ServiceError into a response", async () => {
    const res = await handle(async () => {
      throw notFound("No such requirement");
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/tests/api/respond.test.ts`
Expected: FAIL — cannot resolve `../../lib/api/errors`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/api/errors.ts`:

```ts
// apps/web/lib/api/errors.ts

/**
 * The complete error vocabulary of the M4 API. Plan 01 fixes the status codes
 * for every endpoint but says nothing about the body, so the shape is decided
 * here once rather than per handler.
 */
export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_body"
  | "github_unavailable";

export class ServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const forbidden = (message = "Not a member of this project") =>
  new ServiceError(403, "forbidden", message);

export const notFound = (message = "Not found") =>
  new ServiceError(404, "not_found", message);

export const conflict = (message: string) =>
  new ServiceError(409, "conflict", message);

export const invalidBody = (details: unknown) =>
  new ServiceError(400, "invalid_body", "Invalid request body", details);

/**
 * The GitHub lookup is unauthenticated by plan-01 rule and therefore shares one
 * 60/hour budget across every stakeholder on the deployment. Exhaustion is an
 * infrastructure failure, NOT "no such user" — reporting it as 404 would tell a
 * stakeholder something false about a real person.
 */
export const githubUnavailable = (
  message = "GitHub could not be reached. Try again shortly.",
) => new ServiceError(503, "github_unavailable", message);

/** Postgres unique-violation SQLSTATE. */
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  );
}
```

Create `apps/web/lib/api/respond.ts`:

```ts
// apps/web/lib/api/respond.ts
import { SessionError } from "../auth/session";
import { ServiceError } from "./errors";

/**
 * The ONLY place an error becomes a response.
 *
 * Anything unrecognised is rethrown rather than flattened into a generic 500
 * body — an unexpected throw is a bug, and dressing it up as a well-formed API
 * error hides it.
 */
export function errorResponse(e: unknown): Response {
  if (e instanceof ServiceError) {
    return Response.json(
      {
        error: {
          code: e.code,
          message: e.message,
          ...(e.details === undefined ? {} : { details: e.details }),
        },
      },
      { status: e.status },
    );
  }

  if (e instanceof SessionError) {
    return Response.json(
      {
        error: {
          code: e.status === 403 ? "forbidden" : "unauthenticated",
          message: e.message,
        },
      },
      { status: e.status },
    );
  }

  throw e;
}

export async function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    return errorResponse(e);
  }
}
```

Create `apps/web/lib/db.ts`:

```ts
// apps/web/lib/db.ts
import { createDb, type Db } from "@zkcvp/db";
import { env } from "./env";

/**
 * One accessor for the pooled client. `createDb` memoises the pool internally,
 * so repeated calls are free; this exists so `env().DATABASE_URL` is not spelled
 * out at every call site the way session.ts had to before M4.
 */
export function getDb(): Db {
  return createDb(env().DATABASE_URL);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/tests/api/respond.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/db.ts apps/web/lib/api apps/web/tests/api
git commit -m "feat(api): error vocabulary, response mapping and a db accessor"
```

---

### Task 2: `resolveGithubUser`

**Files:**
- Modify: `packages/github/src/index.ts`
- Test: `packages/github/tests/resolve-user.test.ts`

**Interfaces:**
- Produces: `resolveGithubUser(username: string): Promise<GithubUser>` where `GithubUser = { githubUserId: string; githubUsername: string; displayName: string; avatarUrl: string | null }`. Throws `GithubUserNotFound` or `GithubUnavailable`, both exported.

- [ ] **Step 1: Write the failing test**

Create `packages/github/tests/resolve-user.test.ts`:

```ts
// packages/github/tests/resolve-user.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GithubUnavailable,
  GithubUserNotFound,
  resolveGithubUser,
} from "../src/index";

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveGithubUser", () => {
  it("returns the NUMERIC id as text, never the username, as the identity key", async () => {
    stubFetch(
      Response.json({
        id: 583231,
        login: "octocat",
        name: "The Octocat",
        avatar_url: "https://example.test/o.png",
      }),
    );

    expect(await resolveGithubUser("octocat")).toEqual({
      githubUserId: "583231",
      githubUsername: "octocat",
      displayName: "The Octocat",
      avatarUrl: "https://example.test/o.png",
    });
  });

  it("falls back to the login when the profile has no name", async () => {
    stubFetch(Response.json({ id: 1, login: "ghost", name: null, avatar_url: null }));
    const user = await resolveGithubUser("ghost");
    expect(user.displayName).toBe("ghost");
    expect(user.avatarUrl).toBeNull();
  });

  it("throws GithubUserNotFound for a 404", async () => {
    stubFetch(new Response("", { status: 404 }));
    await expect(resolveGithubUser("nobody")).rejects.toBeInstanceOf(
      GithubUserNotFound,
    );
  });

  /* The decision this whole function turns on: an exhausted rate limit must NOT
   * look like "no such user". Every stakeholder on the deployment shares one
   * unauthenticated 60/hour budget. */
  it("throws GithubUnavailable — not NotFound — when the rate limit is exhausted", async () => {
    stubFetch(
      new Response("", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      }),
    );
    const err = await resolveGithubUser("octocat").catch((e) => e);
    expect(err).toBeInstanceOf(GithubUnavailable);
    expect(err).not.toBeInstanceOf(GithubUserNotFound);
  });

  it("throws GithubUnavailable for a 429 and for a 5xx", async () => {
    stubFetch(
      new Response("", { status: 429, headers: { "x-ratelimit-remaining": "0" } }),
    );
    await expect(resolveGithubUser("a")).rejects.toBeInstanceOf(GithubUnavailable);

    stubFetch(new Response("", { status: 502 }));
    await expect(resolveGithubUser("b")).rejects.toBeInstanceOf(GithubUnavailable);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/github/tests/resolve-user.test.ts`
Expected: FAIL — `resolveGithubUser` is not exported.

- [ ] **Step 3: Append the implementation to `packages/github/src/index.ts`**

Leave `createGitHubClient` exactly as it is and add below it:

```ts
export type GithubUser = {
  /** GitHub's NUMERIC id as text. The only identity key. Never the username. */
  githubUserId: string;
  /** Cache only, for display. */
  githubUsername: string;
  displayName: string;
  avatarUrl: string | null;
};

export class GithubUserNotFound extends Error {
  constructor(username: string) {
    super(`No GitHub user named ${username}`);
    this.name = "GithubUserNotFound";
  }
}

export class GithubUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubUnavailable";
  }
}

/**
 * Resolves a username to a stable numeric id at invite time.
 *
 * UNAUTHENTICATED on purpose: the caller is a stakeholder, who has no GitHub
 * token, and plan 01 rules out any service-level credential. GitHub caps
 * unauthenticated requests at 60/hour per IP, shared by every stakeholder on the
 * deployment — so exhaustion is a real operational condition, not an edge case,
 * and it is reported as unavailability rather than as a missing user.
 */
export async function resolveGithubUser(username: string): Promise<GithubUser> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  } catch (e) {
    throw new GithubUnavailable(
      `Could not reach GitHub: ${e instanceof Error ? e.message : "unknown error"}`,
    );
  }

  if (res.status === 404) throw new GithubUserNotFound(username);

  if (
    (res.status === 403 || res.status === 429) &&
    res.headers.get("x-ratelimit-remaining") === "0"
  ) {
    throw new GithubUnavailable(
      "GitHub's unauthenticated rate limit is exhausted. Try again shortly.",
    );
  }

  if (!res.ok) throw new GithubUnavailable(`GitHub returned ${res.status}`);

  const body = (await res.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };

  return {
    githubUserId: String(body.id),
    githubUsername: body.login,
    displayName: body.name ?? body.login,
    avatarUrl: body.avatar_url ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/github/tests/resolve-user.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/github
git commit -m "feat(github): resolveGithubUser, mapping rate-limit exhaustion to unavailable"
```

---

### Task 3: Projects service — create, list, get

**Files:**
- Create: `apps/web/lib/projects/service.ts`
- Test: `apps/web/tests/projects/service.test.ts`

**Interfaces:**
- Consumes: `ServiceError`, `forbidden`, `notFound` from `lib/api/errors`; `isProjectMember`, `isStakeholderMember` from `lib/auth/authorization`; `Session` from `lib/auth/types`.
- Produces:
  - `createProject(db: Db, session: StakeholderSession, input: { name: string }): Promise<ProjectSummary>`
  - `listProjects(db: Db, session: Session): Promise<ProjectSummary[]>`
  - `getProject(db: Db, session: Session, projectId: string): Promise<ProjectSummary>`
  - `type ProjectSummary = { id: string; name: string; createdBy: string; createdAt: Date }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/projects/service.test.ts`:

```ts
// apps/web/tests/projects/service.test.ts
import { describe, expect, it } from "vitest";
import { withTestSchema } from "@zkcvp/db/testing";
import { eq } from "drizzle-orm";
import {
  developers,
  projectDevelopers,
  projectStakeholders,
  stakeholders,
} from "@zkcvp/db/schema";
import type { Db } from "@zkcvp/db";
import { createProject, getProject, listProjects } from "../../lib/projects/service";
import { ServiceError } from "../../lib/api/errors";

const HOUR = 60_000;

async function aStakeholder(db: Db, email: string) {
  const [s] = await db
    .insert(stakeholders)
    .values({ email, displayName: email })
    .returning();
  return s;
}

async function aDeveloper(db: Db, githubUserId: string) {
  const [d] = await db
    .insert(developers)
    .values({
      githubUserId,
      githubUsername: `u${githubUserId}`,
      displayName: `U${githubUserId}`,
    })
    .returning();
  return d;
}

describe("createProject", () => {
  it("creates the project and the caller's membership row together", async () => {
    await withTestSchema(async (db) => {
      const s = await aStakeholder(db, "a@example.com");

      const project = await createProject(
        db,
        { kind: "stakeholder", stakeholderId: s.id },
        { name: "Ledger rewrite" },
      );

      expect(project.name).toBe("Ledger rewrite");
      expect(project.createdBy).toBe(s.id);

      const memberships = await db
        .select()
        .from(projectStakeholders)
        .where(eq(projectStakeholders.projectId, project.id));

      expect(memberships).toHaveLength(1);
      expect(memberships[0].stakeholderId).toBe(s.id);
      /* created_by is display/audit only; the membership row is the
       * access-control source of truth. Both must exist. */
      expect(memberships[0].addedBy).toBe(s.id);
    });
  }, HOUR);
});

describe("listProjects", () => {
  it("returns only projects the caller belongs to, per caller kind", async () => {
    await withTestSchema(async (db) => {
      const mine = await aStakeholder(db, "mine@example.com");
      const theirs = await aStakeholder(db, "theirs@example.com");

      const a = await createProject(
        db,
        { kind: "stakeholder", stakeholderId: mine.id },
        { name: "Mine" },
      );
      await createProject(
        db,
        { kind: "stakeholder", stakeholderId: theirs.id },
        { name: "Theirs" },
      );

      const listed = await listProjects(db, {
        kind: "stakeholder",
        stakeholderId: mine.id,
      });
      expect(listed.map((p) => p.name)).toEqual(["Mine"]);
      expect(listed[0].id).toBe(a.id);
    });
  }, HOUR);

  it("returns a developer's projects through project_developers", async () => {
    await withTestSchema(async (db) => {
      const s = await aStakeholder(db, "s@example.com");
      const d = await aDeveloper(db, "424242");
      const p = await createProject(
        db,
        { kind: "stakeholder", stakeholderId: s.id },
        { name: "Shared" },
      );
      await db
        .insert(projectDevelopers)
        .values({ projectId: p.id, developerId: d.id, addedBy: s.id });

      const listed = await listProjects(db, {
        kind: "developer",
        developerId: d.id,
        githubAccessToken: "tok",
      });
      expect(listed.map((p) => p.name)).toEqual(["Shared"]);
    });
  }, HOUR);
});

describe("getProject", () => {
  it("throws 403 for a non-member", async () => {
    await withTestSchema(async (db) => {
      const owner = await aStakeholder(db, "owner@example.com");
      const outsider = await aStakeholder(db, "outsider@example.com");
      const p = await createProject(
        db,
        { kind: "stakeholder", stakeholderId: owner.id },
        { name: "Private" },
      );

      const err = await getProject(
        db,
        { kind: "stakeholder", stakeholderId: outsider.id },
        p.id,
      ).catch((e) => e);

      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).status).toBe(403);
    });
  }, HOUR);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/tests/projects/service.test.ts`
Expected: FAIL — cannot resolve `../../lib/projects/service`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/projects/service.ts`:

```ts
// apps/web/lib/projects/service.ts
import { and, eq } from "drizzle-orm";
import {
  projectDevelopers,
  projectStakeholders,
  projects,
  type Db,
} from "@zkcvp/db";
import { isProjectMember } from "../auth/authorization";
import type { Session, StakeholderSession } from "../auth/types";
import { forbidden, notFound } from "../api/errors";

export type ProjectSummary = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
};

/**
 * One transaction: the project row and the creator's membership row. A project
 * whose creator is not a member of it would be invisible to its own creator,
 * because `projects.created_by` is display/audit only and authorization always
 * reads a membership row.
 */
export async function createProject(
  db: Db,
  session: StakeholderSession,
  input: { name: string },
): Promise<ProjectSummary> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ name: input.name, createdBy: session.stakeholderId })
      .returning();

    await tx.insert(projectStakeholders).values({
      projectId: project.id,
      stakeholderId: session.stakeholderId,
      addedBy: session.stakeholderId,
    });

    return project;
  });
}

export async function listProjects(
  db: Db,
  session: Session,
): Promise<ProjectSummary[]> {
  if (session.kind === "stakeholder") {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(
        projectStakeholders,
        eq(projectStakeholders.projectId, projects.id),
      )
      .where(eq(projectStakeholders.stakeholderId, session.stakeholderId))
      .orderBy(projects.createdAt);
    return rows;
  }

  return db
    .select({
      id: projects.id,
      name: projects.name,
      createdBy: projects.createdBy,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(projectDevelopers, eq(projectDevelopers.projectId, projects.id))
    .where(eq(projectDevelopers.developerId, session.developerId))
    .orderBy(projects.createdAt);
}

export async function getProject(
  db: Db,
  session: Session,
  projectId: string,
): Promise<ProjectSummary> {
  if (!(await isProjectMember(db, session, projectId))) throw forbidden();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) throw notFound("No such project");
  return project;
}

/** Shared by every stakeholder-only action on a project. */
export async function assertStakeholderMember(
  db: Db,
  session: Session,
  projectId: string,
): Promise<StakeholderSession> {
  if (session.kind !== "stakeholder") {
    throw forbidden("Only a stakeholder may perform this action");
  }
  const [row] = await db
    .select()
    .from(projectStakeholders)
    .where(
      and(
        eq(projectStakeholders.stakeholderId, session.stakeholderId),
        eq(projectStakeholders.projectId, projectId),
      ),
    );
  if (!row) throw forbidden();
  return session;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/tests/projects/service.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/projects apps/web/tests/projects
git commit -m "feat(projects): create, list and get with membership-based authorization"
```

---

### Task 4: Members service — list and invite

**Files:**
- Create: `apps/web/lib/projects/members.ts`
- Test: `apps/web/tests/projects/members.test.ts`

**Interfaces:**
- Consumes: `assertStakeholderMember` from `lib/projects/service`; `isProjectMember` from `lib/auth/authorization`; `resolveGithubUser`, `GithubUserNotFound`, `GithubUnavailable` from `@zkcvp/github`; `conflict`, `notFound`, `forbidden`, `githubUnavailable`, `isUniqueViolation` from `lib/api/errors`.
- Produces:
  - `listMembers(db, session, projectId): Promise<{ members: MemberRow[]; pendingInvites: InviteRow[] }>`
  - `inviteDeveloper(db, session, projectId, input: { githubUsername: string }, deps?: { resolve?: typeof resolveGithubUser }): Promise<{ kind: "membership"; membership: MemberRow } | { kind: "invite"; invite: InviteRow }>`
  - `type MemberRow = { developerId: string; githubUserId: string; githubUsername: string; displayName: string; avatarUrl: string | null; addedAt: Date }`
  - `type InviteRow = { id: string; githubUserId: string; githubUsername: string; invitedAt: Date }`

The `deps` parameter exists so tests inject a fake resolver instead of stubbing global fetch across a DB test.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/projects/members.test.ts`:

```ts
// apps/web/tests/projects/members.test.ts
import { describe, expect, it } from "vitest";
import { withTestSchema } from "@zkcvp/db/testing";
import { eq } from "drizzle-orm";
import {
  developers,
  projectDeveloperInvites,
  projectDevelopers,
  stakeholders,
} from "@zkcvp/db/schema";
import type { Db } from "@zkcvp/db";
import { GithubUserNotFound, type GithubUser } from "@zkcvp/github";
import { createProject } from "../../lib/projects/service";
import { inviteDeveloper, listMembers } from "../../lib/projects/members";
import { ServiceError } from "../../lib/api/errors";

const HOUR = 60_000;

const octocat: GithubUser = {
  githubUserId: "583231",
  githubUsername: "octocat",
  displayName: "The Octocat",
  avatarUrl: null,
};

const resolvesTo = (user: GithubUser) => ({ resolve: async () => user });
const resolvesMissing = {
  resolve: async () => {
    throw new GithubUserNotFound("ghost");
  },
};

async function aProject(db: Db, email: string) {
  const [s] = await db
    .insert(stakeholders)
    .values({ email, displayName: email })
    .returning();
  const project = await createProject(
    db,
    { kind: "stakeholder", stakeholderId: s.id },
    { name: "P" },
  );
  return { s, project, session: { kind: "stakeholder" as const, stakeholderId: s.id } };
}

describe("inviteDeveloper", () => {
  it("creates a pending invite when no developer row exists yet", async () => {
    await withTestSchema(async (db) => {
      const { project, session } = await aProject(db, "a@example.com");

      const result = await inviteDeveloper(
        db,
        session,
        project.id,
        { githubUsername: "octocat" },
        resolvesTo(octocat),
      );

      expect(result.kind).toBe("invite");
      const invites = await db
        .select()
        .from(projectDeveloperInvites)
        .where(eq(projectDeveloperInvites.projectId, project.id));
      expect(invites).toHaveLength(1);
      /* The NUMERIC id is what gets stored — the username is cache only. */
      expect(invites[0].githubUserId).toBe("583231");
      expect(invites[0].status).toBe("pending");
    });
  }, HOUR);

  it("adds a membership directly, skipping the invite, when the developer already exists", async () => {
    await withTestSchema(async (db) => {
      const { project, session, s } = await aProject(db, "b@example.com");
      await db.insert(developers).values({
        githubUserId: "583231",
        githubUsername: "octocat",
        displayName: "The Octocat",
      });

      const result = await inviteDeveloper(
        db,
        session,
        project.id,
        { githubUsername: "octocat" },
        resolvesTo(octocat),
      );

      expect(result.kind).toBe("membership");
      expect(
        await db
          .select()
          .from(projectDeveloperInvites)
          .where(eq(projectDeveloperInvites.projectId, project.id)),
      ).toHaveLength(0);

      const [membership] = await db
        .select()
        .from(projectDevelopers)
        .where(eq(projectDevelopers.projectId, project.id));
      expect(membership.addedBy).toBe(s.id);
    });
  }, HOUR);

  it("returns 409 on a duplicate pending invite, via the partial unique index", async () => {
    await withTestSchema(async (db) => {
      const { project, session } = await aProject(db, "c@example.com");
      await inviteDeveloper(db, session, project.id, { githubUsername: "octocat" }, resolvesTo(octocat));

      const err = await inviteDeveloper(
        db,
        session,
        project.id,
        { githubUsername: "octocat" },
        resolvesTo(octocat),
      ).catch((e) => e);

      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).status).toBe(409);
    });
  }, HOUR);

  it("allows a fresh invite once the earlier one is accepted — the index covers pending only", async () => {
    await withTestSchema(async (db) => {
      const { project, session } = await aProject(db, "d@example.com");
      await inviteDeveloper(db, session, project.id, { githubUsername: "octocat" }, resolvesTo(octocat));
      await db
        .update(projectDeveloperInvites)
        .set({ status: "accepted" })
        .where(eq(projectDeveloperInvites.projectId, project.id));

      await expect(
        inviteDeveloper(db, session, project.id, { githubUsername: "octocat" }, resolvesTo(octocat)),
      ).resolves.toMatchObject({ kind: "invite" });
    });
  }, HOUR);

  it("returns 409 when the developer is already a member", async () => {
    await withTestSchema(async (db) => {
      const { project, session, s } = await aProject(db, "e@example.com");
      const [d] = await db
        .insert(developers)
        .values({
          githubUserId: "583231",
          githubUsername: "octocat",
          displayName: "The Octocat",
        })
        .returning();
      await db
        .insert(projectDevelopers)
        .values({ projectId: project.id, developerId: d.id, addedBy: s.id });

      const err = await inviteDeveloper(
        db,
        session,
        project.id,
        { githubUsername: "octocat" },
        resolvesTo(octocat),
      ).catch((e) => e);
      expect((err as ServiceError).status).toBe(409);
    });
  }, HOUR);

  it("returns 404 when GitHub has no such user", async () => {
    await withTestSchema(async (db) => {
      const { project, session } = await aProject(db, "f@example.com");
      const err = await inviteDeveloper(
        db,
        session,
        project.id,
        { githubUsername: "ghost" },
        resolvesMissing,
      ).catch((e) => e);
      expect((err as ServiceError).status).toBe(404);
    });
  }, HOUR);
});

describe("listMembers", () => {
  it("returns members and pending invites for a member caller", async () => {
    await withTestSchema(async (db) => {
      const { project, session } = await aProject(db, "g@example.com");
      await inviteDeveloper(db, session, project.id, { githubUsername: "octocat" }, resolvesTo(octocat));

      const { members, pendingInvites } = await listMembers(db, session, project.id);
      expect(members).toHaveLength(0);
      expect(pendingInvites.map((i) => i.githubUsername)).toEqual(["octocat"]);
    });
  }, HOUR);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/tests/projects/members.test.ts`
Expected: FAIL — cannot resolve `../../lib/projects/members`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/projects/members.ts`:

```ts
// apps/web/lib/projects/members.ts
import { and, eq } from "drizzle-orm";
import {
  developers,
  projectDeveloperInvites,
  projectDevelopers,
  type Db,
} from "@zkcvp/db";
import {
  GithubUnavailable,
  GithubUserNotFound,
  resolveGithubUser,
  type GithubUser,
} from "@zkcvp/github";
import { isProjectMember } from "../auth/authorization";
import type { Session } from "../auth/types";
import {
  conflict,
  forbidden,
  githubUnavailable,
  isUniqueViolation,
  notFound,
} from "../api/errors";
import { assertStakeholderMember } from "./service";

export type MemberRow = {
  developerId: string;
  githubUserId: string;
  githubUsername: string;
  displayName: string;
  avatarUrl: string | null;
  addedAt: Date;
};

export type InviteRow = {
  id: string;
  githubUserId: string;
  githubUsername: string;
  invitedAt: Date;
};

export type InviteDeps = { resolve?: (username: string) => Promise<GithubUser> };

export async function listMembers(
  db: Db,
  session: Session,
  projectId: string,
): Promise<{ members: MemberRow[]; pendingInvites: InviteRow[] }> {
  if (!(await isProjectMember(db, session, projectId))) throw forbidden();

  const members = await db
    .select({
      developerId: developers.id,
      githubUserId: developers.githubUserId,
      githubUsername: developers.githubUsername,
      displayName: developers.displayName,
      avatarUrl: developers.avatarUrl,
      addedAt: projectDevelopers.addedAt,
    })
    .from(projectDevelopers)
    .innerJoin(developers, eq(developers.id, projectDevelopers.developerId))
    .where(eq(projectDevelopers.projectId, projectId))
    .orderBy(projectDevelopers.addedAt);

  const pendingInvites = await db
    .select({
      id: projectDeveloperInvites.id,
      githubUserId: projectDeveloperInvites.githubUserId,
      githubUsername: projectDeveloperInvites.githubUsername,
      invitedAt: projectDeveloperInvites.invitedAt,
    })
    .from(projectDeveloperInvites)
    .where(
      and(
        eq(projectDeveloperInvites.projectId, projectId),
        eq(projectDeveloperInvites.status, "pending"),
      ),
    )
    .orderBy(projectDeveloperInvites.invitedAt);

  return { members, pendingInvites };
}

/**
 * Two branches, decided by whether the person already has an identity here.
 *
 * Neither branch checks-then-inserts. The partial unique index
 * (`project_developer_invites_pending_unique`) and the
 * `(project_id, developer_id)` unique constraint are the arbiters, so two
 * simultaneous invites cannot both succeed.
 */
export async function inviteDeveloper(
  db: Db,
  session: Session,
  projectId: string,
  input: { githubUsername: string },
  deps: InviteDeps = {},
): Promise<
  | { kind: "membership"; membership: MemberRow }
  | { kind: "invite"; invite: InviteRow }
> {
  const caller = await assertStakeholderMember(db, session, projectId);
  const resolve = deps.resolve ?? resolveGithubUser;

  let user: GithubUser;
  try {
    user = await resolve(input.githubUsername);
  } catch (e) {
    if (e instanceof GithubUserNotFound) {
      throw notFound(`No GitHub user named ${input.githubUsername}`);
    }
    if (e instanceof GithubUnavailable) throw githubUnavailable(e.message);
    throw e;
  }

  const [existing] = await db
    .select()
    .from(developers)
    .where(eq(developers.githubUserId, user.githubUserId));

  if (existing) {
    try {
      const [row] = await db
        .insert(projectDevelopers)
        .values({
          projectId,
          developerId: existing.id,
          addedBy: caller.stakeholderId,
        })
        .returning();

      return {
        kind: "membership",
        membership: {
          developerId: existing.id,
          githubUserId: existing.githubUserId,
          githubUsername: existing.githubUsername,
          displayName: existing.displayName,
          avatarUrl: existing.avatarUrl,
          addedAt: row.addedAt,
        },
      };
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw conflict("Already a member of this project");
      }
      throw e;
    }
  }

  try {
    const [invite] = await db
      .insert(projectDeveloperInvites)
      .values({
        projectId,
        githubUserId: user.githubUserId,
        githubUsername: user.githubUsername,
        invitedBy: caller.stakeholderId,
        status: "pending",
      })
      .returning();

    return {
      kind: "invite",
      invite: {
        id: invite.id,
        githubUserId: invite.githubUserId,
        githubUsername: invite.githubUsername,
        invitedAt: invite.invitedAt,
      },
    };
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw conflict("There is already a pending invite for this person");
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/tests/projects/members.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/projects/members.ts apps/web/tests/projects/members.test.ts
git commit -m "feat(projects): member listing and the two-branch developer invite"
```

---

### Task 5: Requirements service — create, list, get

**Files:**
- Create: `apps/web/lib/requirements/service.ts`
- Test: `apps/web/tests/requirements/service.test.ts`

**Interfaces:**
- Produces:
  - `createRequirement(db, session, projectId, input: { title: string; description: string }): Promise<RequirementView>`
  - `listRequirements(db, session, projectId, opts?: { includeArchived?: boolean }): Promise<RequirementView[]>`
  - `getRequirement(db, session, requirementId): Promise<{ requirement: RequirementView; versionHistory: VersionView[] }>`
  - `type RequirementView = { id: string; projectId: string; title: string; description: string; status: RequirementStatus; versionNumber: number; currentVersionId: string; archivedAt: Date | null; createdAt: Date }`
  - `type VersionView = { id: string; versionNumber: number; title: string; description: string; status: RequirementStatus; createdAt: Date }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/requirements/service.test.ts`:

```ts
// apps/web/tests/requirements/service.test.ts
import { describe, expect, it } from "vitest";
import { withTestSchema } from "@zkcvp/db/testing";
import { eq } from "drizzle-orm";
import { requirements, stakeholders } from "@zkcvp/db/schema";
import type { Db } from "@zkcvp/db";
import { createProject } from "../../lib/projects/service";
import {
  createRequirement,
  getRequirement,
  listRequirements,
} from "../../lib/requirements/service";
import { archiveRequirement } from "../../lib/requirements/mutate";

const HOUR = 60_000;

async function aProject(db: Db, email: string) {
  const [s] = await db
    .insert(stakeholders)
    .values({ email, displayName: email })
    .returning();
  const session = { kind: "stakeholder" as const, stakeholderId: s.id };
  const project = await createProject(db, session, { name: "P" });
  return { session, project };
}

describe("createRequirement", () => {
  it("creates version 1 at status new and points current_version_id at it", async () => {
    await withTestSchema(async (db) => {
      const { session, project } = await aProject(db, "a@example.com");

      const req = await createRequirement(db, session, project.id, {
        title: "Rate limiting",
        description: "All write endpoints are rate limited.",
      });

      expect(req.versionNumber).toBe(1);
      expect(req.status).toBe("new");
      expect(req.title).toBe("Rate limiting");

      const [row] = await db
        .select()
        .from(requirements)
        .where(eq(requirements.id, req.id));
      expect(row.currentVersionId).toBe(req.currentVersionId);
      expect(row.archivedAt).toBeNull();
    });
  }, HOUR);
});

describe("listRequirements", () => {
  it("excludes archived rows by default and includes them on request", async () => {
    await withTestSchema(async (db) => {
      const { session, project } = await aProject(db, "b@example.com");
      const kept = await createRequirement(db, session, project.id, {
        title: "Kept",
        description: "d",
      });
      const gone = await createRequirement(db, session, project.id, {
        title: "Gone",
        description: "d",
      });
      await archiveRequirement(db, session, gone.id);

      expect((await listRequirements(db, session, project.id)).map((r) => r.title)).toEqual([
        "Kept",
      ]);

      const all = await listRequirements(db, session, project.id, {
        includeArchived: true,
      });
      expect(all.map((r) => r.title).sort()).toEqual(["Gone", "Kept"]);
      expect(all.find((r) => r.id === gone.id)?.archivedAt).not.toBeNull();
      expect(all.find((r) => r.id === kept.id)?.archivedAt).toBeNull();
    });
  }, HOUR);
});

describe("getRequirement", () => {
  it("returns the full version history ordered by version number", async () => {
    await withTestSchema(async (db) => {
      const { session, project } = await aProject(db, "c@example.com");
      const req = await createRequirement(db, session, project.id, {
        title: "One",
        description: "d",
      });

      const { requirement, versionHistory } = await getRequirement(db, session, req.id);
      expect(requirement.title).toBe("One");
      expect(versionHistory.map((v) => v.versionNumber)).toEqual([1]);
    });
  }, HOUR);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/tests/requirements/service.test.ts`
Expected: FAIL — cannot resolve `../../lib/requirements/service`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/requirements/service.ts`:

```ts
// apps/web/lib/requirements/service.ts
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  requirementVersions,
  requirements,
  type Db,
} from "@zkcvp/db";
import type { RequirementStatus } from "@zkcvp/contracts";
import { isProjectMember } from "../auth/authorization";
import type { Session } from "../auth/types";
import { forbidden, notFound } from "../api/errors";
import { assertStakeholderMember } from "../projects/service";

export type RequirementView = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  /** ALWAYS from the current version via a join. Never stored on requirements. */
  status: RequirementStatus;
  versionNumber: number;
  currentVersionId: string;
  archivedAt: Date | null;
  createdAt: Date;
};

export type VersionView = {
  id: string;
  versionNumber: number;
  title: string;
  description: string;
  status: RequirementStatus;
  createdAt: Date;
};

/** The single projection of "requirement joined to its current version". */
const requirementView = {
  id: requirements.id,
  projectId: requirements.projectId,
  title: requirementVersions.title,
  description: requirementVersions.description,
  status: requirementVersions.status,
  versionNumber: requirementVersions.versionNumber,
  currentVersionId: requirementVersions.id,
  archivedAt: requirements.archivedAt,
  createdAt: requirements.createdAt,
};

/**
 * One transaction, in three steps, because `current_version_id` and
 * `requirement_id` are a circular FK pair: insert the requirement with a null
 * pointer, insert version 1, then point the requirement at it. The column is
 * nullable ONLY for the width of this transaction.
 */
export async function createRequirement(
  db: Db,
  session: Session,
  projectId: string,
  input: { title: string; description: string },
): Promise<RequirementView> {
  const caller = await assertStakeholderMember(db, session, projectId);

  return db.transaction(async (tx) => {
    const [requirement] = await tx
      .insert(requirements)
      .values({ projectId, createdBy: caller.stakeholderId })
      .returning();

    const [version] = await tx
      .insert(requirementVersions)
      .values({
        requirementId: requirement.id,
        versionNumber: 1,
        title: input.title,
        description: input.description,
        /* Written explicitly rather than left to the column default, so plan 01
         * invariant 4 is visible at the line that could break it. */
        status: "new",
        createdBy: caller.stakeholderId,
      })
      .returning();

    await tx
      .update(requirements)
      .set({ currentVersionId: version.id })
      .where(eq(requirements.id, requirement.id));

    return {
      id: requirement.id,
      projectId: requirement.projectId,
      title: version.title,
      description: version.description,
      status: version.status,
      versionNumber: version.versionNumber,
      currentVersionId: version.id,
      archivedAt: requirement.archivedAt,
      createdAt: requirement.createdAt,
    };
  });
}

export async function listRequirements(
  db: Db,
  session: Session,
  projectId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<RequirementView[]> {
  if (!(await isProjectMember(db, session, projectId))) throw forbidden();

  return db
    .select(requirementView)
    .from(requirements)
    .innerJoin(
      requirementVersions,
      eq(requirements.currentVersionId, requirementVersions.id),
    )
    .where(
      opts.includeArchived
        ? eq(requirements.projectId, projectId)
        : and(
            eq(requirements.projectId, projectId),
            isNull(requirements.archivedAt),
          ),
    )
    .orderBy(asc(requirements.createdAt));
}

/** Loads a requirement without an authorization check. Internal use only. */
export async function loadRequirement(
  db: Db,
  requirementId: string,
): Promise<RequirementView> {
  const [row] = await db
    .select(requirementView)
    .from(requirements)
    .innerJoin(
      requirementVersions,
      eq(requirements.currentVersionId, requirementVersions.id),
    )
    .where(eq(requirements.id, requirementId));

  if (!row) throw notFound("No such requirement");
  return row;
}

export async function getRequirement(
  db: Db,
  session: Session,
  requirementId: string,
): Promise<{ requirement: RequirementView; versionHistory: VersionView[] }> {
  const requirement = await loadRequirement(db, requirementId);

  if (!(await isProjectMember(db, session, requirement.projectId))) {
    throw forbidden();
  }

  const versionHistory = await db
    .select({
      id: requirementVersions.id,
      versionNumber: requirementVersions.versionNumber,
      title: requirementVersions.title,
      description: requirementVersions.description,
      status: requirementVersions.status,
      createdAt: requirementVersions.createdAt,
    })
    .from(requirementVersions)
    .where(eq(requirementVersions.requirementId, requirementId))
    .orderBy(asc(requirementVersions.versionNumber));

  return { requirement, versionHistory };
}
```

- [ ] **Step 4: Run test to verify it passes**

This task's test imports `archiveRequirement` from Task 6. Implement Task 6 before running, or run only the create and get blocks:

Run: `npx vitest run apps/web/tests/requirements/service.test.ts -t "createRequirement"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/requirements/service.ts apps/web/tests/requirements/service.test.ts
git commit -m "feat(requirements): create, list and get with status joined at read time"
```

---

### Task 6: Requirements service — edit and archive

**Files:**
- Create: `apps/web/lib/requirements/mutate.ts`
- Test: `apps/web/tests/requirements/mutate.test.ts`

**Interfaces:**
- Consumes: `loadRequirement`, `RequirementView` from `lib/requirements/service`; `assertStakeholderMember` from `lib/projects/service`.
- Produces:
  - `editRequirement(db, session, requirementId, input: { title?: string; description?: string }): Promise<RequirementView>`
  - `archiveRequirement(db, session, requirementId): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/requirements/mutate.test.ts`:

```ts
// apps/web/tests/requirements/mutate.test.ts
import { describe, expect, it } from "vitest";
import { withTestSchema } from "@zkcvp/db/testing";
import { eq } from "drizzle-orm";
import { requirementVersions, requirements, stakeholders } from "@zkcvp/db/schema";
import type { Db } from "@zkcvp/db";
import type { RequirementStatus } from "@zkcvp/contracts";
import { createProject } from "../../lib/projects/service";
import { createRequirement, getRequirement } from "../../lib/requirements/service";
import { archiveRequirement, editRequirement } from "../../lib/requirements/mutate";
import { ServiceError } from "../../lib/api/errors";

const HOUR = 60_000;

async function aRequirement(db: Db, email: string) {
  const [s] = await db
    .insert(stakeholders)
    .values({ email, displayName: email })
    .returning();
  const session = { kind: "stakeholder" as const, stakeholderId: s.id };
  const project = await createProject(db, session, { name: "P" });
  const req = await createRequirement(db, session, project.id, {
    title: "Original title",
    description: "Original description",
  });
  return { session, project, req };
}

/** Drives a version to a terminal status the way the future Evaluator will. */
async function setStatus(db: Db, versionId: string, status: RequirementStatus) {
  await db
    .update(requirementVersions)
    .set({ status })
    .where(eq(requirementVersions.id, versionId));
}

describe("editRequirement", () => {
  /* Plan 01 invariant 4. This is what makes "editing a verified requirement
   * reopens it" fall out with no special-case logic. */
  it("always creates the new version at status new, even from verified", async () => {
    await withTestSchema(async (db) => {
      const { session, req } = await aRequirement(db, "a@example.com");
      await setStatus(db, req.currentVersionId, "verified");

      const edited = await editRequirement(db, session, req.id, {
        title: "Reworded title",
      });

      expect(edited.versionNumber).toBe(2);
      expect(edited.status).toBe("new");
      /* An unspecified field carries over from the previous version. */
      expect(edited.description).toBe("Original description");
    });
  }, HOUR);

  it("does the same from eval_failed", async () => {
    await withTestSchema(async (db) => {
      const { session, req } = await aRequirement(db, "b@example.com");
      await setStatus(db, req.currentVersionId, "eval_failed");
      expect((await editRequirement(db, session, req.id, { title: "x" })).status).toBe("new");
    });
  }, HOUR);

  it("leaves the previous version untouched — versions are immutable", async () => {
    await withTestSchema(async (db) => {
      const { session, req } = await aRequirement(db, "c@example.com");
      await editRequirement(db, session, req.id, { title: "Second" });

      const { versionHistory } = await getRequirement(db, session, req.id);
      expect(versionHistory.map((v) => [v.versionNumber, v.title])).toEqual([
        [1, "Original title"],
        [2, "Second"],
      ]);
    });
  }, HOUR);

  it("returns 404 for an archived requirement", async () => {
    await withTestSchema(async (db) => {
      const { session, req } = await aRequirement(db, "d@example.com");
      await archiveRequirement(db, session, req.id);

      const err = await editRequirement(db, session, req.id, { title: "x" }).catch((e) => e);
      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).status).toBe(404);
    });
  }, HOUR);
});

describe("archiveRequirement", () => {
  it("archives from any status and never touches the versions", async () => {
    await withTestSchema(async (db) => {
      for (const status of ["new", "verified", "eval_failed"] as const) {
        const { session, req } = await aRequirement(db, `${status}@example.com`);
        await setStatus(db, req.currentVersionId, status);

        await archiveRequirement(db, session, req.id);

        const [row] = await db
          .select()
          .from(requirements)
          .where(eq(requirements.id, req.id));
        expect(row.archivedAt).not.toBeNull();

        /* Orthogonal axes — plan 01 invariant 5. Archiving says nothing about
         * whether the requirement was ever verified. */
        const [version] = await db
          .select()
          .from(requirementVersions)
          .where(eq(requirementVersions.id, req.currentVersionId));
        expect(version.status).toBe(status);
      }
    });
  }, HOUR);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/tests/requirements/mutate.test.ts`
Expected: FAIL — cannot resolve `../../lib/requirements/mutate`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/requirements/mutate.ts`:

```ts
// apps/web/lib/requirements/mutate.ts
import { desc, eq } from "drizzle-orm";
import { requirementVersions, requirements, type Db } from "@zkcvp/db";
import type { Session } from "../auth/types";
import { notFound } from "../api/errors";
import { assertStakeholderMember } from "../projects/service";
import { loadRequirement, type RequirementView } from "./service";

/**
 * Editing NEVER mutates a version — it writes a new one.
 *
 * The `SELECT ... FOR UPDATE` on the parent row is load-bearing: without it two
 * concurrent edits both read the same `max(version_number)` and one dies on the
 * `(requirement_id, version_number)` unique constraint. The lock serialises
 * them so they become versions n+1 and n+2.
 */
export async function editRequirement(
  db: Db,
  session: Session,
  requirementId: string,
  input: { title?: string; description?: string },
): Promise<RequirementView> {
  const current = await loadRequirement(db, requirementId);
  const caller = await assertStakeholderMember(db, session, current.projectId);

  /* Plan 01: 404 if archived. There is no status-based precondition — a
   * requirement is editable in any status. */
  if (current.archivedAt !== null) {
    throw notFound("This requirement is archived");
  }

  return db.transaction(async (tx) => {
    await tx
      .select({ id: requirements.id })
      .from(requirements)
      .where(eq(requirements.id, requirementId))
      .for("update");

    const [latest] = await tx
      .select({
        versionNumber: requirementVersions.versionNumber,
        title: requirementVersions.title,
        description: requirementVersions.description,
      })
      .from(requirementVersions)
      .where(eq(requirementVersions.requirementId, requirementId))
      .orderBy(desc(requirementVersions.versionNumber))
      .limit(1);

    const [version] = await tx
      .insert(requirementVersions)
      .values({
        requirementId,
        versionNumber: latest.versionNumber + 1,
        title: input.title ?? latest.title,
        description: input.description ?? latest.description,
        /* Unconditional. Never derived from the previous version's status. */
        status: "new",
        createdBy: caller.stakeholderId,
      })
      .returning();

    await tx
      .update(requirements)
      .set({ currentVersionId: version.id })
      .where(eq(requirements.id, requirementId));

    return {
      ...current,
      title: version.title,
      description: version.description,
      status: version.status,
      versionNumber: version.versionNumber,
      currentVersionId: version.id,
    };
  });
}

/**
 * Soft delete. No preconditions — archivable in any status — and it does not
 * touch `requirement_versions`. Archiving and status are orthogonal axes.
 * There is no un-archive in this phase.
 */
export async function archiveRequirement(
  db: Db,
  session: Session,
  requirementId: string,
): Promise<void> {
  const current = await loadRequirement(db, requirementId);
  await assertStakeholderMember(db, session, current.projectId);

  await db
    .update(requirements)
    .set({ archivedAt: new Date() })
    .where(eq(requirements.id, requirementId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/tests/requirements/`
Expected: PASS — both files, 8 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/requirements/mutate.ts apps/web/tests/requirements/mutate.test.ts
git commit -m "feat(requirements): edit under a row lock and archive orthogonally to status"
```

---

### Task 7: The authorization matrix, table-driven

**Files:**
- Test: `apps/web/tests/authorization-matrix.test.ts`

**Interfaces:**
- Consumes: every service function from Tasks 3–6. Adds no production code — this task exists to prove plan 01's matrix holds across the whole surface.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/authorization-matrix.test.ts`:

```ts
// apps/web/tests/authorization-matrix.test.ts
import { describe, expect, it } from "vitest";
import { withTestSchema } from "@zkcvp/db/testing";
import {
  developers,
  projectDevelopers,
  stakeholders,
} from "@zkcvp/db/schema";
import type { Db } from "@zkcvp/db";
import type { Session } from "../lib/auth/types";
import { createProject, getProject } from "../lib/projects/service";
import { inviteDeveloper, listMembers } from "../lib/projects/members";
import { createRequirement, listRequirements } from "../lib/requirements/service";
import { archiveRequirement, editRequirement } from "../lib/requirements/mutate";
import { ServiceError } from "../lib/api/errors";

const HOUR = 60_000;

const octocat = {
  githubUserId: "583231",
  githubUsername: "octocat",
  displayName: "The Octocat",
  avatarUrl: null,
};

type Caller = "stakeholderMember" | "developerMember" | "nonMember";

/**
 * Plan 01's matrix, verbatim. `true` means allowed.
 *
 * "Non-member" here is an authenticated stakeholder with no membership row on
 * the project — not an unauthenticated visitor, which never reaches a service.
 */
const MATRIX: Record<string, Record<Caller, boolean>> = {
  viewProject:      { stakeholderMember: true,  developerMember: true,  nonMember: false },
  listRequirements: { stakeholderMember: true,  developerMember: true,  nonMember: false },
  listMembers:      { stakeholderMember: true,  developerMember: true,  nonMember: false },
  createRequirement:{ stakeholderMember: true,  developerMember: false, nonMember: false },
  editRequirement:  { stakeholderMember: true,  developerMember: false, nonMember: false },
  archiveRequirement:{stakeholderMember: true,  developerMember: false, nonMember: false },
  inviteDeveloper:  { stakeholderMember: true,  developerMember: false, nonMember: false },
};

async function world(db: Db) {
  const [owner] = await db
    .insert(stakeholders)
    .values({ email: "owner@example.com", displayName: "Owner" })
    .returning();
  const [outsider] = await db
    .insert(stakeholders)
    .values({ email: "outsider@example.com", displayName: "Outsider" })
    .returning();
  const [dev] = await db
    .insert(developers)
    .values({
      githubUserId: "999",
      githubUsername: "dev",
      displayName: "Dev",
    })
    .returning();

  const ownerSession: Session = { kind: "stakeholder", stakeholderId: owner.id };
  const project = await createProject(db, ownerSession, { name: "P" });
  await db
    .insert(projectDevelopers)
    .values({ projectId: project.id, developerId: dev.id, addedBy: owner.id });

  const requirement = await createRequirement(db, ownerSession, project.id, {
    title: "T",
    description: "D",
  });

  const sessions: Record<Caller, Session> = {
    stakeholderMember: ownerSession,
    developerMember: {
      kind: "developer",
      developerId: dev.id,
      githubAccessToken: "tok",
    },
    nonMember: { kind: "stakeholder", stakeholderId: outsider.id },
  };

  return { project, requirement, sessions };
}

describe("plan 01 authorization matrix", () => {
  for (const [action, expectations] of Object.entries(MATRIX)) {
    for (const [caller, allowed] of Object.entries(expectations) as [
      Caller,
      boolean,
    ][]) {
      it(`${action} — ${caller} is ${allowed ? "allowed" : "refused"}`, async () => {
        await withTestSchema(async (db) => {
          const { project, requirement, sessions } = await world(db);
          const session = sessions[caller];

          const actions: Record<string, () => Promise<unknown>> = {
            viewProject: () => getProject(db, session, project.id),
            listRequirements: () => listRequirements(db, session, project.id),
            listMembers: () => listMembers(db, session, project.id),
            createRequirement: () =>
              createRequirement(db, session, project.id, {
                title: "New",
                description: "D",
              }),
            editRequirement: () =>
              editRequirement(db, session, requirement.id, { title: "Edited" }),
            archiveRequirement: () =>
              archiveRequirement(db, session, requirement.id),
            inviteDeveloper: () =>
              inviteDeveloper(
                db,
                session,
                project.id,
                { githubUsername: "octocat" },
                { resolve: async () => octocat },
              ),
          };

          const outcome = await actions[action]().then(
            () => "allowed" as const,
            (e) => e,
          );

          if (allowed) {
            expect(outcome).toBe("allowed");
          } else {
            expect(outcome).toBeInstanceOf(ServiceError);
            expect((outcome as ServiceError).status).toBe(403);
          }
        });
      }, HOUR);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails or passes honestly**

Run: `npx vitest run apps/web/tests/authorization-matrix.test.ts`
Expected: 21 tests. If any fail, the service is wrong — fix the service, never the matrix.

- [ ] **Step 3: Fix any service that disagrees with the matrix**

No new file. If a case fails, the cause is almost always a service calling `isProjectMember` where it should call `assertStakeholderMember`.

- [ ] **Step 4: Run the full suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/authorization-matrix.test.ts
git commit -m "test: plan 01's authorization matrix, every cell"
```

---

### Task 8: The ten route handlers

**Files:**
- Create: `apps/web/lib/api/parse.ts`
- Create: `apps/web/app/api/projects/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/developers/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/developers/invites/route.ts`
- Create: `apps/web/app/api/projects/[projectId]/requirements/route.ts`
- Create: `apps/web/app/api/requirements/[id]/route.ts`

**Interfaces:**
- Consumes: `handle` from `lib/api/respond`; `requireSession`, `requireStakeholder` from `lib/auth/session`; `getDb` from `lib/db`; all services.
- Produces: the ten endpoints. Note Next 15 passes `params` as a **Promise** — it must be awaited.

- [ ] **Step 1: Write the body parser**

Create `apps/web/lib/api/parse.ts`:

```ts
// apps/web/lib/api/parse.ts
import type { z } from "zod";
import { invalidBody } from "./errors";

/** Parses and validates a JSON body, turning Zod issues into a 400. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw invalidBody([{ path: "", message: "Body must be valid JSON" }]);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw invalidBody(
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  }
  return parsed.data;
}
```

- [ ] **Step 2: Write the project routes**

Create `apps/web/app/api/projects/route.ts`:

```ts
// apps/web/app/api/projects/route.ts
import { z } from "zod";
import { handle } from "../../../lib/api/respond";
import { parseBody } from "../../../lib/api/parse";
import { getDb } from "../../../lib/db";
import { requireSession, requireStakeholder } from "../../../lib/auth/session";
import { createProject, listProjects } from "../../../lib/projects/service";

const createSchema = z.object({ name: z.string().trim().min(1, "Required") });

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireStakeholder();
    const body = await parseBody(req, createSchema);
    const project = await createProject(getDb(), session, body);
    return Response.json({ project }, { status: 201 });
  });
}

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const projects = await listProjects(getDb(), session);
    return Response.json({ projects });
  });
}
```

Create `apps/web/app/api/projects/[projectId]/route.ts`:

```ts
// apps/web/app/api/projects/[projectId]/route.ts
import { handle } from "../../../../lib/api/respond";
import { getDb } from "../../../../lib/db";
import { requireSession } from "../../../../lib/auth/session";
import { getProject } from "../../../../lib/projects/service";

/* Next 15 hands `params` over as a Promise. Destructuring it without awaiting
 * yields undefined at runtime and no type error until the await is added. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const { projectId } = await params;
    const session = await requireSession();
    const project = await getProject(getDb(), session, projectId);
    return Response.json({ project });
  });
}
```

Create `apps/web/app/api/projects/[projectId]/developers/route.ts`:

```ts
// apps/web/app/api/projects/[projectId]/developers/route.ts
import { handle } from "../../../../../lib/api/respond";
import { getDb } from "../../../../../lib/db";
import { requireSession } from "../../../../../lib/auth/session";
import { listMembers } from "../../../../../lib/projects/members";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const { projectId } = await params;
    const session = await requireSession();
    return Response.json(await listMembers(getDb(), session, projectId));
  });
}
```

Create `apps/web/app/api/projects/[projectId]/developers/invites/route.ts`:

```ts
// apps/web/app/api/projects/[projectId]/developers/invites/route.ts
import { z } from "zod";
import { handle } from "../../../../../../lib/api/respond";
import { parseBody } from "../../../../../../lib/api/parse";
import { getDb } from "../../../../../../lib/db";
import { requireSession } from "../../../../../../lib/auth/session";
import { inviteDeveloper } from "../../../../../../lib/projects/members";

const inviteSchema = z.object({
  githubUsername: z.string().trim().min(1, "Required"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const { projectId } = await params;
    const session = await requireSession();
    const body = await parseBody(req, inviteSchema);
    const result = await inviteDeveloper(getDb(), session, projectId, body);

    /* Plan 01: 201 either way, but the body names which branch fired. */
    return Response.json(
      result.kind === "membership"
        ? { membership: result.membership }
        : { invite: result.invite },
      { status: 201 },
    );
  });
}
```

- [ ] **Step 3: Write the requirement routes**

Create `apps/web/app/api/projects/[projectId]/requirements/route.ts`:

```ts
// apps/web/app/api/projects/[projectId]/requirements/route.ts
import { z } from "zod";
import { handle } from "../../../../../lib/api/respond";
import { parseBody } from "../../../../../lib/api/parse";
import { getDb } from "../../../../../lib/db";
import { requireSession } from "../../../../../lib/auth/session";
import {
  createRequirement,
  listRequirements,
} from "../../../../../lib/requirements/service";

const createSchema = z.object({
  title: z.string().trim().min(1, "Required"),
  description: z.string().trim().min(1, "Required"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const { projectId } = await params;
    const session = await requireSession();
    const body = await parseBody(req, createSchema);
    const requirement = await createRequirement(
      getDb(),
      session,
      projectId,
      body,
    );
    return Response.json({ requirement }, { status: 201 });
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const { projectId } = await params;
    const session = await requireSession();
    const includeArchived =
      new URL(req.url).searchParams.get("includeArchived") === "true";
    const requirements = await listRequirements(getDb(), session, projectId, {
      includeArchived,
    });
    return Response.json({ requirements });
  });
}
```

Create `apps/web/app/api/requirements/[id]/route.ts`:

```ts
// apps/web/app/api/requirements/[id]/route.ts
import { z } from "zod";
import { handle } from "../../../../lib/api/respond";
import { parseBody } from "../../../../lib/api/parse";
import { getDb } from "../../../../lib/db";
import { requireSession } from "../../../../lib/auth/session";
import { getRequirement } from "../../../../lib/requirements/service";
import {
  archiveRequirement,
  editRequirement,
} from "../../../../lib/requirements/mutate";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.title !== undefined || v.description !== undefined, {
    message: "Provide at least one of title or description",
  });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const session = await requireSession();
    const { requirement, versionHistory } = await getRequirement(
      getDb(),
      session,
      id,
    );
    return Response.json({
      requirement,
      currentVersion: {
        id: requirement.currentVersionId,
        versionNumber: requirement.versionNumber,
        title: requirement.title,
        description: requirement.description,
        status: requirement.status,
      },
      versionHistory,
    });
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const session = await requireSession();
    const body = await parseBody(req, patchSchema);
    const requirement = await editRequirement(getDb(), session, id, body);
    return Response.json({ requirement });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const session = await requireSession();
    await archiveRequirement(getDb(), session, id);
    return new Response(null, { status: 204 });
  });
}
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS. `apps/web/tests/host-agnostic.test.ts` also confirms no route declared an edge runtime.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/projects apps/web/app/api/requirements apps/web/lib/api/parse.ts
git commit -m "feat(api): the ten plan-01 endpoints as thin adapters over the services"
```

---

### Task 9: Middleware

**Files:**
- Create: `apps/web/middleware.ts`
- Test: `apps/web/tests/middleware.test.ts`

**Interfaces:**
- Produces: `middleware(req)` and `config.matcher`. Carries **no authorization** — a cookie-presence check only.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/middleware.test.ts`:

```ts
// apps/web/tests/middleware.test.ts
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function request(path: string, cookie?: string) {
  const req = new NextRequest(`https://zkcvp.test${path}`);
  if (cookie) req.cookies.set(cookie, "value");
  return req;
}

describe("middleware", () => {
  it("redirects an unauthenticated visitor to /login", () => {
    const res = middleware(request("/projects"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://zkcvp.test/login");
  });

  it("passes a visitor holding either instance's session cookie through", () => {
    expect(
      middleware(request("/projects", "authjs.dev.session-token")).status,
    ).toBe(200);
    expect(
      middleware(request("/projects", "authjs.sh.session-token")).status,
    ).toBe(200);
  });

  it("carries the original path so login can return the visitor to it", () => {
    const res = middleware(request("/projects/abc/members"));
    expect(res.headers.get("location")).toContain(
      "from=%2Fprojects%2Fabc%2Fmembers",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/tests/middleware.test.ts`
Expected: FAIL — cannot resolve `../middleware`.

- [ ] **Step 3: Confirm the real cookie names, then implement**

Read `apps/web/lib/auth/cookies.ts` and use `scopedCookieNames("dev").sessionToken.name` / `scopedCookieNames("sh").sessionToken.name` rather than hardcoding. If the literal names differ from the test's guesses, **fix the test to match the source**, not the reverse.

Create `apps/web/middleware.ts`:

```ts
// apps/web/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { scopedCookieNames } from "./lib/auth/cookies";

/**
 * Unauthenticated redirects ONLY. No authorization of any kind.
 *
 * Middleware runs on Edge on Vercel and in Node self-hosted; keeping every rule
 * out of it removes the largest behavioural difference between the two
 * deployment targets this project keeps open. A cookie's PRESENCE is not proof
 * it is valid — the real check happens in the services, which is why this file
 * can be this dumb without being unsafe.
 */
const SESSION_COOKIES = [
  scopedCookieNames("dev").sessionToken.name,
  scopedCookieNames("sh").sessionToken.name,
];

export function middleware(req: NextRequest): NextResponse {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const login = new URL("/login", req.url);
  login.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/projects/:path*", "/requirements/:path*"],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/tests/middleware.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/middleware.ts apps/web/tests/middleware.test.ts
git commit -m "feat(web): unauthenticated redirect middleware, no authorization"
```

---

### Task 10: Project list and creation screens

**Files:**
- Create: `apps/web/app/projects/page.tsx`
- Create: `apps/web/app/projects/new/page.tsx`
- Create: `apps/web/app/projects/new/actions.ts`
- Create: `apps/web/app/projects/new/NewProjectForm.tsx`

**Interfaces:**
- Consumes: `listProjects`, `createProject`; `requireSession`, `requireStakeholder`; `getDb`.
- Produces: `type FormState = { status: "idle" } | { status: "error"; message: string }` — reused verbatim by Tasks 11–13.

- [ ] **Step 1: Write the list page**

Create `apps/web/app/projects/page.tsx`:

```tsx
// apps/web/app/projects/page.tsx
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
} from "@zkcvp/design-system-ledger/components";
import { getDb } from "../../lib/db";
import { requireSession } from "../../lib/auth/session";
import { listProjects } from "../../lib/projects/service";

/** Absolute dates throughout this product, never relative. */
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function ProjectsPage() {
  const session = await requireSession();
  const projects = await listProjects(getDb(), session);

  return (
    <main className="lg-container app-page">
      <PageHeader
        title="Projects"
        actions={
          session.kind === "stakeholder" ? (
            <Link href="/projects/new">
              <Button>New project</Button>
            </Link>
          ) : undefined
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description={
            session.kind === "stakeholder"
              ? "Create a project to start a requirement checklist."
              : "You will see a project here once a stakeholder adds you to one."
          }
        />
      ) : (
        <Card>
          <CardHeader>{projects.length} project{projects.length === 1 ? "" : "s"}</CardHeader>
          <CardBody>
            <Table headers={["Name", "Created"]}>
              {projects.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/projects/${p.id}`}>{p.name}</Link>
                  </Td>
                  <Td>{dateFormat.format(p.createdAt)}</Td>
                </tr>
              ))}
            </Table>
          </CardBody>
        </Card>
      )}
    </main>
  );
}
```

If `Table`'s prop is not `headers`, read `packages/design-system-ledger/components/Table.tsx` and use its real signature.

- [ ] **Step 2: Write the action and the form**

Create `apps/web/app/projects/new/actions.ts`:

```ts
// apps/web/app/projects/new/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/db";
import { requireStakeholder } from "../../../lib/auth/session";
import { createProject } from "../../../lib/projects/service";

export type FormState = { status: "idle" } | { status: "error"; message: string };

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { status: "error", message: "Enter a project name." };

  const session = await requireStakeholder();
  const project = await createProject(getDb(), session, { name });

  revalidatePath("/projects");
  /* redirect() throws a control-flow signal — it must be outside any try. */
  redirect(`/projects/${project.id}`);
}
```

Create `apps/web/app/projects/new/NewProjectForm.tsx`:

```tsx
// apps/web/app/projects/new/NewProjectForm.tsx
"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@zkcvp/design-system-ledger/components";
import { createProjectAction, type FormState } from "./actions";

const initial: FormState = { status: "idle" };

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, initial);

  return (
    <form action={action} className="app-form">
      <Field
        label="Project name"
        required
        error={state.status === "error" ? state.message : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="name"
            aria-describedby={describedBy}
            invalid={invalid}
            autoFocus
          />
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
```

Create `apps/web/app/projects/new/page.tsx`:

```tsx
// apps/web/app/projects/new/page.tsx
import { PageHeader } from "@zkcvp/design-system-ledger/components";
import { requireStakeholder } from "../../../lib/auth/session";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  /* Only a stakeholder may create a project. The service enforces it too; this
   * is what keeps a developer from seeing a form they cannot submit. */
  await requireStakeholder();

  return (
    <main className="lg-container app-page">
      <PageHeader title="New project" />
      <NewProjectForm />
    </main>
  );
}
```

- [ ] **Step 3: Check it renders**

Run: `npm run build -w @zkcvp/web`
Expected: build succeeds, both routes compile.

- [ ] **Step 4: Typecheck**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/projects
git commit -m "feat(web): project list and creation screens"
```

---

### Task 11: Project detail and requirement creation screens

**Files:**
- Create: `apps/web/app/projects/[id]/page.tsx`
- Create: `apps/web/app/projects/[id]/requirements/new/page.tsx`
- Create: `apps/web/app/projects/[id]/requirements/new/actions.ts`
- Create: `apps/web/app/projects/[id]/requirements/new/NewRequirementForm.tsx`

**Interfaces:**
- Consumes: `getProject`, `listRequirements`, `createRequirement`; `RequirementView`.

- [ ] **Step 1: Write the detail page**

Create `apps/web/app/projects/[id]/page.tsx`:

```tsx
// apps/web/app/projects/[id]/page.tsx
import Link from "next/link";
import {
  Button,
  ChecklistProgress,
  EmptyState,
  PageHeader,
  RequirementList,
  RequirementRow,
  Section,
  type RequirementDisplayStatus,
} from "@zkcvp/design-system-ledger/components";
import { getDb } from "../../../lib/db";
import { requireSession } from "../../../lib/auth/session";
import { getProject } from "../../../lib/projects/service";
import { listRequirements } from "../../../lib/requirements/service";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getDb();

  const project = await getProject(db, session, id);
  const requirements = await listRequirements(db, session, id);
  const isStakeholder = session.kind === "stakeholder";

  /* archived is folded in for DISPLAY only — it is never persisted as a status
   * and the two facts stay separate in the data. */
  const displayStatuses: RequirementDisplayStatus[] = requirements.map((r) =>
    r.archivedAt ? "archived" : r.status,
  );

  return (
    <main className="lg-container app-page">
      <PageHeader
        title={project.name}
        actions={
          isStakeholder ? (
            <>
              <Link href={`/projects/${id}/members`}>
                <Button tone="secondary">Members</Button>
              </Link>
              <Link href={`/projects/${id}/requirements/new`}>
                <Button>New requirement</Button>
              </Link>
            </>
          ) : (
            <Link href={`/projects/${id}/members`}>
              <Button tone="secondary">Members</Button>
            </Link>
          )
        }
      />

      <Section>
        <ChecklistProgress statuses={displayStatuses} />
      </Section>

      {requirements.length === 0 ? (
        <EmptyState
          title="No requirements yet"
          description={
            isStakeholder
              ? "Add the first requirement to this checklist."
              : "The stakeholder has not added any requirements yet."
          }
        />
      ) : (
        <RequirementList>
          {requirements.map((r) => (
            <Link key={r.id} href={`/requirements/${r.id}`}>
              <RequirementRow
                title={r.title}
                description={r.description}
                status={r.status}
                version={r.versionNumber}
                archived={r.archivedAt !== null}
              />
            </Link>
          ))}
        </RequirementList>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Write the action and form**

Create `apps/web/app/projects/[id]/requirements/new/actions.ts`:

```ts
// apps/web/app/projects/[id]/requirements/new/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../../lib/db";
import { requireStakeholder } from "../../../../../lib/auth/session";
import { createRequirement } from "../../../../../lib/requirements/service";

export type FormState = { status: "idle" } | { status: "error"; message: string };

export async function createRequirementAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) return { status: "error", message: "Enter a title." };
  if (!description) return { status: "error", message: "Enter a description." };

  const session = await requireStakeholder();
  await createRequirement(getDb(), session, projectId, { title, description });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
```

Create `apps/web/app/projects/[id]/requirements/new/NewRequirementForm.tsx`:

```tsx
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

const initial: FormState = { status: "idle" };

export function NewRequirementForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(
    createRequirementAction.bind(null, projectId),
    initial,
  );

  return (
    <form action={action} className="app-form">
      <Field
        label="Title"
        required
        error={state.status === "error" ? state.message : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="title" aria-describedby={describedBy} invalid={invalid} autoFocus />
        )}
      </Field>

      <Field
        label="Description"
        required
        help="What must be true for this requirement to be satisfied."
      >
        {({ id, describedBy }) => (
          <Textarea id={id} name="description" rows={6} aria-describedby={describedBy} />
        )}
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add requirement"}
      </Button>
    </form>
  );
}
```

Create `apps/web/app/projects/[id]/requirements/new/page.tsx`:

```tsx
// apps/web/app/projects/[id]/requirements/new/page.tsx
import { PageHeader } from "@zkcvp/design-system-ledger/components";
import { requireStakeholder } from "../../../../../lib/auth/session";
import { NewRequirementForm } from "./NewRequirementForm";

export default async function NewRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStakeholder();

  return (
    <main className="lg-container app-page">
      <PageHeader title="New requirement" />
      <NewRequirementForm projectId={id} />
    </main>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build -w @zkcvp/web`
Expected: succeeds.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/projects/[id]"
git commit -m "feat(web): project checklist and requirement creation screens"
```

---

### Task 12: Requirement detail and edit screens

**Files:**
- Create: `apps/web/app/requirements/[id]/page.tsx`
- Create: `apps/web/app/requirements/[id]/actions.ts`
- Create: `apps/web/app/requirements/[id]/ArchiveButton.tsx`
- Create: `apps/web/app/requirements/[id]/edit/page.tsx`
- Create: `apps/web/app/requirements/[id]/edit/actions.ts`
- Create: `apps/web/app/requirements/[id]/edit/EditRequirementForm.tsx`

**Interfaces:**
- Consumes: `getRequirement`, `editRequirement`, `archiveRequirement`.

- [ ] **Step 1: Write the detail page**

Create `apps/web/app/requirements/[id]/page.tsx`:

```tsx
// apps/web/app/requirements/[id]/page.tsx
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Section,
  SectionHeading,
  StatusBadge,
  Timeline,
  TimelineItem,
  VersionPill,
} from "@zkcvp/design-system-ledger/components";
import { getDb } from "../../../lib/db";
import { requireSession } from "../../../lib/auth/session";
import { getRequirement } from "../../../lib/requirements/service";
import { ArchiveButton } from "./ArchiveButton";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function RequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const { requirement, versionHistory } = await getRequirement(
    getDb(),
    session,
    id,
  );

  const archived = requirement.archivedAt !== null;
  const isStakeholder = session.kind === "stakeholder";

  return (
    <main className="lg-container app-page">
      <PageHeader
        title={requirement.title}
        actions={
          isStakeholder && !archived ? (
            <>
              <Link href={`/requirements/${id}/edit`}>
                <Button tone="secondary">Edit</Button>
              </Link>
              <ArchiveButton requirementId={id} projectId={requirement.projectId} />
            </>
          ) : undefined
        }
      />

      <Section>
        <VersionPill version={requirement.versionNumber} current />
        {/* The raw enum never reaches the screen — StatusBadge owns the label. */}
        <StatusBadge status={archived ? "archived" : requirement.status} />
      </Section>

      <Card>
        <CardHeader>Description</CardHeader>
        <CardBody>
          <p className="lg-prose">{requirement.description}</p>
        </CardBody>
      </Card>

      <Section>
        <SectionHeading>Version history</SectionHeading>
        <Timeline>
          {versionHistory.map((v) => (
            <TimelineItem
              key={v.id}
              title={`Version ${v.versionNumber} — ${v.title}`}
              meta={dateTimeFormat.format(v.createdAt)}
            >
              <p>{v.description}</p>
              <StatusBadge status={v.status} />
            </TimelineItem>
          ))}
        </Timeline>
      </Section>
    </main>
  );
}
```

If `TimelineItem`'s props are not `title`/`meta`, read `packages/design-system-ledger/components/Timeline.tsx` and use the real names.

- [ ] **Step 2: Write the archive action and button**

Create `apps/web/app/requirements/[id]/actions.ts`:

```ts
// apps/web/app/requirements/[id]/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/db";
import { requireStakeholder } from "../../../lib/auth/session";
import { archiveRequirement } from "../../../lib/requirements/mutate";

export async function archiveRequirementAction(
  requirementId: string,
  projectId: string,
): Promise<void> {
  const session = await requireStakeholder();
  await archiveRequirement(getDb(), session, requirementId);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
```

Create `apps/web/app/requirements/[id]/ArchiveButton.tsx`:

```tsx
// apps/web/app/requirements/[id]/ArchiveButton.tsx
"use client";

import { Button } from "@zkcvp/design-system-ledger/components";
import { archiveRequirementAction } from "./actions";

/**
 * Archiving is a soft delete with no un-archive in this phase, so the copy says
 * what it does rather than "Delete". It is allowed in any status — a verified
 * requirement archives exactly like a new one.
 */
export function ArchiveButton({
  requirementId,
  projectId,
}: {
  requirementId: string;
  projectId: string;
}) {
  return (
    <form action={archiveRequirementAction.bind(null, requirementId, projectId)}>
      <Button type="submit" tone="danger">
        Archive
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the edit screen**

Create `apps/web/app/requirements/[id]/edit/actions.ts`:

```ts
// apps/web/app/requirements/[id]/edit/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../lib/db";
import { requireStakeholder } from "../../../../lib/auth/session";
import { editRequirement } from "../../../../lib/requirements/mutate";

export type FormState = { status: "idle" } | { status: "error"; message: string };

export async function editRequirementAction(
  requirementId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) return { status: "error", message: "Enter a title." };
  if (!description) return { status: "error", message: "Enter a description." };

  const session = await requireStakeholder();
  await editRequirement(getDb(), session, requirementId, { title, description });

  revalidatePath(`/requirements/${requirementId}`);
  redirect(`/requirements/${requirementId}`);
}
```

Create `apps/web/app/requirements/[id]/edit/EditRequirementForm.tsx`:

```tsx
// apps/web/app/requirements/[id]/edit/EditRequirementForm.tsx
"use client";

import { useActionState } from "react";
import {
  Alert,
  Button,
  Field,
  Input,
  Textarea,
} from "@zkcvp/design-system-ledger/components";
import { editRequirementAction, type FormState } from "./actions";

const initial: FormState = { status: "idle" };

export function EditRequirementForm({
  requirementId,
  title,
  description,
}: {
  requirementId: string;
  title: string;
  description: string;
}) {
  const [state, action, pending] = useActionState(
    editRequirementAction.bind(null, requirementId),
    initial,
  );

  return (
    <form action={action} className="app-form">
      {/* Says plainly what saving does, because it is not obvious that an edit
          reopens a verified requirement. */}
      <Alert tone="info">
        Saving creates a new version. Its status starts over at &ldquo;Not
        evaluated&rdquo;, whatever the current version reached.
      </Alert>

      <Field
        label="Title"
        required
        error={state.status === "error" ? state.message : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="title"
            defaultValue={title}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Description" required>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            name="description"
            rows={6}
            defaultValue={description}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save new version"}
      </Button>
    </form>
  );
}
```

Create `apps/web/app/requirements/[id]/edit/page.tsx`:

```tsx
// apps/web/app/requirements/[id]/edit/page.tsx
import { PageHeader } from "@zkcvp/design-system-ledger/components";
import { getDb } from "../../../../lib/db";
import { requireStakeholder } from "../../../../lib/auth/session";
import { getRequirement } from "../../../../lib/requirements/service";
import { EditRequirementForm } from "./EditRequirementForm";

export default async function EditRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireStakeholder();
  const { requirement } = await getRequirement(getDb(), session, id);

  return (
    <main className="lg-container app-page">
      <PageHeader title="Edit requirement" />
      <EditRequirementForm
        requirementId={id}
        title={requirement.title}
        description={requirement.description}
      />
    </main>
  );
}
```

- [ ] **Step 4: Build and verify**

Run: `npm run build -w @zkcvp/web && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/requirements"
git commit -m "feat(web): requirement detail, version history and edit screens"
```

---

### Task 13: Members screen and the invite form

**Files:**
- Create: `apps/web/app/projects/[id]/members/page.tsx`
- Create: `apps/web/app/projects/[id]/members/actions.ts`
- Create: `apps/web/app/projects/[id]/members/InviteForm.tsx`

**Interfaces:**
- Consumes: `listMembers`, `inviteDeveloper`; `ServiceError`.

- [ ] **Step 1: Write the action**

Create `apps/web/app/projects/[id]/members/actions.ts`:

```ts
// apps/web/app/projects/[id]/members/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../../../../lib/db";
import { requireStakeholder } from "../../../../lib/auth/session";
import { inviteDeveloper } from "../../../../lib/projects/members";
import { ServiceError } from "../../../../lib/api/errors";

export type InviteState =
  | { status: "idle" }
  | { status: "invited"; githubUsername: string }
  | { status: "added"; githubUsername: string }
  /* Separated from "error" on purpose: an exhausted GitHub rate limit is an
   * infrastructure failure, not a rejection, and it renders in red rather than
   * as ordinary field validation. */
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export async function inviteDeveloperAction(
  projectId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const githubUsername = String(formData.get("githubUsername") ?? "").trim();
  if (!githubUsername) {
    return { status: "error", message: "Enter a GitHub username." };
  }

  try {
    const session = await requireStakeholder();
    const result = await inviteDeveloper(getDb(), session, projectId, {
      githubUsername,
    });
    revalidatePath(`/projects/${projectId}/members`);

    return result.kind === "membership"
      ? { status: "added", githubUsername: result.membership.githubUsername }
      : { status: "invited", githubUsername: result.invite.githubUsername };
  } catch (e) {
    if (e instanceof ServiceError) {
      return e.code === "github_unavailable"
        ? { status: "unavailable", message: e.message }
        : { status: "error", message: e.message };
    }
    throw e;
  }
}
```

- [ ] **Step 2: Write the form**

Create `apps/web/app/projects/[id]/members/InviteForm.tsx`:

```tsx
// apps/web/app/projects/[id]/members/InviteForm.tsx
"use client";

import { useActionState } from "react";
import {
  Alert,
  Button,
  Field,
  Input,
} from "@zkcvp/design-system-ledger/components";
import { inviteDeveloperAction, type InviteState } from "./actions";

const initial: InviteState = { status: "idle" };

export function InviteForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(
    inviteDeveloperAction.bind(null, projectId),
    initial,
  );

  return (
    <form action={action} className="app-form">
      {state.status === "invited" && (
        <Alert tone="success">
          Invited {state.githubUsername}. They join this project the first time
          they sign in with GitHub.
        </Alert>
      )}
      {state.status === "added" && (
        <Alert tone="success">
          Added {state.githubUsername} to this project.
        </Alert>
      )}
      {/* Infrastructure failure — red, and never confused with a verdict. */}
      {state.status === "unavailable" && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <Field
        label="GitHub username"
        required
        help="Resolved to a permanent numeric id, so a later username change does not break the link."
        error={state.status === "error" ? state.message : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="githubUsername"
            aria-describedby={describedBy}
            invalid={invalid}
            mono
          />
        )}
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Looking up…" : "Invite developer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the page**

Create `apps/web/app/projects/[id]/members/page.tsx`:

```tsx
// apps/web/app/projects/[id]/members/page.tsx
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  RoleTag,
  Section,
  SectionHeading,
  Table,
  Td,
} from "@zkcvp/design-system-ledger/components";
import { getDb } from "../../../../lib/db";
import { requireSession } from "../../../../lib/auth/session";
import { getProject } from "../../../../lib/projects/service";
import { listMembers } from "../../../../lib/projects/members";
import { InviteForm } from "./InviteForm";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getDb();

  const project = await getProject(db, session, id);
  const { members, pendingInvites } = await listMembers(db, session, id);

  return (
    <main className="lg-container app-page">
      <PageHeader title={`${project.name} — members`} />

      <Card>
        <CardHeader>Developers</CardHeader>
        <CardBody>
          {members.length === 0 ? (
            <EmptyState
              title="No developers yet"
              description="Invite one by GitHub username."
            />
          ) : (
            <Table headers={["Developer", "GitHub", "Added"]}>
              {members.map((m) => (
                <tr key={m.developerId}>
                  <Td>
                    {m.displayName} <RoleTag role="developer" />
                  </Td>
                  <Td>{m.githubUsername}</Td>
                  <Td>{dateFormat.format(m.addedAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </CardBody>
      </Card>

      {pendingInvites.length > 0 && (
        <Section>
          <SectionHeading>Pending invites</SectionHeading>
          <Table headers={["GitHub", "Invited"]}>
            {pendingInvites.map((i) => (
              <tr key={i.id}>
                <Td>
                  {i.githubUsername} <Badge>Pending</Badge>
                </Td>
                <Td>{dateFormat.format(i.invitedAt)}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {/* Only a stakeholder may invite. A developer member sees the roster
          without the form. */}
      {session.kind === "stakeholder" && (
        <Section>
          <SectionHeading>Invite a developer</SectionHeading>
          <InviteForm projectId={id} />
        </Section>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Build and verify**

Run: `npm run build -w @zkcvp/web && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/projects/[id]/members"
git commit -m "feat(web): project members screen and developer invite form"
```

---

### Task 14: Close out M4

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/app.css`
- Modify: `docs/architecture.md:87-104` (the Status section)
- Delete: `docs/superpowers/plans/2026-08-15-m4-requirements-and-stakeholder-ui.md`

- [ ] **Step 1: Replace the design-system demo home page**

`apps/web/app/page.tsx` currently renders status-chip scaffolding from M2. Replace its body with a redirect to `/projects`:

```tsx
// apps/web/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/projects");
}
```

- [ ] **Step 2: Add the two app-level classes the screens use**

Append to `apps/web/app/app.css`:

```css
/* Vertical rhythm for a routed page's stacked sections. */
.app-page > * + * {
  margin-block-start: var(--lg-space-6);
}

/* Forms are single-column and narrow — a wide input reads as accepting more
   text than it wants. */
.app-form {
  display: flex;
  flex-direction: column;
  gap: var(--lg-space-4);
  max-width: 34rem;
}
```

Confirm `--lg-space-6` and `--lg-space-4` exist in `packages/design-system-ledger/styles/tokens.css`; if the scale is named differently, use the real token names.

- [ ] **Step 3: Update the Status section of docs/architecture.md**

Change `In progress: **M4 …**` to a built statement naming what shipped, and set `Next: **M5 — Remaining checklist screens.**` Remove any M4 line that is no longer true.

- [ ] **Step 4: Full verification**

Run: `npm run verify && npm run build -w @zkcvp/web`
Expected: PASS. Then run the dev server and walk one real path end to end: sign in as a stakeholder via the magic link printed to the console, create a project, add a requirement, edit it, confirm the new version reads "Not evaluated", archive it, and invite a GitHub username.

- [ ] **Step 5: Delete this plan and commit**

```bash
rm docs/superpowers/plans/2026-08-15-m4-requirements-and-stakeholder-ui.md
git add -A
git commit -m "docs: record M4 as built and retire the M4 plan"
```

---

## Notes for the implementer

- **`params` is a Promise in Next 15.** Every dynamic page and route handler must `await params`. Forgetting it fails at runtime, not at compile time.
- **`redirect()` throws.** Never call it inside a `try` block that catches broadly — it will swallow the navigation.
- **Design system prop names are not guessed here with certainty** for `Table`, `TimelineItem`, `PageHeader.actions`, and `EmptyState`. Read the component file before using it, and follow the real signature. The Ledger public surface is `packages/design-system-ledger/components/index.ts`.
- **Two mechanisms ship without tests, deliberately**: the `db.transaction` in `createRequirement` and the `SELECT … FOR UPDATE` in `editRequirement`. Do not remove either while refactoring — nothing will fail if you do.
