import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{apps,packages}/*/tests/**/*.test.ts"],
    /* The design system has its own render check (`npm run verify -w
     * @zkcvp/design-system-ledger`) which server-renders real markup. It is not
     * a Vitest suite and is not collected here. */
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
});
