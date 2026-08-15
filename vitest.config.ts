import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import path from "path";

config({ path: "./packages/db/.env" });

export default defineConfig({
  resolve: {
    alias: {
      "next/server": path.resolve(__dirname, "./vitest-mocks/next-server.ts"),
      "next/headers": path.resolve(__dirname, "./vitest-mocks/next-headers.ts"),
    },
  },
  test: {
    include: ["{apps,packages}/*/tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    /* The design system has its own render check (`npm run verify -w
     * @zkcvp/design-system-ledger`) which server-renders real markup. It is not
     * a Vitest suite and is not collected here. */
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
});
