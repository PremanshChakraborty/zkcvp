// packages/db/tests/harness.ts
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
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
 *
 * DEVIATION FROM THE ORIGINAL BRIEF, discovered by running against the real
 * database (not reasoned in the abstract): the brief's original implementation
 * used `drizzle-orm/node-postgres/migrator`'s `migrate()` with a
 * `migrationsSchema` option, on the assumption that a `search_path`
 * connection-parameter (or, as a fallback, a `pool.on("connect", ...)`
 * handler) would make the migration's DDL land in the per-run schema.
 *
 * That assumption held for search_path itself — verified directly against
 * this Supabase pooler: both the `-c search_path=...` connection option and a
 * `pool.on("connect", ...)` handler correctly scope unqualified statements
 * (e.g. `CREATE TABLE developers (...)`) to the per-run schema. It did NOT
 * hold for `migrate()` as a whole, because `migrationsSchema` only controls
 * where the `__drizzle_migrations` tracking table lives — it does not rewrite
 * the migration's own SQL. drizzle-kit always fully schema-qualifies
 * `CREATE TYPE` statements (this project's migration reads literally
 * `CREATE TYPE "public"."invite_status" ...`), and Postgres has no
 * `CREATE TYPE ... IF NOT EXISTS`. So the very first `withTestSchema` call
 * after the real migration is applied to `public` (Task 13 Step 1) fails with
 * `type "invite_status" already exists` — deterministically, regardless of
 * search_path, and independent of the Supabase pooler.
 *
 * Fix: read the migration file(s) directly and execute their statements after
 * rewriting the literal `"public".` qualifier to this run's schema name, so
 * the enum types get the same per-run isolation the (unqualified) tables
 * already get via `search_path`. This intentionally does not use `migrate()`
 * or the `__drizzle_migrations` tracking table — each schema is created fresh
 * and dropped after exactly one use, so migration history has nothing to
 * track.
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
      const migrationsDir = fileURLToPath(
        new URL("../migrations", import.meta.url),
      );
      const sqlFiles = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      const client = await pool.connect();
      try {
        for (const file of sqlFiles) {
          const raw = readFileSync(`${migrationsDir}/${file}`, "utf8");
          /* Rewrite the hardcoded `public` schema qualifier (drizzle-kit
           * always emits one for CREATE TYPE) to this run's private schema,
           * so enum types get isolated the same way the unqualified tables
           * already are via search_path. */
          const rewritten = raw.replaceAll('"public".', `"${name}".`);
          const statements = rewritten
            .split("--> statement-breakpoint")
            .map((s) => s.trim())
            .filter(Boolean);
          for (const statement of statements) {
            await client.query(statement);
          }
        }
      } finally {
        client.release();
      }

      const db = drizzle(pool, { schema });
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
