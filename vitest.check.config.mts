import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Used by `npm run check`: runs the spec tests and evals that `npm test` skips.
// Standalone rather than merged with vitest.config.mts, because merging would
// keep that file's `specs/**` exclusion.
export default defineConfig({
  plugins: [react()],
  // Kept inside the checkout so parallel grading runs don't share a cache.
  cacheDir: ".vitest-cache/vite",
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "specs/**/tests/**/*.test.{ts,tsx}",
      "specs/**/evals/**/*.eval.{ts,tsx}",
    ],
    exclude: ["node_modules/**", ".next/**"],
  },
});
