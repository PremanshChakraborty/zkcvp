// apps/web/lib/auth/magic-link-sender.ts
import nodemailer from "nodemailer";
import { env } from "../env";

/** docs/architecture.md, "Why email delivery is a seam". */
export type MagicLinkSender = (args: {
  email: string;
  url: string;
}) => Promise<void>;

/**
 * The development implementation. Keeps the full stakeholder flow demoable
 * with zero external configuration — no mailbox, no credentials, no network.
 */
export const consoleMagicLinkSender: MagicLinkSender = async ({
  email,
  url,
}) => {
  console.log(`[magic-link] sign-in requested for ${email}: ${url}`);
};

const SUBJECT = "Your sign-in link";

/**
 * SMTP delivery against an ordinary mailbox. Deliberately not next-auth's
 * Nodemailer() provider factory: delivery here is a plain seam, and
 * StakeholderEmailProvider stays a hand-built `type: "email"` config with no
 * SMTP-shaped surface of its own.
 *
 * Reads env() per call rather than building a module-scoped transport, for the
 * reason env() itself documents — configuration must not be captured at
 * import time, or one build artifact behaves differently on two hosts.
 */
export const smtpMagicLinkSender: MagicLinkSender = async ({ email, url }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = env();

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    /* 465 is implicit TLS; 587 upgrades via STARTTLS. */
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  await transport.sendMail({
    to: email,
    from: EMAIL_FROM,
    subject: SUBJECT,
    text: `Sign in to Ledger:\n\n${url}\n\nThis link expires in 24 hours. If you did not request it, ignore this message.`,
    html: `<p>Sign in to Ledger:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours. If you did not request it, ignore this message.</p>`,
  });
};

/**
 * A function rather than a constant, matching env()'s own rationale — the
 * choice must be made when it is used, never at import or build time.
 *
 * SMTP_HOST alone selects. env() has already rejected a half-configured
 * mailbox by this point, so a set host means a complete one.
 */
export function getMagicLinkSender(): MagicLinkSender {
  return env().SMTP_HOST ? smtpMagicLinkSender : consoleMagicLinkSender;
}
