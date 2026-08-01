# ZKCVP Foundation (M0–M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the repo from "design system only" to a running Next.js 15 app in an npm
workspace, with the Evaluator contract package the parallel orchestrator workstream needs and
the full plan-01 database schema migrated to Postgres.

**Architecture:** npm workspaces monorepo. `apps/web` is the single Next.js deployable;
`packages/contracts` holds pure types with zero runtime dependencies; `packages/db` holds
Drizzle schema and migrations; `packages/design-system-ledger` is the existing design system
relocated with its history and its render check intact. Every choice is made so the
deployment host stays undecided.

**Tech Stack:** Next.js 15.5.22 (pinned exact), React 19, TypeScript 5.7+, Drizzle ORM
0.45.x over `pg` 8.x, Zod 4.x, Vitest 4.x, Postgres (Supabase-hosted).

**Spec:** `docs/superpowers/specs/2026-08-01-foundation-design.md`
**Business-rule authority:** `docs/plans/01-requirement-management.md`. Where this plan and
that document disagree about a business rule, that document wins — stop and raise it.

**Scope:** M0, M1, M2 only. Ends at Gate A with a migrated database. Authentication (M3),
plan 01's endpoints (M4), and the checklist UI (M5) are separate plans, written once this
foundation is real.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Next.js pinned to exactly `15.5.22`.** Not `^15`, not `latest`. `next-auth@5` beta is
  validated against Next 15, and M3 depends on that.
- **React 19.** `packages/design-system-ledger` declares `react@^19`; the app must match.
- **No Tailwind, ever.** The design system is plain CSS with no build step and no runtime.
- **Node runtime only.** Never write `export const runtime = 'edge'` anywhere.
- **No `@vercel/*` dependency or import anywhere in `apps/web`.**
- **No authorization logic in `middleware.ts`** — unauthenticated redirects only.
- **Environment variables are read at runtime, never at module top level in a way that bakes
  them into the build.**
- **`design-system/` (the first visual direction) is never modified or moved.**
- **`packages/design-system-ledger/components/types.ts` is never modified.** It is
  byte-identical to `design-system/components/types.ts` on purpose.
- **The raw string `eval_failed` must never reach a rendered screen.** It is a legitimate
  negative verdict, not a malfunction.
- **Package naming:** all workspace packages are scoped `@zkcvp/*`.
- **Line endings:** repo is `eol=lf` via `.gitattributes` (Task 1). Windows checkouts get CRLF
  in the working tree and LF in the index; this is expected.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` (root) | workspace declaration, shared scripts, shared devDependencies |
| `.gitattributes` | normalise line endings across Windows/CI |
| `vitest.config.ts` (root) | test projects across workspaces |
| `apps/web/next.config.ts` | host-agnostic build config |
| `apps/web/app/layout.tsx` | root layout — the *only* place `ledger.app.css` and `next/font` are wired |
| `apps/web/app/ledger/page.tsx` | design-system gallery, verifiable inside the real app |
| `apps/web/lib/env.ts` | Zod-validated runtime environment access |
| `apps/web/tests/host-agnostic.test.ts` | guardrail: no edge runtime, no `@vercel/*` |
| `packages/contracts/src/domain.ts` | domain enums mirroring plan 01's database enums |
| `packages/contracts/src/evaluator.ts` | Evaluator I/O types and interface |
| `packages/contracts/src/github.ts` | `GitHubReadTool` interface |
| `packages/contracts/tests/enum-parity.test.ts` | guardrail: contracts enums match the design system's |
| `packages/db/src/schema/identity.ts` | `stakeholders`, `developers`, `verification_tokens` |
| `packages/db/src/schema/projects.ts` | `projects`, memberships, both invite tables |
| `packages/db/src/schema/requirements.ts` | `requirements`, `requirement_versions` |
| `packages/db/src/client.ts` | pooled `pg` client factory |
| `packages/db/tests/harness.ts` | per-run isolated schema create/drop |
| `packages/db/tests/constraints.test.ts` | verifies constraints are enforced *by Postgres* |
| `packages/orchestrator/src/index.ts` | `NotImplementedError` stub implementing `Evaluator` |

---

## Task 1: Workspace root

**Files:**
- Create: `package.json`, `.gitattributes`, `.gitignore`, `tsconfig.base.json`

**Interfaces:**
- Consumes: nothing.
- Produces: npm workspaces resolving `apps/*` and `packages/*`; `tsconfig.base.json` extended
  by every package.

- [ ] **Step 1: Create the workspace root `package.json`**

```json
{
  "name": "zkcvp",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w @zkcvp/web",
    "build": "npm run build -w @zkcvp/web",
    "test": "vitest run",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "verify": "npm run typecheck && npm run test"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^4.1.10",
    "tsx": "^4.23.1",
    "@types/node": "^26.1.2"
  }
}
```

- [ ] **Step 2: Create `.gitattributes`**

Git warned about LF→CRLF on every commit so far. This normalises it before more files land.

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.woff binary
*.woff2 binary
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.next/
dist/
.check/
.env
.env.local
*.tsbuildinfo
```

- [ ] **Step 4: Create `tsconfig.base.json`**

Mirrors the compiler options `design-system-ledger/tsconfig.json` already uses, so the
relocated package needs no behavioural change.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

- [ ] **Step 5: Install and verify the workspace resolves**

Run: `npm install`
Then: `npm query .workspace`
Expected: valid JSON array. It will be empty — no workspace packages exist yet. An *error*
here means the `workspaces` field is malformed; an empty array is correct.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitattributes .gitignore tsconfig.base.json
git commit -m "chore: npm workspace root, shared tsconfig, line-ending normalisation"
```

---

## Task 2: Relocate the design system into the workspace

The existing render check is the test for this task. It asserts real rendered markup — that no
status chip contains `eval_failed`, that a valid inclusion proof never renders in the satisfied
colour, that every icon-only button has an accessible name. If it passes after the move,
nothing regressed.

**Files:**
- Move: `design-system-ledger/` → `packages/design-system-ledger/` (via `git mv`)
- Modify: `packages/design-system-ledger/package.json`, `packages/design-system-ledger/vite.config.ts`, `packages/design-system-ledger/tsconfig.json`
- Create: `packages/design-system-ledger/styles/_layers.css`, `packages/design-system-ledger/styles/ledger.app.css`
- **Never modify:** `packages/design-system-ledger/components/types.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` (Task 1).
- Produces: package `@zkcvp/design-system-ledger` with subpath exports
  `./components`, `./gallery`, `./styles/*`. New stylesheet entry point
  `styles/ledger.app.css` (all layers, **no** `fonts.css`) for the app;
  `styles/ledger.css` keeps its current behaviour for the no-build preview pages.

- [ ] **Step 1: Record the current render-check result as the baseline**

Run: `cd design-system-ledger && npm install && npm run verify`
Expected: PASS. If it fails *before* the move, stop — fix or report that first, because
otherwise there is no baseline to compare against.

- [ ] **Step 2: Move the directory, preserving history**

```bash
git mv design-system-ledger packages/design-system-ledger
```

- [ ] **Step 3: Rename the package and add subpath exports**

In `packages/design-system-ledger/package.json`, change `"name": "zkcvp-ledger"` to
`"@zkcvp/design-system-ledger"` and add an `exports` block after `"version"`:

```json
  "exports": {
    "./components": "./components/index.ts",
    "./gallery": "./gallery/Gallery.tsx",
    "./styles/*": "./styles/*"
  },
```

Entry points are raw `.ts`/`.tsx`. `apps/web` compiles them via `transpilePackages` (Task 3);
the Vite gallery uses relative paths and is unaffected by this field.

Leave `dependencies` and `devDependencies` exactly as they are. Leave the `"//peer"` comment
block — it documents why react is a dependency rather than a peer, and that reasoning still
holds.

- [ ] **Step 4: Split the stylesheet entry point**

The app must not ship `fonts.css` — its `@import` blocks render and cannot be preloaded
(design-system-ledger README, "Fonts"). The preview pages *do* need it, because they run with
no build step. Both are satisfied by extracting the shared layer list rather than duplicating
it, so the two entry points cannot drift.

Create `packages/design-system-ledger/styles/_layers.css`:

```css
/* =============================================================================
   The layer stack, without fonts. Shared by both entry points so they cannot
   drift. Do not import this file directly — use `ledger.css` (previews, loads
   Geist over @import) or `ledger.app.css` (the app, loads Geist via next/font).

   Order matters. `tokens` defines every value, `base` sets document defaults,
   the two component layers read tokens only, and `responsive` loads last so it
   can override component rules without raising specificity.
   ============================================================================= */

@import "./tokens.css";
@import "./base.css";
@import "./components.css";
@import "./domain.css";
@import "./responsive.css";
```

Replace the body of `packages/design-system-ledger/styles/ledger.css` (keep its existing
header comment) so the six `@import` lines become:

```css
@import "./fonts.css";
@import "./_layers.css";
```

Create `packages/design-system-ledger/styles/ledger.app.css`:

```css
/* =============================================================================
   ZKCVP · Ledger — application entry point.

   Identical to `ledger.css` minus `fonts.css`. The app loads Geist through
   next/font, which self-hosts the files and emits a preload link; the @import
   in fonts.css exists only so `previews/*.html` render the real typeface with
   no build step, and it must not ship. See "Fonts" in ../README.md.

     import "@zkcvp/design-system-ledger/styles/ledger.app.css";
   ============================================================================= */

@import "./_layers.css";
```

- [ ] **Step 5: Fix the Vite dev-server filesystem allowance**

npm workspaces hoist `node_modules` to the repo root, which is now two levels above the
package instead of zero. Vite's `fs.allow` must reach it or the gallery dev server will refuse
to serve React.

In `packages/design-system-ledger/vite.config.ts`, replace `fs: { allow: [".."] }` with:

```ts
    /* Component and gallery source live one level above the Vite root; the
     * hoisted workspace node_modules lives three levels above it. */
    fs: { allow: ["..", "../../.."] },
```

- [ ] **Step 6: Point the package tsconfig at the shared base**

Replace the `compilerOptions` block in `packages/design-system-ledger/tsconfig.json` with an
`extends`, keeping the existing `include` array and its explanatory comment verbatim:

```json
{
  "extends": "../../tsconfig.base.json",
  /*
   * `components` first: it is the deliverable. `gallery` and `preview-app` are
   * harnesses that prove it renders, and are typechecked in the same pass so a
   * broken specimen cannot land alongside a working component.
   */
  "include": ["components", "gallery", "preview-app/src", "checks"]
}
```

- [ ] **Step 7: Reinstall from the workspace root and re-run the render check**

```bash
rm -rf packages/design-system-ledger/node_modules packages/design-system-ledger/package-lock.json
npm install
npm run verify -w @zkcvp/design-system-ledger
```

Expected: PASS, identical to the Step 1 baseline. A failure here means the move broke a path,
not that an assertion needs relaxing — each assertion maps to a documented domain rule.

- [ ] **Step 8: Verify the preview pages still render Geist**

Open `packages/design-system-ledger/previews/index.html` directly in a browser.
Expected: text renders in Geist, not `system-ui`. This confirms the `ledger.css` split did not
break the no-build path.

- [ ] **Step 9: Commit**

```bash
git add -A packages/design-system-ledger package.json package-lock.json
git commit -m "refactor: move ledger design system into packages/, split app stylesheet entry

Adds styles/_layers.css shared by ledger.css (previews, @import fonts) and
styles/ledger.app.css (the app, next/font). Neither duplicates the layer list.
Render check passes unchanged."
```

---

## Task 3: Scaffold `apps/web`

**Files:**
- Create: `apps/web/` (via `create-next-app`), `apps/web/next.config.ts`
- Modify: `apps/web/package.json`, `apps/web/tsconfig.json`

**Interfaces:**
- Consumes: `@zkcvp/design-system-ledger` (Task 2), `tsconfig.base.json` (Task 1).
- Produces: package `@zkcvp/web` with `dev` / `build` / `start` / `typecheck` scripts and a
  host-agnostic `next.config.ts`.

- [ ] **Step 1: Scaffold**

```bash
npx create-next-app@15.5.22 apps/web \
  --typescript --app --no-tailwind --no-src-dir --no-eslint \
  --no-turbopack --import-alias "@/*" --use-npm --skip-install
```

`--no-tailwind` is not optional: the design system is plain CSS and adding Tailwind's preflight
would fight its reset. `--skip-install` because the workspace root installs everything.

- [ ] **Step 2: Rename the package and pin Next exactly**

In `apps/web/package.json`, set `"name": "@zkcvp/web"` and make the `next` dependency the exact
string `"15.5.22"` — no caret. Add a `typecheck` script:

```json
    "typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Add the workspace and runtime dependencies**

```bash
npm install -w @zkcvp/web @zkcvp/design-system-ledger @phosphor-icons/react zod
```

- [ ] **Step 4: Write the host-agnostic `next.config.ts`**

Replace `apps/web/next.config.ts` entirely:

```ts
import type { NextConfig } from "next";

/**
 * The deployment host is deliberately undecided — serverless (Vercel-class) and
 * a long-lived Node host are both live options, and the choice gets made once a
 * real Evaluator run has been measured. Everything here exists to keep that
 * decision cheap. See "Host-agnostic guarantees" in
 * docs/superpowers/specs/2026-08-01-foundation-design.md.
 */
const nextConfig: NextConfig = {
  /* Emits a self-contained Node server at .next/standalone/server.js, runnable
   * under `node server.js` on Railway/Render/Fly/Docker. Vercel ignores it. */
  output: "standalone",

  /* The design system ships raw .ts/.tsx — Next compiles it in-app. */
  transpilePackages: ["@zkcvp/design-system-ledger"],

  /* The standalone tracer walks up to the workspace root to find hoisted deps. */
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
};

export default nextConfig;
```

- [ ] **Step 5: Point the app tsconfig at the shared base**

Edit `apps/web/tsconfig.json` so it has `"extends": "../../tsconfig.base.json"`. Keep every
key `create-next-app` generated that the base does not set — in particular `plugins`
(`{ "name": "next" }`), `paths` (`{ "@/*": ["./*"] }`), `allowJs`, `incremental`, and the
`include`/`exclude` arrays. Remove `noEmit` from the local file if present; the base sets it.

If `noUnusedLocals` / `noUnusedParameters` from the base cause errors in generated files,
fix the generated files rather than loosening the base — the design system already builds
under those flags and the app should hold the same line.

- [ ] **Step 6: Verify the app builds**

```bash
npm install
npm run build -w @zkcvp/web
```

Expected: build succeeds, and the output mentions `.next/standalone`.

- [ ] **Step 7: Verify the standalone server actually runs**

This is the whole point of `output: "standalone"`, so prove it rather than trusting the flag.

```bash
node apps/web/.next/standalone/apps/web/server.js
```

Expected: server starts and `http://localhost:3000` serves the default page. Stop it with
Ctrl-C. If the path differs, locate `server.js` under `.next/standalone/` and use that — the
nesting depends on `outputFileTracingRoot`.

- [ ] **Step 8: Verify Auth.js resolves against this Next and React**

M3 is built entirely on `next-auth@5`. Discovering an incompatibility then would mean
unwinding the framework choice after five tasks depend on it, so prove it now — it costs one
install and one typecheck.

```bash
npm install -w @zkcvp/web next-auth@5.0.0-beta.32
```

Expected: installs with **no `ERESOLVE` peer conflict** against `next@15.5.22` and
`react@19`. A peer warning mentioning `next@^14` or `react@^18` is the signal to stop.

Then create a throwaway file `apps/web/lib/authjs-probe.ts`:

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/* Probe only — deleted at the end of this step. Confirms the v5 `NextAuth()`
 * factory and its provider subpath both typecheck against this Next and React
 * before M3 commits to them. */
export const { handlers, auth } = NextAuth({
  providers: [GitHub({ clientId: "x", clientSecret: "y" })],
  session: { strategy: "jwt" },
});
```

Run: `npm run typecheck -w @zkcvp/web`
Expected: clean.

**Then delete the probe:** `rm apps/web/lib/authjs-probe.ts`

If either the install or the typecheck fails, **stop and report it**. The fallback is a
different auth approach, not a different Next version — Next 15 was chosen precisely to make
this work, so a failure here means the spec's auth decision needs revisiting.

`next-auth` stays installed; M3 uses it.

- [ ] **Step 9: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat: scaffold apps/web on Next 15.5.22, host-agnostic config

Pinned exact — next-auth@5 beta is validated against Next 15 and M3 depends on
it, verified here by install and typecheck before anything is built on it.
output: standalone verified by running the emitted server."
```

---

## Task 4: Vitest and the host-agnosticism guardrail

Without this test, the host-agnostic promise rots silently — someone adds an edge route six
weeks from now and nothing complains until a deploy fails.

**Files:**
- Create: `vitest.config.ts`, `apps/web/tests/host-agnostic.test.ts`

**Interfaces:**
- Consumes: `apps/web` (Task 3).
- Produces: `npm test` at the repo root, running every workspace's `tests/**/*.test.ts`.

- [ ] **Step 1: Write the root Vitest config**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{apps,packages}/*/tests/**/*.test.ts"],
    /* The design system has its own render check (`npm run verify -w
     * @zkcvp/design-system-ledger`) which server-renders real markup. It is not
     * a Vitest suite and is not collected here. */
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
});
```

- [ ] **Step 2: Write the failing guardrail test**

```ts
// apps/web/tests/host-agnostic.test.ts
import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const WEB_ROOT = new URL("../", import.meta.url).pathname;
const SKIP = new Set(["node_modules", ".next", "tests", "dist"]);

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await sourceFiles(full)));
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

describe("host agnosticism", () => {
  it("declares no edge runtime anywhere", async () => {
    const files = await sourceFiles(WEB_ROOT);
    const offenders: string[] = [];
    for (const f of files) {
      const src = await readFile(f, "utf8");
      if (/runtime\s*=\s*["'`]edge["'`]/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("imports nothing from @vercel/*", async () => {
    const files = await sourceFiles(WEB_ROOT);
    const offenders: string[] = [];
    for (const f of files) {
      const src = await readFile(f, "utf8");
      if (/from\s+["'`]@vercel\//.test(src) || /require\(["'`]@vercel\//.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("declares no @vercel/* dependency", async () => {
    const pkg = JSON.parse(
      await readFile(join(WEB_ROOT, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(all.filter((d) => d.startsWith("@vercel/"))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and verify it passes on a clean scaffold**

Run: `npm test`
Expected: 3 passing. This test is written to pass immediately — it is a regression guard, not
a red-green cycle. Proving it *can* fail is Step 4.

- [ ] **Step 4: Prove the guardrail actually catches a violation**

A guard that cannot fail is worse than no guard, because it manufactures confidence. Temporarily
add to `apps/web/app/page.tsx`:

```ts
export const runtime = "edge";
```

Run: `npm test`
Expected: FAIL, listing `app/page.tsx`.
**Then delete that line** and re-run — expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts apps/web/tests/host-agnostic.test.ts package.json package-lock.json
git commit -m "test: vitest root config and host-agnosticism guardrail

Asserts no edge runtime declaration and no @vercel/* dependency or import.
Verified to fail when a violation is introduced."
```

---

## Task 5: Wire the design system into the app

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Delete: `apps/web/app/page.module.css`, `apps/web/app/globals.css` (scaffold leftovers)
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `@zkcvp/design-system-ledger` subpath exports (Task 2).
- Produces: `ledger.app.css` loaded once at the root; `--lg-font-sans` / `--lg-font-mono` bound
  to `next/font` variables; the whole tree wrapped in `<LedgerIcons>`.

- [ ] **Step 1: Delete the scaffold's stylesheets**

```bash
rm -f apps/web/app/globals.css apps/web/app/page.module.css
```

They set competing resets and fonts. The design system owns both.

- [ ] **Step 2: Write the root layout**

Adapted from `packages/design-system-ledger/preview-app/next-adapter/layout.tsx`. Two changes
from that file: the stylesheet import is the package specifier and the no-fonts entry point,
and the tree is wrapped in `<LedgerIcons>`.

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@zkcvp/design-system-ledger/styles/ledger.app.css";
import { LedgerIcons } from "@zkcvp/design-system-ledger/components";

/* Self-hosted at build time by next/font. No network request at runtime, and no
 * render-blocking @import — which is why the app uses `ledger.app.css` rather
 * than `ledger.css`. See "Fonts" in the design system README. */
const geistSans = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZKCVP",
  description:
    "Independent machine attestation over real source at pinned commits.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * No `data-theme` here. Ledger is light-first with the dark values applied
     * by `prefers-color-scheme`, so leaving the attribute off means the app
     * follows the reader's OS. A theme toggle sets it explicitly, and the
     * attribute selectors in tokens.css beat the media query in both directions.
     */
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body
        /*
         * Point the system's family tokens at the next/font variables. This is
         * the whole integration: every component reads --lg-font-sans and
         * --lg-font-mono, so nothing else has to change.
         */
        style={
          {
            "--lg-font-sans": "var(--font-geist-sans), system-ui, sans-serif",
            "--lg-font-mono": "var(--font-geist-mono), ui-monospace, monospace",
          } as React.CSSProperties
        }
      >
        <LedgerIcons>{children}</LedgerIcons>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Replace the scaffold's home page with a real design-system smoke test**

```tsx
// apps/web/app/page.tsx
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
    <main className="lg-page">
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
```

If any imported name does not exist, check `packages/design-system-ledger/components/index.ts`
— that file is the authoritative export list — and adjust the import rather than inventing a
component. If `lg-page` is not a real class, check `styles/base.css` for the correct layout
helper.

- [ ] **Step 4: Verify it renders**

```bash
npm run dev -w @zkcvp/web
```

Open `http://localhost:3000`. Expected, all four:
1. Text renders in **Geist**, not the system font.
2. The three chips read **"Not evaluated"**, **"Verified"**, **"Not satisfied"** — the raw
   string `eval_failed` appears nowhere on screen.
3. Switching your OS to dark mode re-themes the page with no reload.
4. Browser devtools shows **no** `@import` for a Google Fonts stylesheet — Geist is
   self-hosted.

Item 2 is the one that matters most: it is the product's most load-bearing display rule.

- [ ] **Step 5: Verify the production build still works**

Run: `npm run build -w @zkcvp/web`
Expected: succeeds. This catches `"use client"` boundary problems that dev mode tolerates.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: wire ledger design system into apps/web

Root layout loads ledger.app.css once and binds --lg-font-sans/--lg-font-mono
to next/font Geist. Tree wrapped in LedgerIcons. Scaffold globals.css and
page.module.css removed — the design system owns the reset."
```

---

## Task 6: The `/ledger` gallery route

Keeping the gallery reachable from inside the real app means the design system is verified
against the app's actual font loading, CSS order, and React version — not just against Vite's.

**Files:**
- Create: `apps/web/app/ledger/page.tsx`

**Interfaces:**
- Consumes: `@zkcvp/design-system-ledger/gallery` (Task 2), the root layout (Task 5).
- Produces: `/ledger` route.

- [ ] **Step 1: Create the route**

```tsx
// apps/web/app/ledger/page.tsx
"use client";

/**
 * The design system gallery, mounted inside the real app.
 *
 * The Vite harness in packages/design-system-ledger renders the same components
 * against its own React and its own CSS pipeline. This route renders them
 * against the app's — next/font, the app's CSS order, the app's React 19 build —
 * which is where an integration problem would actually surface.
 */
import { Gallery } from "@zkcvp/design-system-ledger/gallery";

export default function LedgerPage() {
  return <Gallery />;
}
```

If `Gallery` is not a named export, check `packages/design-system-ledger/gallery/Gallery.tsx`
for the actual export shape and adjust — including the `exports` map in the package's
`package.json` if the subpath needs to point elsewhere.

- [ ] **Step 2: Verify the gallery renders in the app**

```bash
npm run dev -w @zkcvp/web
```

Open `http://localhost:3000/ledger`. Expected: every gallery section renders, and the
theme and density switches both work.

If the gallery imports `gallery.css` relatively, confirm it loaded; if Next did not pick it
up, add `"./gallery/*": "./gallery/*"` to the package's `exports` map.

- [ ] **Step 3: Verify the production build**

Run: `npm run build -w @zkcvp/web`
Expected: succeeds. The gallery pulls in far more of the component surface than the home page,
so this is the real test of the `transpilePackages` and `"use client"` setup.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/ledger packages/design-system-ledger/package.json
git commit -m "feat: mount the design system gallery at /ledger

Renders the components against the app's own font loading, CSS order and React
build rather than only against the Vite harness."
```

---

## Task 7: Runtime environment access

**Files:**
- Create: `apps/web/lib/env.ts`, `apps/web/tests/env.test.ts`, `.env.example`

**Interfaces:**
- Consumes: `zod` (Task 3).
- Produces: `env()` returning `{ DATABASE_URL: string; EVAL_CEILING_SECONDS: number; NODE_ENV: string }`.
  Later tasks and M3 extend the schema; the accessor name does not change.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/env.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { env, resetEnvCache } from "../lib/env";

const VALID = "postgresql://u:p@host:5432/db";

afterEach(() => {
  resetEnvCache();
  delete process.env.DATABASE_URL;
  delete process.env.EVAL_CEILING_SECONDS;
});

describe("env", () => {
  it("parses a valid environment", () => {
    process.env.DATABASE_URL = VALID;
    process.env.EVAL_CEILING_SECONDS = "300";
    expect(env().DATABASE_URL).toBe(VALID);
    expect(env().EVAL_CEILING_SECONDS).toBe(300);
  });

  it("defaults EVAL_CEILING_SECONDS when unset", () => {
    process.env.DATABASE_URL = VALID;
    expect(env().EVAL_CEILING_SECONDS).toBe(300);
  });

  it("throws a named error when DATABASE_URL is missing", () => {
    expect(() => env()).toThrow(/DATABASE_URL/);
  });

  it("reads process.env at call time, not at import time", () => {
    // The host is undecided, so config must not be baked into the build.
    process.env.DATABASE_URL = VALID;
    expect(env().DATABASE_URL).toBe(VALID);
    resetEnvCache();
    process.env.DATABASE_URL = "postgresql://u:p@other:5432/db";
    expect(env().DATABASE_URL).toContain("other");
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npm test -- env`
Expected: FAIL — cannot resolve `../lib/env`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/env.ts
import { z } from "zod";

/**
 * Runtime environment access.
 *
 * Deliberately a FUNCTION rather than an exported constant. A module-level
 * `export const env = schema.parse(process.env)` is evaluated during the build,
 * which bakes build-time values into the bundle and makes the same artifact
 * behave differently on two hosts. The deployment host here is deliberately
 * undecided, so configuration has to be read when it is used.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /* How long one Evaluator run may take. A serverless host caps this at its
   * request execution ceiling; a long-lived Node host does not cap it at all.
   * Feeds EvaluationProgress's `ceilingSeconds` prop, which turns the elapsed
   * clock ochre past 70% so a developer is warned BEFORE the request is cut
   * off. Host-configurable precisely because the host is not chosen yet. */
  EVAL_CEILING_SECONDS: z.coerce.number().int().positive().default(300),

  NODE_ENV: z.string().default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${detail}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only. Clears the memoised value so a test can vary process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- env`
Expected: 4 passing.

- [ ] **Step 5: Create `.env.example`**

```
# Pooled Postgres connection string. Supabase: Project Settings → Database →
# Connection string → Transaction pooler. Populated at Gate A.
DATABASE_URL=

# Ceiling for one Evaluator run, in seconds. Serverless hosts cap this at their
# request execution limit; a long-lived Node host does not. Default 300.
EVAL_CEILING_SECONDS=300
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/env.ts apps/web/tests/env.test.ts .env.example
git commit -m "feat: Zod-validated runtime environment access

env() is a function, not a module constant — a build-time parse would bake
values into the bundle and defeat the host-agnostic build."
```

---

## Task 8: `packages/contracts` — the orchestrator handoff

This is what unblocks the parallel orchestrator workstream. It lands before `packages/db`
because nothing in M2 depends on it and the other workstream is waiting.

**Files:**
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`,
  `packages/contracts/src/domain.ts`, `packages/contracts/src/evaluator.ts`,
  `packages/contracts/src/github.ts`, `packages/contracts/src/index.ts`,
  `packages/contracts/tests/enum-parity.test.ts`
- Create: `packages/orchestrator/package.json`, `packages/orchestrator/tsconfig.json`,
  `packages/orchestrator/src/index.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` (Task 1); reads (never modifies)
  `packages/design-system-ledger/components/types.ts`.
- Produces: `@zkcvp/contracts` exporting `RequirementStatus`, `Verdict`, `Role`,
  `InviteStatus`, `RepoCommit`, `TreeEntry`, `ToolCall`, `GitHubReadTool`, `EvaluatorInput`,
  `EvidenceBundle`, `Report`, `Evaluator`, `NotImplementedError`. Zero runtime dependencies.

- [ ] **Step 1: Create the package manifests**

`packages/contracts/package.json`:

```json
{
  "name": "@zkcvp/contracts",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

No `dependencies` block, deliberately: this package is types only, so the orchestrator
workstream can depend on it without inheriting anything.

`packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: Write the domain enums**

```ts
// packages/contracts/src/domain.ts

/**
 * Domain vocabulary shared between the database, the API and the Evaluator.
 *
 * These mirror the database enums in docs/plans/01-requirement-management.md,
 * and they must stay identical to design-system-ledger/components/types.ts.
 * That parity is asserted by tests/enum-parity.test.ts — the typechecker cannot
 * see across the two packages, and drift means one surface would tell a user
 * something another does not.
 */

/** `requirement_versions.status` — the persisted enum. */
export type RequirementStatus = "new" | "verified" | "eval_failed";

/** Per-requirement Evaluator output. */
export type Verdict = "satisfied" | "not_satisfied";

export type Role = "stakeholder" | "developer";

/** `project_developer_invites.status` / `project_stakeholder_invites.status`. */
export type InviteStatus = "pending" | "accepted";

/* Runtime tuples, so schema definitions and validators can enumerate the values
 * without restating them. Order matches the type unions above. */
export const REQUIREMENT_STATUSES = ["new", "verified", "eval_failed"] as const;
export const VERDICTS = ["satisfied", "not_satisfied"] as const;
export const ROLES = ["stakeholder", "developer"] as const;
export const INVITE_STATUSES = ["pending", "accepted"] as const;
```

`RequirementDisplayStatus` is deliberately **not** here. It folds `archived_at` into the status
axis for display only, it is never persisted, and it is never part of a contract — it belongs
to the design system alone.

- [ ] **Step 3: Write the GitHub tool interface**

```ts
// packages/contracts/src/github.ts

export type RepoCommit = {
  /** "owner/name". */
  repo: string;
  /** Full 40-character SHA. The Evaluator reads this exact commit, never HEAD. */
  commitSha: string;
};

export type TreeEntry = {
  path: string;
  type: "file" | "dir";
  size?: number;
};

/**
 * File and diff access scoped to specific commit SHAs.
 *
 * Authenticated as the requesting developer's own live GitHub OAuth token —
 * never a service-level credential, and there is no GitHub App or installation
 * anywhere in this design. The token is injected by the caller and is never
 * stored, logged, or serialised into either output artifact.
 *
 * This is also why evaluation runs synchronously inside the request that submits
 * a claim: there is no persisted token a background process could use once the
 * developer's session ends.
 */
export interface GitHubReadTool {
  readFile(repo: string, commitSha: string, path: string): Promise<string>;
  listTree(repo: string, commitSha: string, path?: string): Promise<TreeEntry[]>;
  diff(repo: string, baseSha: string, headSha: string): Promise<string>;
}
```

- [ ] **Step 4: Write the Evaluator contract**

```ts
// packages/contracts/src/evaluator.ts
import type { Verdict } from "./domain";
import type { GitHubReadTool, RepoCommit } from "./github";

export type EvaluatorInput = {
  claim: {
    /** One or more, shared across every requirement in this batch. */
    repoCommits: RepoCommit[];
  };
  /** One or more, evaluated together against the same claim. */
  requirements: {
    requirementVersionId: string;
    title: string;
    description: string;
  }[];
  github: GitHubReadTool;
};

export type ToolCall = {
  tool: string;
  args: Record<string, unknown>;
  result: string;
  at: string;
};

/**
 * The raw tool-call transcript, containing verbatim source from a private repo.
 *
 * NOT shown to the stakeholder in this phase — stored only. This is what gets
 * hashed for the Transparency Log's `evidence_hash`, which is what makes
 * integrity checkable WITHOUT disclosing contents. Withheld is not unverifiable;
 * the two are separate operations and the first never requires the second.
 */
export type EvidenceBundle = {
  evaluationId: string;
  claimId: string;
  toolCallLog: ToolCall[];
};

/**
 * Human language only, one entry per requirement in the batch.
 *
 * Unconditionally visible to the stakeholder the moment evaluation completes —
 * no developer consent step, no release flag, no gating of any kind.
 */
export type Report = {
  evaluationId: string;
  claimId: string;
  modelId: string;
  promptTemplateVersion: string;
  /** ISO 8601. Dates are absolute throughout this product, never relative. */
  createdAt: string;
  perRequirement: {
    requirementVersionId: string;
    verdict: Verdict;
    /**
     * Prose. Must never embed verbatim source code — a file path or a line
     * range is fine, pasted code is not. This is a GENERATION-TIME constraint
     * on the agent's output step, not a display-layer filter: filtering code
     * out of already-generated text is unreliable.
     */
    rationale: string;
  }[];
};

/**
 * The Evaluator, black-boxed on purpose.
 *
 * Returns two STRUCTURALLY SEPARATE artifacts. They are never merged into one
 * object: one is withheld and one is unconditionally visible, and a shape that
 * blurs that invites a surface that blurs it too.
 *
 * A plain async function by design. The route handler that calls it is a thin
 * adapter, so moving between a serverless host and a long-lived Node host
 * changes where this is invoked from, not what it is.
 */
export interface Evaluator {
  evaluate(input: EvaluatorInput): Promise<{
    evidence: EvidenceBundle;
    report: Report;
  }>;
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}
```

- [ ] **Step 5: Write the barrel**

```ts
// packages/contracts/src/index.ts
export * from "./domain";
export * from "./github";
export * from "./evaluator";
```

- [ ] **Step 6: Write the failing enum-parity test**

```ts
// packages/contracts/tests/enum-parity.test.ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  INVITE_STATUSES,
  REQUIREMENT_STATUSES,
  ROLES,
  VERDICTS,
} from "../src/domain";

/**
 * The design system and this package describe the same domain from two sides.
 * TypeScript cannot see across them — design-system-ledger deliberately imports
 * nothing, so its types.ts can stay byte-identical to the first visual
 * direction's copy. That leaves textual comparison as the only available check,
 * and drift here means one surface tells a user something another does not.
 *
 * If this fails: fix packages/contracts. NEVER edit
 * design-system-ledger/components/types.ts — it is byte-identical to
 * design-system/components/types.ts on purpose.
 */
const TYPES_PATH = new URL(
  "../../design-system-ledger/components/types.ts",
  import.meta.url,
).pathname;

async function unionMembers(alias: string): Promise<string[]> {
  const src = await readFile(TYPES_PATH, "utf8");
  const m = new RegExp(`export type ${alias} =([^;]+);`).exec(src);
  if (!m) throw new Error(`Type alias ${alias} not found in ${TYPES_PATH}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("contracts/design-system enum parity", () => {
  it("RequirementStatus matches", async () => {
    expect(await unionMembers("RequirementStatus")).toEqual([
      ...REQUIREMENT_STATUSES,
    ]);
  });

  it("Verdict matches", async () => {
    expect(await unionMembers("Verdict")).toEqual([...VERDICTS]);
  });

  it("Role matches", async () => {
    expect(await unionMembers("Role")).toEqual([...ROLES]);
  });

  it("InviteStatus matches", async () => {
    expect(await unionMembers("InviteStatus")).toEqual([...INVITE_STATUSES]);
  });
});
```

- [ ] **Step 7: Run it**

Run: `npm test -- enum-parity`
Expected: 4 passing. If a case fails, the tuple order in `domain.ts` does not match the union
order in `types.ts` — fix `domain.ts`.

- [ ] **Step 8: Prove the parity test can fail**

Temporarily change `REQUIREMENT_STATUSES` in `domain.ts` to
`["new", "verified", "failed"] as const`.
Run: `npm test -- enum-parity`
Expected: FAIL on `RequirementStatus`. **Revert the change** and re-run — 4 passing.

- [ ] **Step 9: Create the orchestrator stub**

`packages/orchestrator/package.json`:

```json
{
  "name": "@zkcvp/orchestrator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@zkcvp/contracts": "*" }
}
```

`packages/orchestrator/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

```ts
// packages/orchestrator/src/index.ts
import {
  type Evaluator,
  type EvaluatorInput,
  type EvidenceBundle,
  NotImplementedError,
  type Report,
} from "@zkcvp/contracts";

/**
 * Placeholder. The LangGraph Evaluator is built in a separate workstream; this
 * exists so the interface has a compiling implementation and so nothing in the
 * app is written against a type that has never been instantiated.
 *
 * It throws rather than returning fabricated output on purpose: the Evaluator
 * does not exist yet, and no surface may present anything as real verdict output.
 */
export class StubEvaluator implements Evaluator {
  async evaluate(
    _input: EvaluatorInput,
  ): Promise<{ evidence: EvidenceBundle; report: Report }> {
    throw new NotImplementedError("StubEvaluator.evaluate");
  }
}
```

- [ ] **Step 10: Typecheck both new packages**

```bash
npm install
npm run typecheck -w @zkcvp/contracts
npm run typecheck -w @zkcvp/orchestrator
```

Expected: both clean.

- [ ] **Step 11: Commit**

```bash
git add packages/contracts packages/orchestrator package.json package-lock.json
git commit -m "feat: @zkcvp/contracts — Evaluator I/O types and domain enums

Zero runtime dependencies, so the orchestrator workstream can depend on it
without inheriting anything. Evidence bundle and report are structurally
separate types and are never merged. Enum parity with the design system is
asserted by test, since the typechecker cannot see across the two packages."
```

**⟵ The parallel orchestrator workstream is unblocked from this commit.**

---

## Task 9: `packages/db` skeleton and client

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`,
  `packages/db/drizzle.config.ts`, `packages/db/src/client.ts`, `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `@zkcvp/contracts` (Task 8).
- Produces: `@zkcvp/db` exporting `createDb(connectionString: string)` returning a Drizzle
  instance typed over the full schema, plus `closeDb()`.

- [ ] **Step 1: Create the manifest**

```json
{
  "name": "@zkcvp/db",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./src/index.ts", "./schema": "./src/schema/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@zkcvp/contracts": "*",
    "drizzle-orm": "^0.45.2",
    "pg": "^8.22.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.10",
    "@types/pg": "^8.11.0"
  }
}
```

`pg` (node-postgres) deliberately, not `@vercel/postgres` and not an HTTP driver — a standard
pooled connection string is what keeps the database layer host-agnostic.

- [ ] **Step 2: Create the tsconfig**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Write the client factory**

```ts
// packages/db/src/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export type Db = ReturnType<typeof createDb>;

let pool: pg.Pool | undefined;

/**
 * Pooled Drizzle client.
 *
 * A connection string is the ONLY input, which is what makes the database host
 * swappable — Supabase, Neon, Railway, or local Postgres are all the same code.
 * Deliberately not `@vercel/postgres` or an HTTP driver.
 *
 * The pool is memoised per process. On a serverless host each cold start gets
 * its own; on a long-lived Node host there is exactly one. Both are correct,
 * which is the point.
 */
export function createDb(connectionString: string) {
  pool ??= new pg.Pool({ connectionString, max: 10 });
  return drizzle(pool, { schema });
}

/** Closes the pool. For test teardown and graceful shutdown. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
```

- [ ] **Step 4: Write the barrel**

```ts
// packages/db/src/index.ts
export { createDb, closeDb, type Db } from "./client";
export * from "./schema/index";
```

- [ ] **Step 5: Write the Drizzle config**

```ts
// packages/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  /* Readable SQL files rather than an opaque push. Migrations are reviewable
   * artifacts — this project's whole argument is about trustworthy records. */
  verbose: true,
  strict: true,
});
```

- [ ] **Step 6: Install**

Run: `npm install`
Expected: succeeds. Typecheck will fail until Task 12 creates the schema barrel — that is
expected and is fixed there.

- [ ] **Step 7: Commit**

```bash
git add packages/db package.json package-lock.json
git commit -m "feat: @zkcvp/db skeleton — pooled pg client and drizzle-kit config

Connection string is the only input, which is what keeps the database host
swappable. Not @vercel/postgres, not an HTTP driver."
```

---

## Task 10: Identity tables

**Files:**
- Create: `packages/db/src/schema/identity.ts`

**Interfaces:**
- Consumes: `@zkcvp/contracts` (Task 8).
- Produces: `stakeholders`, `developers`, `verificationTokens` table objects.

Reference: `docs/plans/01-requirement-management.md`, "Data model".

- [ ] **Step 1: Write the schema**

```ts
// packages/db/src/schema/identity.ts
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Stakeholders and developers are ENTIRELY SEPARATE entities — not one users
 * table with a role flag.
 *
 * Every action and audit field in this design is performed by exactly one of the
 * two; nothing anywhere needs to reference "whichever kind of user did this".
 * Separate tables give real database-enforced foreign keys and eliminate the
 * nullable-union columns (an `email OR github_id` column) a single-table design
 * would force. See plan 01, "Core concepts", and invariant 1.
 *
 * A person who is a developer on one project and a stakeholder on another ends
 * up as two unrelated rows. That is accepted in this phase, not a bug.
 */

export const stakeholders = pgTable("stakeholders", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Sole identity key. */
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const developers = pgTable("developers", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * GitHub's NUMERIC user id, stored as text to dodge JS integer limits.
   *
   * Never the username. Usernames are mutable and this must not be — plan 01
   * invariant 2. This is the join key everywhere a developer is referenced by
   * GitHub identity, including invite matching at login.
   */
  githubUserId: text("github_user_id").notNull().unique(),
  /** Cache only, for display. Refreshed on every login. Never a join key. */
  githubUsername: text("github_username").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Magic-link verification tokens for the stakeholder Auth.js instance (M3).
 *
 * Shape is dictated by Auth.js's adapter interface, not by plan 01. It holds no
 * OAuth token: the developer's GitHub access token lives only in the encrypted
 * session cookie and is never persisted to any table. That is a deliberate
 * custody choice, and it is why evaluation must run inside a live session.
 */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.identifier, t.token] }),
    index("verification_tokens_identifier_idx").on(t.identifier),
  ],
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/schema/identity.ts
git commit -m "feat(db): stakeholders, developers, verification_tokens

Two separate identity tables per plan 01 — no shared users table, no role flag.
github_user_id is the numeric id as text and is the only join key; the username
is cache-only."
```

---

## Task 11: Project, membership and invite tables

**Files:**
- Create: `packages/db/src/schema/projects.ts`

**Interfaces:**
- Consumes: `identity.ts` (Task 10), `@zkcvp/contracts` (Task 8).
- Produces: `projects`, `projectStakeholders`, `projectDevelopers`,
  `projectDeveloperInvites`, `projectStakeholderInvites`, `inviteStatus` enum.

- [ ] **Step 1: Write the schema**

```ts
// packages/db/src/schema/projects.ts
import { INVITE_STATUSES } from "@zkcvp/contracts";
import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { developers, stakeholders } from "./identity";

export const inviteStatus = pgEnum("invite_status", INVITE_STATUSES);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /**
   * Display and audit only — NOT the access-control source of truth.
   * Authorization always reads a membership row. All project_stakeholders rows
   * carry equal permissions; there is no owner tier in this phase.
   */
  createdBy: uuid("created_by")
    .notNull()
    .references(() => stakeholders.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectStakeholders = pgTable(
  "project_stakeholders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    stakeholderId: uuid("stakeholder_id")
      .notNull()
      .references(() => stakeholders.id),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => stakeholders.id),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.projectId, t.stakeholderId)],
);

export const projectDevelopers = pgTable(
  "project_developers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id),
    /* Only a stakeholder can add a developer — a single-typed FK, never a
     * polymorphic actor_type + actor_id. Plan 01 invariant 1. */
    addedBy: uuid("added_by")
      .notNull()
      .references(() => stakeholders.id),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.projectId, t.developerId)],
);

export const projectDeveloperInvites = pgTable(
  "project_developer_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    /* Resolved at invite time via GitHub's public user-lookup API. Never the
     * raw username — see plan 01 invariant 2. */
    githubUserId: text("github_user_id").notNull(),
    githubUsername: text("github_username").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => stakeholders.id),
    status: inviteStatus("status").notNull().default("pending"),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /**
     * PARTIAL unique index — pending only.
     *
     * Prevents duplicate pending invites to the same person for the same
     * project, while still allowing a re-invite after an earlier one was
     * accepted. A plain unique constraint would forbid that second invite
     * forever, which is why this is a `WHERE`-qualified index.
     */
    uniqueIndex("project_developer_invites_pending_unique")
      .on(t.projectId, t.githubUserId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/**
 * Schema only — NO endpoint and NO UI in this phase.
 *
 * It exists so multi-stakeholder support requires no migration later. Plan 01 is
 * explicit: do not build anything that writes to this table yet.
 */
export const projectStakeholderInvites = pgTable(
  "project_stakeholder_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    email: text("email").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => stakeholders.id),
    status: inviteStatus("status").notNull().default("pending"),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("project_stakeholder_invites_pending_unique")
      .on(t.projectId, t.email)
      .where(sql`${t.status} = 'pending'`),
  ],
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/schema/projects.ts
git commit -m "feat(db): projects, memberships and both invite tables

Pending-invite uniqueness is a partial index rather than a plain constraint, so
a re-invite after acceptance stays possible. project_stakeholder_invites is
schema-only in this phase — no endpoint writes to it."
```

---

## Task 12: Requirement tables

The circular foreign key here is the one piece of this schema that will not compile if written
naively.

**Files:**
- Create: `packages/db/src/schema/requirements.ts`, `packages/db/src/schema/index.ts`

**Interfaces:**
- Consumes: `identity.ts` (Task 10), `projects.ts` (Task 11), `@zkcvp/contracts` (Task 8).
- Produces: `requirements`, `requirementVersions`, `requirementStatus` enum, and the schema
  barrel `packages/db/src/schema/index.ts` that `client.ts` (Task 9) already imports.

- [ ] **Step 1: Write the schema**

```ts
// packages/db/src/schema/requirements.ts
import { REQUIREMENT_STATUSES } from "@zkcvp/contracts";
import {
  type AnyPgColumn,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { stakeholders } from "./identity";

/**
 * `eval_failed` means the Evaluator returned NOT SATISFIED. It is a legitimate
 * result, not a malfunction. The enum name is misleading and must never reach a
 * screen — the design system maps it to "Not satisfied" and that mapping lives
 * in exactly one place.
 *
 * There is deliberately NO pending or in-flight state. Evaluation runs
 * synchronously inside the request that submits a claim, and status goes
 * directly to a terminal outcome.
 */
export const requirementStatus = pgEnum(
  "requirement_status",
  REQUIREMENT_STATUSES,
);

/**
 * A requirement is a stable, long-lived identity — "this is one piece of scope".
 * It never itself holds text or status.
 */
export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),

  /**
   * NULLABLE, and null only transiently inside the create transaction:
   * insert requirement (null) → insert version → update this pointer. Never
   * null once that transaction commits.
   *
   * The `AnyPgColumn` return annotation is required: this and
   * requirement_versions.requirement_id form a circular reference, and without
   * it TypeScript cannot infer the type of either table.
   */
  currentVersionId: uuid("current_version_id").references(
    (): AnyPgColumn => requirementVersions.id,
  ),

  createdBy: uuid("created_by")
    .notNull()
    .references(() => stakeholders.id),

  /**
   * Soft-delete flag, ORTHOGONAL to version status. Archiving says nothing
   * about whether a requirement was ever verified, and status says nothing
   * about whether it is archived. Never let one imply or overwrite the other —
   * plan 01 invariant 5. There is no un-archive in this phase.
   */
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * An IMMUTABLE snapshot of a requirement's text, plus the verification status
 * for that specific text.
 *
 * Editing never mutates a version — it creates a new one. Title and description
 * are immutable once written; `status` is the only field ever updated after
 * creation, and only by the future verification-result trigger.
 *
 * NOTE what is absent: there is no status column on `requirements`. A
 * requirement's effective status is its current version's status, resolved
 * through current_version_id AT READ TIME via a join. Storing it in two places
 * guarantees they desync.
 */
export const requirementVersions = pgTable(
  "requirement_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requirementId: uuid("requirement_id")
      .notNull()
      .references((): AnyPgColumn => requirements.id),
    /** Starts at 1, increments per requirement. */
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /**
     * A new version ALWAYS starts at 'new', unconditionally — plan 01
     * invariant 4. This is what makes "editing a verified requirement reopens
     * it" fall out for free, so it must never become conditional.
     */
    status: requirementStatus("status").notNull().default("new"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => stakeholders.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.requirementId, t.versionNumber)],
);
```

- [ ] **Step 2: Write the schema barrel**

```ts
// packages/db/src/schema/index.ts
export * from "./identity";
export * from "./projects";
export * from "./requirements";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -w @zkcvp/db`
Expected: clean. If it complains about circular inference on `requirements` or
`requirementVersions`, the `AnyPgColumn` return annotation is missing from one of the two
`.references()` callbacks — both need it.

- [ ] **Step 4: Generate the migration**

```bash
npm run generate -w @zkcvp/db
```

Expected: a `packages/db/migrations/0000_*.sql` file plus a `meta/` directory. No database
connection is needed for this.

- [ ] **Step 5: Read the generated SQL and verify five things**

Open the generated `.sql` and confirm by eye:

1. **Ten** `CREATE TABLE` statements — the nine from plan 01, plus `verification_tokens`,
   which Auth.js requires and plan 01 does not describe:
   `stakeholders`, `developers`, `projects`, `project_stakeholders`, `project_developers`,
   `project_developer_invites`, `project_stakeholder_invites`, `requirements`,
   `requirement_versions`, and `verification_tokens`.
2. `requirements.current_version_id` has **no** `NOT NULL`.
3. Two enum types: `requirement_status` with exactly `new`, `verified`, `eval_failed`; and
   `invite_status` with exactly `pending`, `accepted`.
4. The pending-invite indexes carry a `WHERE "status" = 'pending'` clause. If the `WHERE` is
   missing, the partial index degraded to a plain unique constraint — fix the schema and
   regenerate.
5. There is **no** `status` column on `requirements`.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema packages/db/migrations
git commit -m "feat(db): requirements and requirement_versions, generate migration

current_version_id is nullable and transient inside the create transaction, per
plan 01. The circular FK with requirement_versions.requirement_id needs the
AnyPgColumn annotation on both sides. No status column on requirements —
effective status is always a read-time join."
```

---

## ⏸ GATE A — Supabase project

**STOP. Hand these steps to the user and wait.** The next task cannot run without
`DATABASE_URL`.

Present exactly this:

> **Gate A — create the Supabase project (~3 minutes)**
>
> 1. Go to https://supabase.com/dashboard and sign in.
> 2. **New project**. Name it `zkcvp`. Choose the region closest to you.
> 3. Set a database password and **save it** — it is shown once and it is part of the
>    connection string.
> 4. Wait for provisioning (~1 min).
> 5. **Project Settings → Database → Connection string → URI**, and pick the
>    **Transaction pooler** entry (port `6543`), not the direct connection. The pooler is
>    what keeps this working on a serverless host.
> 6. Copy it and replace `[YOUR-PASSWORD]` with the password from step 3.
> 7. Create `apps/web/.env.local` and `packages/db/.env` — both containing:
>
> ```
> DATABASE_URL=postgresql://postgres.xxxx:YOUR-PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
> ```
>
> Both files are gitignored. Two copies because Next reads `.env.local` and drizzle-kit reads
> the package's own `.env`.
>
> **Note on migrations:** if `drizzle-kit migrate` errors about prepared statements, use the
> **Session pooler** (port `5432`) for migrations only, keeping the transaction pooler for the
> app. Tell me and I will split the two into separate env values.
>
> Tell me when that is in place.

---

## Task 13: Apply migrations and build the test harness

**Files:**
- Create: `packages/db/tests/harness.ts`, `packages/db/tests/schema.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` (Gate A), the schema (Tasks 10–12), `createDb` (Task 9).
- Produces: `withTestSchema()` — creates a uniquely-named Postgres schema, runs migrations
  into it, yields a `Db`, and drops it afterwards.

- [ ] **Step 1: Apply the migration to Supabase**

```bash
npm run migrate -w @zkcvp/db
```

Expected: succeeds. Verify in the Supabase dashboard under **Table Editor** that all ten
tables exist.

- [ ] **Step 2: Load `.env` in the Vitest config**

Add to `vitest.config.ts`, above `defineConfig`:

```ts
import { config } from "dotenv";
config({ path: "./packages/db/.env" });
```

Install it: `npm install -D dotenv@^17.4.2` at the root.

- [ ] **Step 3: Write the isolation harness**

```ts
// packages/db/tests/harness.ts
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/schema/index";

export type TestDb = NodePgDatabase<typeof schema>;

/**
 * Runs a test against a private, uniquely-named schema inside the ONE Supabase
 * project, then drops it.
 *
 * Schema-per-run rather than database-per-run: creating databases needs
 * privileges a pooled Supabase connection does not have, and schema isolation
 * gives the same guarantee — parallel runs and reruns cannot see each other's
 * rows, and nothing accumulates. It also means no second project and no Docker.
 *
 * Each call gets its own Pool, NOT the memoised one from src/client.ts, because
 * `search_path` is per-connection and a shared pool would leak it across tests.
 */
export async function withTestSchema<T>(
  fn: (db: TestDb) => Promise<T>,
): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run database tests");

  const name = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Pool({ connectionString: url, max: 1 });

  try {
    await admin.query(`CREATE SCHEMA "${name}"`);

    const pool = new pg.Pool({
      connectionString: url,
      max: 2,
      options: `-c search_path="${name}"`,
    });
    try {
      const db = drizzle(pool, { schema });
      await migrate(db, {
        migrationsFolder: new URL("../migrations", import.meta.url).pathname,
        migrationsSchema: name,
      });
      return await fn(db);
    } finally {
      await pool.end();
    }
  } finally {
    /* `name` is generated here from a timestamp and Math.random, never from
     * input, so interpolating it is safe. Postgres has no bind parameter for an
     * identifier, so there is no parameterised alternative. */
    await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await admin.end();
  }
}
```

If the `options: '-c search_path=...'` connection parameter is not honoured through the
Supabase pooler, replace it with a `pool.on("connect", (c) => c.query(\`SET search_path TO "${name}"\`))`
handler — same effect, applied per connection.

- [ ] **Step 4: Write the failing schema test**

This asserts the constraints are enforced *by Postgres*, not by application code. Every one of
these is a rule the application would otherwise have to remember.

```ts
// packages/db/tests/schema.test.ts
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { withTestSchema } from "./harness";
import {
  developers,
  projectDeveloperInvites,
  projects,
  requirements,
  requirementVersions,
  stakeholders,
} from "../src/schema/index";

const HOUR = 60_000;

describe("schema constraints are enforced by Postgres", () => {
  it("rejects a duplicate developer github_user_id", async () => {
    await withTestSchema(async (db) => {
      await db.insert(developers).values({
        githubUserId: "12345",
        githubUsername: "octocat",
        displayName: "Octocat",
      });
      await expect(
        db.insert(developers).values({
          githubUserId: "12345",
          githubUsername: "renamed",
          displayName: "Renamed",
        }),
      ).rejects.toThrow();
    });
  }, HOUR);

  it("allows a second PENDING invite once the first is accepted", async () => {
    // The partial index is WHERE status = 'pending' precisely so this works.
    // A plain unique constraint would forbid a re-invite forever.
    await withTestSchema(async (db) => {
      const [s] = await db
        .insert(stakeholders)
        .values({ email: "s@example.com", displayName: "S" })
        .returning();
      const [p] = await db
        .insert(projects)
        .values({ name: "P", createdBy: s.id })
        .returning();

      const invite = {
        projectId: p.id,
        githubUserId: "999",
        githubUsername: "dev",
        invitedBy: s.id,
      };

      const [first] = await db
        .insert(projectDeveloperInvites)
        .values(invite)
        .returning();

      await expect(
        db.insert(projectDeveloperInvites).values(invite),
      ).rejects.toThrow();

      await db
        .update(projectDeveloperInvites)
        .set({ status: "accepted" })
        .where(eq(projectDeveloperInvites.id, first.id));

      await expect(
        db.insert(projectDeveloperInvites).values(invite),
      ).resolves.toBeDefined();
    });
  }, HOUR);

  it("rejects a duplicate (requirement_id, version_number)", async () => {
    await withTestSchema(async (db) => {
      const [s] = await db
        .insert(stakeholders)
        .values({ email: "s@example.com", displayName: "S" })
        .returning();
      const [p] = await db
        .insert(projects)
        .values({ name: "P", createdBy: s.id })
        .returning();
      const [r] = await db
        .insert(requirements)
        .values({ projectId: p.id, createdBy: s.id })
        .returning();

      const version = {
        requirementId: r.id,
        versionNumber: 1,
        title: "T",
        description: "D",
        createdBy: s.id,
      };
      await db.insert(requirementVersions).values(version);
      await expect(
        db.insert(requirementVersions).values(version),
      ).rejects.toThrow();
    });
  }, HOUR);

  it("defaults a new version to status 'new'", async () => {
    // Plan 01 invariant 4 — unconditional, which is what makes editing a
    // verified requirement reopen it with no special-case logic.
    await withTestSchema(async (db) => {
      const [s] = await db
        .insert(stakeholders)
        .values({ email: "s@example.com", displayName: "S" })
        .returning();
      const [p] = await db
        .insert(projects)
        .values({ name: "P", createdBy: s.id })
        .returning();
      const [r] = await db
        .insert(requirements)
        .values({ projectId: p.id, createdBy: s.id })
        .returning();
      const [v] = await db
        .insert(requirementVersions)
        .values({
          requirementId: r.id,
          versionNumber: 1,
          title: "T",
          description: "D",
          createdBy: s.id,
        })
        .returning();
      expect(v.status).toBe("new");
    });
  }, HOUR);

  it("permits the requirement create transaction: null pointer, then set", async () => {
    await withTestSchema(async (db) => {
      const [s] = await db
        .insert(stakeholders)
        .values({ email: "s@example.com", displayName: "S" })
        .returning();
      const [p] = await db
        .insert(projects)
        .values({ name: "P", createdBy: s.id })
        .returning();

      await db.transaction(async (tx) => {
        const [r] = await tx
          .insert(requirements)
          .values({ projectId: p.id, createdBy: s.id })
          .returning();
        expect(r.currentVersionId).toBeNull();

        const [v] = await tx
          .insert(requirementVersions)
          .values({
            requirementId: r.id,
            versionNumber: 1,
            title: "T",
            description: "D",
            createdBy: s.id,
          })
          .returning();

        const [updated] = await tx
          .update(requirements)
          .set({ currentVersionId: v.id })
          .where(eq(requirements.id, r.id))
          .returning();
        expect(updated.currentVersionId).toBe(v.id);
      });
    });
  }, HOUR);

  it("keeps archived_at and status orthogonal", async () => {
    // Archiving has no status precondition and does not touch versions.
    await withTestSchema(async (db) => {
      const [s] = await db
        .insert(stakeholders)
        .values({ email: "s@example.com", displayName: "S" })
        .returning();
      const [p] = await db
        .insert(projects)
        .values({ name: "P", createdBy: s.id })
        .returning();
      const [r] = await db
        .insert(requirements)
        .values({ projectId: p.id, createdBy: s.id })
        .returning();
      const [v] = await db
        .insert(requirementVersions)
        .values({
          requirementId: r.id,
          versionNumber: 1,
          title: "T",
          description: "D",
          status: "verified",
          createdBy: s.id,
        })
        .returning();

      const [archived] = await db
        .update(requirements)
        .set({ currentVersionId: v.id, archivedAt: new Date() })
        .where(eq(requirements.id, r.id))
        .returning();

      expect(archived.archivedAt).not.toBeNull();
      const [still] = await db
        .select()
        .from(requirementVersions)
        .where(eq(requirementVersions.id, v.id));
      expect(still.status).toBe("verified");
    });
  }, HOUR);
});
```

The `HOUR` timeout on each test is per-test, not a real expectation: schema creation plus a
migration over a pooled remote connection is slow, and a default 5s timeout will produce
confusing failures.

- [ ] **Step 5: Run and verify**

Run: `npm test -- schema`
Expected: 6 passing. A failure naming a missing constraint is a real schema bug — fix
`packages/db/src/schema/`, regenerate the migration, and re-run. Do not relax an assertion.

- [ ] **Step 6: Confirm the harness cleans up after itself**

In the Supabase dashboard, **SQL Editor**, run:

```sql
select schema_name from information_schema.schemata where schema_name like 'test_%';
```

Expected: zero rows. Leftover schemas mean the `finally` block is not firing — fix it now
rather than after a hundred test runs have accumulated.

- [ ] **Step 7: Commit**

```bash
git add packages/db/tests vitest.config.ts package.json package-lock.json
git commit -m "test(db): schema-per-run harness and constraint verification

Asserts Postgres itself enforces the invariants — unique github_user_id,
partial pending-invite uniqueness that still allows re-invite after acceptance,
unique (requirement_id, version_number), default status 'new', the nullable
current_version_id create transaction, and archived_at/status orthogonality."
```

---

## Task 14: Foundation verification

The point of this task is that someone arriving cold can run one command and know the
foundation is sound.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a documented `npm run verify` covering every workspace.

- [ ] **Step 1: Run the full verification**

```bash
npm install
npm run verify
npm run verify -w @zkcvp/design-system-ledger
npm run build -w @zkcvp/web
```

Expected, in order: all typechecks clean; all Vitest suites pass; the design system's render
check passes; the app builds with standalone output.

- [ ] **Step 2: Record the state in `README.md`**

Update the **Feature status** table — add a row:

```markdown
| Application foundation (workspace, scaffold, contracts, schema) | Built — `docs/superpowers/plans/2026-08-01-foundation-m0-m2.md` |
```

Under **Repo conventions**, add:

```markdown
- `docs/superpowers/specs/` — design specs. `docs/superpowers/plans/` — implementation plans.
- The repo is an npm workspace: `apps/web` is the deployable; `packages/contracts` (types
  only), `packages/db` (Drizzle schema), `packages/orchestrator` (stub), and
  `packages/design-system-ledger` are its workspace dependencies.
```

In the **Tech stack** table, replace the Database row's `Postgres` with
`Postgres (Supabase-hosted) via Drizzle ORM over node-postgres` and add a row:

```markdown
| Framework version | Next.js 15.5.22, pinned exact — next-auth@5 is validated against Next 15 |
```

Under **Open questions**, strike the auth line — it is resolved. Replace it with:

```markdown
- ~~Auth implementation~~ — resolved: Auth.js v5, two separate instances (GitHub with no
  adapter; email magic link with a stakeholders-only adapter). See
  `docs/superpowers/specs/2026-08-01-foundation-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: record the application foundation in the repo map

Resolves the auth open question and documents the workspace layout."
```

---

## Done when

- `npm run verify` is clean from a fresh clone plus `npm install` and a `DATABASE_URL`.
- `npm run dev -w @zkcvp/web` serves a Geist-rendered page whose status chips read
  "Not evaluated", "Verified" and "Not satisfied" — and `eval_failed` appears nowhere.
- `/ledger` renders the full gallery inside the app, with working theme and density switches.
- `node apps/web/.next/standalone/.../server.js` runs the built app with no Vercel runtime.
- All ten tables exist in Supabase, with both partial pending-invite indexes carrying their
  `WHERE` clause.
- `packages/contracts` typechecks with zero runtime dependencies.

## Next plans

- **M3 — Authentication.** Two Auth.js v5 instances, console magic-link sender, session
  helpers, invite activation on developer login. Contains **Gate B** (GitHub OAuth app).
- **M4 — Plan 01's ten endpoints**, TDD against the harness built in Task 13.
- **M5 — Checklist UI.**
