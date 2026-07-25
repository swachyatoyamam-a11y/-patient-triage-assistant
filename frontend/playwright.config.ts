import { defineConfig, devices } from "@playwright/test";

/**
 * Requires the full stack running locally: backend on :4000 with a
 * migrated + seeded database, frontend on :3000. See tests/e2e/README.md.
 * Not runnable in CI without that — these are NOT executed as part of
 * `npm test` (that only runs vitest); run explicitly with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
