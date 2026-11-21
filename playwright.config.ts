import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 8788);

// Seam 2: the production build, served by Cloudflare's local runtime.
// Run `npm run build` first; this config only serves `dist/`.
export default defineConfig({
  testDir: "tests/site",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx wrangler pages dev dist --port ${PORT} --binding TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA --binding CONTACT_TO=test-recipient@example.invalid`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
