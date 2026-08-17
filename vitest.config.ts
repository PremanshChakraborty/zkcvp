import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: "./packages/db/.env" });

export default defineConfig({
  test: {
    include: ["{apps,packages}/*/tests/**/*.test.ts"],
    /* The design system has its own render check (`npm run verify -w
     * @zkcvp/design-system-ledger`) which server-renders real markup. It is not
     * a Vitest suite and is not collected here.
     *
     * packages/orchestrator/tests/integration.test.ts is a MANUAL script, not a
     * suite — its own header says to run it with
     * `GITHUB_TOKEN=... GOOGLE_API_KEY=... npx tsx`. It hits a live repo and a
     * live LLM, so collecting it here would make the suite fail for anyone
     * without both credentials. Run it by hand when you want it. */
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "packages/orchestrator/tests/**",
    ],

    /* Caps how many test FILES run at once. This is a Postgres connection
     * budget, not a CPU one.
     *
     * Every `withTestSchema` call opens its own pools rather than sharing the
     * memoised client — `search_path` is per-connection, so a shared pool would
     * leak one test's schema into another (see packages/db/tests/harness.ts).
     * That costs ~3 connections per in-flight file (admin max:1 + pool max:2).
     * Unbounded, ~18 files ask for ~54 at once and Postgres answers
     * "sorry, too many clients already" / "remaining connection slots are
     * reserved for roles with the SUPERUSER attribute" — which looks like a
     * dozen unrelated test failures rather than a resource limit.
     *
     * Measured against this project's Supabase instance, not guessed:
     *
     *   workers │ result       │ connection errors │ wall
     *   ────────┼──────────────┼───────────────────┼──────
     *      6    │ 64/96        │ many              │  93s
     *      3    │ 64/96        │ many              │ 138s
     *      2    │ 96/96        │ NONE              │ 327s
     *      2    │ 96/96        │ NONE              │ 340s
     *      1    │ 93/93 *      │ none              │ 680s
     *
     * (* the 1-worker run predated the orchestrator exclude added above, so it
     * collected fewer files — 93 is a different denominator, not a worse
     * result. Not directly comparable to the 96-test rows.)
     *
     * A run at maxWorkers: 2 occasionally shows one or two failures as
     * ECONNRESET against the database (seen once, at 94/96); that is transient
     * network flakiness between this machine and the hosted Postgres instance,
     * not a capacity signal — a re-run at the same setting passes clean, as the
     * two rows above show.
     *
     * Over-subscribing fails as "sorry, too many clients already", "remaining
     * connection slots are reserved for roles with the SUPERUSER attribute",
     * and Supavisor's "(EMAXPOOLSREACHED) max pools count reached" — note the
     * pooler caps the NUMBER OF POOLS, so the real budget is tighter than a raw
     * connection count predicts. Switching the endpoint from the transaction
     * pooler (:6543) to session mode (:5432) was tried and does NOT change this.
     *
     * It fails as a dozen scattered, unrelated-looking test failures rather
     * than an obvious resource message, so raise this ONLY with a measured run
     * behind you. Two is the ceiling this instance sustains; a larger database
     * would allow more. Do NOT solve it by turning file parallelism off —
     * that doubles the wall time again for no benefit. */
    maxWorkers: 2,
  },
});
