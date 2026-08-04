// packages/github/src/index.ts

/**
 * The whole M3 surface: a client constructed from a developer's session
 * access token. No fetch calls, no API methods — those get added as a
 * caller actually needs them (see docs/architecture.md, M3/M4).
 */
export interface GitHubClient {
  readonly accessToken: string;
}

export function createGitHubClient(accessToken: string): GitHubClient {
  if (!accessToken) {
    throw new Error("createGitHubClient requires a non-empty accessToken");
  }
  return { accessToken };
}
