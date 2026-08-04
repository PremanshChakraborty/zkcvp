// apps/web/app/login/email/actions.ts
"use server";

import { stakeholderSignIn } from "../../../lib/auth/stakeholder";

export type RequestMagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function requestMagicLink(
  _prevState: RequestMagicLinkState,
  formData: FormData,
): Promise<RequestMagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { status: "error", message: "Enter your email address." };
  }

  try {
    /* redirect: false — this app has no separate "check your email" route;
     * the confirmation renders inline on this same page (see page.tsx). The
     * console sender is the only MagicLinkSender that ships, so "sent" here
     * means "printed to the server console", not "delivered". */
    await stakeholderSignIn("email", { email, redirect: false });
    return { status: "sent", email };
  } catch {
    return {
      status: "error",
      message: "Something went wrong sending the link. Try again.",
    };
  }
}
