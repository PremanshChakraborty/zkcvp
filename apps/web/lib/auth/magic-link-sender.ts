// apps/web/lib/auth/magic-link-sender.ts

/** docs/architecture.md, "Why email delivery is a seam". */
export type MagicLinkSender = (args: {
  email: string;
  url: string;
}) => Promise<void>;

/**
 * The only implementation that ships. Adding Resend or SMTP later is one
 * function and one env value — the provider, adapter, token table, and tests
 * stay untouched.
 */
export const consoleMagicLinkSender: MagicLinkSender = async ({
  email,
  url,
}) => {
  console.log(`[magic-link] sign-in requested for ${email}: ${url}`);
};

/**
 * A function rather than a constant, matching env()'s own rationale — the
 * seam this returns through will eventually read env.ts to pick a real
 * provider, so it must not be decided at import/build time.
 */
export function getMagicLinkSender(): MagicLinkSender {
  return consoleMagicLinkSender;
}
