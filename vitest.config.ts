import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/build/**/*.test.ts"],
    // Each test runs a full Astro build.
    testTimeout: 120_000,
  },
});
