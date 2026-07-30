/** Minimal class joiner. Drops falsy entries; no dedupe, no conditional object syntax. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
