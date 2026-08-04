// apps/web/tests/auth/magic-link-sender.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleMagicLinkSender } from "../../lib/auth/magic-link-sender";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("consoleMagicLinkSender", () => {
  it("logs the email and the sign-in url", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await consoleMagicLinkSender({
      email: "s@example.com",
      url: "http://localhost:3000/api/auth/sh/callback/email?token=abc",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const [logged] = spy.mock.calls[0] as [string];
    expect(logged).toContain("s@example.com");
    expect(logged).toContain(
      "http://localhost:3000/api/auth/sh/callback/email?token=abc",
    );
  });
});
