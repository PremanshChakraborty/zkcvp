import { afterEach, describe, expect, it } from "vitest";
import { env, resetEnvCache } from "../lib/env";

const VALID = "postgresql://u:p@host:5432/db";

afterEach(() => {
  resetEnvCache();
  delete process.env.DATABASE_URL;
  delete process.env.EVAL_CEILING_SECONDS;
  delete process.env.AUTH_SECRET;
  delete process.env.AUTH_GITHUB_ID;
  delete process.env.AUTH_GITHUB_SECRET;
});

describe("env", () => {
  it("parses a valid environment", () => {
    process.env.DATABASE_URL = VALID;
    process.env.EVAL_CEILING_SECONDS = "300";
    process.env.AUTH_SECRET = "test-secret";
    expect(env().DATABASE_URL).toBe(VALID);
    expect(env().EVAL_CEILING_SECONDS).toBe(300);
  });

  it("defaults EVAL_CEILING_SECONDS when unset", () => {
    process.env.DATABASE_URL = VALID;
    process.env.AUTH_SECRET = "test-secret";
    expect(env().EVAL_CEILING_SECONDS).toBe(300);
  });

  it("throws a named error when DATABASE_URL is missing", () => {
    process.env.AUTH_SECRET = "test-secret";
    expect(() => env()).toThrow(/DATABASE_URL/);
  });

  it("throws a named error when AUTH_SECRET is missing", () => {
    process.env.DATABASE_URL = VALID;
    expect(() => env()).toThrow(/AUTH_SECRET/);
  });

  it("leaves AUTH_GITHUB_ID/AUTH_GITHUB_SECRET undefined when unset", () => {
    process.env.DATABASE_URL = VALID;
    process.env.AUTH_SECRET = "test-secret";
    expect(env().AUTH_GITHUB_ID).toBeUndefined();
    expect(env().AUTH_GITHUB_SECRET).toBeUndefined();
  });

  it("reads process.env at call time, not at import time", () => {
    // The host is undecided, so config must not be baked into the build.
    process.env.DATABASE_URL = VALID;
    process.env.AUTH_SECRET = "test-secret";
    expect(env().DATABASE_URL).toBe(VALID);
    resetEnvCache();
    process.env.DATABASE_URL = "postgresql://u:p@other:5432/db";
    expect(env().DATABASE_URL).toContain("other");
  });
});
