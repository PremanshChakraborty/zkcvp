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
