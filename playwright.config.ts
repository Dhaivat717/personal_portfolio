import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 8788);
const EMAIL_PORT = Number(process.env.PLAYWRIGHT_EMAIL_PORT ?? PORT + 1);

// Seam 2: the production build, served by Cloudflare's local runtime.
// Run `npm run build` first; this config only serves `dist/`.
export default defineConfig({
  testDir: "tests/site",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node tests/site/email-stub.mjs ${EMAIL_PORT}`,
      url: `http://127.0.0.1:${EMAIL_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      command: `npx wrangler pages dev dist --port ${PORT} --binding TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA --binding CONTACT_TO=test-recipient@example.invalid --binding RESEND_API_KEY=re_test_key --binding EMAIL_API_URL=http://127.0.0.1:${EMAIL_PORT}/emails --binding GITHUB_TOKEN=ghp_test_token --binding GITHUB_API_URL=http://127.0.0.1:${EMAIL_PORT}/graphql`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
