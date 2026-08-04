// apps/web/lib/auth/developer.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { createDb } from "@zkcvp/db";
import { env } from "../env";
import { baseAuthConfig } from "./base-config";
import { developerSessionFromToken } from "./developer-session";
import { IdentityStoreUnavailable } from "./errors";
import { upsertDeveloperAndAcceptInvites } from "./identity";

interface RawGitHubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

/**
 * GitHub provider, no adapter, JWT strategy — see docs/architecture.md, M3.
 * No adapter means Auth.js never tries to create a user row itself; the
 * `developers` upsert happens in the `signIn` callback below, and the
 * developer's own live GitHub access token is retained only in the
 * encrypted JWE session cookie (`jwt`/`session` callbacks), never persisted
 * to a table — see "Token custody" in README.md.
 */
export const {
  handlers: developerHandlers,
  auth: developerAuth,
  signIn: developerSignIn,
  signOut: developerSignOut,
} = NextAuth(() => {
  const e = env();
  return {
    ...baseAuthConfig({ prefix: "dev", secret: e.AUTH_SECRET }),
    basePath: "/api/auth/dev",
    providers: [
      GitHub({
        /* Left blank until Gate B (see docs/architecture.md) — an empty
         * client id/secret only breaks the actual GitHub OAuth redirect,
         * never module load, so the stakeholder instance keeps working. */
        clientId: e.AUTH_GITHUB_ID ?? "",
        clientSecret: e.AUTH_GITHUB_SECRET ?? "",
        /* Exactly the scope plan 01 asks for — no broader "user:email" or
         * similar, since developers carry no email in this design. */
        authorization: { params: { scope: "repo" } },
      }),
    ],
    callbacks: {
      async signIn({ user, profile }) {
        /* A missing profile IS a genuine refusal — GitHub told us nothing to
         * identify this person by, so there is no developer to sign in. */
        if (!profile) return false;
        const github = profile as unknown as RawGitHubProfile;

        let developerId: string;
        try {
          const db = createDb(e.DATABASE_URL);
          ({ developerId } = await upsertDeveloperAndAcceptInvites(db, {
            githubUserId: String(github.id),
            githubUsername: github.login,
            displayName: github.name ?? github.login,
            avatarUrl: github.avatar_url,
          }));
        } catch (cause) {
          /* Not a denial — we could not reach the identity store. Logged with
           * the GitHub id (never the token) so the failure is attributable
           * without leaking a credential. See errors.ts. */
          console.error(
            `[auth][dev] identity store unavailable for github_user_id=${github.id}`,
            cause,
          );
          throw new IdentityStoreUnavailable("developer upsert failed", {
            cause,
          });
        }

        /* Mutating `user` here and reading it back in `jwt` below relies on
         * Auth.js passing the same object reference through both callbacks
         * when no adapter is configured (verified against
         * @auth/core/lib/actions/callback/index.js and handle-login.js). */
        (user as unknown as Record<string, unknown>).developerId = developerId;
        return true;
      },
      async jwt({ token, user, account }) {
        if (user) {
          token.developerId = (user as unknown as Record<string, unknown>)
            .developerId as string;
        }
        if (account?.access_token) {
          token.githubAccessToken = account.access_token;
        }
        return token;
      },
      async session({ session, token }) {
        /* Deliberately does NOT carry githubAccessToken — this object is
         * serialised to JSON at /api/auth/dev/session. See
         * developer-session.ts and tests/auth/token-custody.test.ts. */
        return developerSessionFromToken(session, token);
      },
    },
  };
});
