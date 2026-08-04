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

  /* Auth.js JWT encryption/signing secret, shared by both instances — the two
   * disjoint session cookies (dev/sh) don't need separate secrets, since the
   * cookie name itself is what keeps them apart. */
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

  /* Gate B — GitHub OAuth app credentials. Deliberately optional: the
   * stakeholder magic-link flow must keep working before Gate B is done (see
   * docs/architecture.md, M3). Left unset, the GitHub provider builds with an
   * empty client id/secret and only the developer login path is affected. */
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  /* Public origin of this deployment, e.g. https://zkcvp.example.com.
   *
   * Optional, but strongly recommended in production. When set, Auth.js
   * derives callback/action URLs from it instead of from the incoming
   * request's Host header, which removes host-header spoofing as a way to
   * redirect an OAuth callback. Unset, we fall back to trusting the proxy's
   * headers (see `trustHost` in developer.ts / stakeholder.ts).
   *
   * Read here only so the value is validated and documented in one place;
   * Auth.js reads process.env.AUTH_URL itself. */
  AUTH_URL: z.string().url().optional(),
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
