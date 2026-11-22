import { expect, test, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startWrangler } from "./wrangler-helper";

interface TrackedEvent {
  event: string;
  data?: Record<string, string>;
}

const UMAMI_SELECTOR = 'script[src="https://cloud.umami.is/script.js"][data-website-id]';
const CF_BEACON_SELECTOR =
  'script[src="https://static.cloudflareinsights.com/beacon.min.js"][data-cf-beacon]';

async function stubUmami(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as {
      __umamiEvents: Array<{ event: string; data?: Record<string, string> }>;
      umami: { track: (event: string, data?: Record<string, string>) => void };
    };
    win.__umamiEvents = [];
    win.umami = {
      track(event: string, data?: Record<string, string>) {
        win.__umamiEvents.push(data ? { event, data } : { event });
      },
    };
  });
}

async function trackedEvents(page: Page): Promise<TrackedEvent[]> {
  return page.evaluate(
    () => (window as unknown as { __umamiEvents: TrackedEvent[] }).__umamiEvents,
  );
}

async function serveBuiltSite(siteEnv: string | undefined): Promise<{
  baseUrl: string;
  stop: () => Promise<void>;
}> {
  const outDir = await mkdtemp(join(tmpdir(), "portfolio-analytics-dist-"));

  const buildEnv: Record<string, string | undefined> = {
    ...process.env,
    SHOW_DRAFTS: "false",
    SITE_ENV: siteEnv,
    NO_COLOR: "1",
  };
  const filteredEnv = Object.fromEntries(
    Object.entries(buildEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  const build = spawnSync("npx", ["astro", "build", "--outDir", outDir], {
    encoding: "utf8",
    env: filteredEnv,
  });
  if (build.status !== 0) {
    await rm(outDir, { recursive: true, force: true });
    throw new Error(`astro build failed (${build.status}):\n${build.stdout}\n${build.stderr}`);
  }

  const stubPort = Number(
    process.env.PLAYWRIGHT_EMAIL_PORT ?? Number(process.env.PLAYWRIGHT_PORT ?? 8788) + 1,
  );
  const srv = await startWrangler(
    {
      GITHUB_TOKEN: "ghp_test_token",
      GITHUB_API_URL: `http://127.0.0.1:${stubPort}/graphql`,
    },
    { outDir },
  );

  return {
    baseUrl: srv.baseUrl,
    stop: async () => {
      await srv.stop();
      await rm(outDir, { recursive: true, force: true });
    },
  };
}

test.describe("production-only analytics scripts", () => {
  test("renders Umami and Cloudflare Web Analytics only when SITE_ENV=production", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Abort third-party analytics fetches so the assertion is purely about served markup.
    await page.route(/cloud\.umami\.is|cloudflareinsights\.com/, (route) => route.abort());

    const isDefaultProd = process.env.SITE_ENV === "production";
    const expectedOnDefault = isDefaultProd ? 1 : 0;

    for (const route of ["/", "/projects", "/projects/whatsapp-auto-wish-bot"]) {
      await page.goto(route);
      await expect(page.locator(UMAMI_SELECTOR)).toHaveCount(expectedOnDefault);
      await expect(page.locator(CF_BEACON_SELECTOR)).toHaveCount(expectedOnDefault);
    }

    // Verify the opposite environment via a real built + Wrangler-served site (Seam 2).
    const oppositeEnv = isDefaultProd ? undefined : "production";
    const expectedOnOpposite = isDefaultProd ? 0 : 1;
    const srv = await serveBuiltSite(oppositeEnv);
    try {
      for (const route of ["/", "/projects", "/projects/whatsapp-auto-wish-bot"]) {
        await page.goto(`${srv.baseUrl}${route}`);
        await expect(page.locator(UMAMI_SELECTOR)).toHaveCount(expectedOnOpposite);
        await expect(page.locator(CF_BEACON_SELECTOR)).toHaveCount(expectedOnOpposite);
      }
    } finally {
      await srv.stop();
    }
  });
});

test.describe("analytics custom events", () => {
  test("fires resume-download when clicking the Résumé link", async ({ page }) => {
    await stubUmami(page);
    await page.goto("/");

    const resumeLink = page.getByRole("link", { name: "Résumé", exact: true }).first();
    await resumeLink.evaluate((el) => {
      el.addEventListener("click", (e) => e.preventDefault(), { once: true });
    });
    await resumeLink.click();

    expect(await trackedEvents(page)).toEqual([{ event: "resume-download" }]);
  });

  test("fires outbound-click with target for github, linkedin, code-repo, itch, and email links", async ({
    page,
  }) => {
    await stubUmami(page);
    await page.goto("/");

    for (const [label, expectedTarget] of [
      ["GitHub", "github"],
      ["LinkedIn", "linkedin"],
    ] as const) {
      const link = page.locator("footer").getByRole("link", { name: label });
      await link.evaluate((el) => {
        el.addEventListener("click", (e) => e.preventDefault(), { once: true });
      });
      await link.click();
      expect(await trackedEvents(page)).toContainEqual({
        event: "outbound-click",
        data: { target: expectedTarget },
      });
    }

    // Deep dive MetaStrip: Code ↗ -> code-repo
    await page.goto("/projects/whatsapp-auto-wish-bot");
    const codeLink = page.locator(".meta").getByRole("link", { name: /Code/ });
    await codeLink.evaluate((el) => {
      el.addEventListener("click", (e) => e.preventDefault(), { once: true });
    });
    await codeLink.click();

    // itch.io and mailto: links classified by the delegated tracker
    await page.locator(".meta .links").evaluate((container) => {
      const itch = document.createElement("a");
      itch.href = "https://dhaivat.itch.io/demo";
      itch.textContent = "Play in browser";
      itch.addEventListener("click", (e) => e.preventDefault());
      container.append(itch);

      const email = document.createElement("a");
      email.href = "mailto:test@example.invalid";
      email.textContent = "Email";
      email.addEventListener("click", (e) => e.preventDefault());
      container.append(email);
    });
    await page.getByRole("link", { name: "Play in browser" }).click();
    await page.getByRole("link", { name: "Email" }).click();

    expect(await trackedEvents(page)).toEqual([
      { event: "outbound-click", data: { target: "code-repo" } },
      { event: "outbound-click", data: { target: "itch" } },
      { event: "outbound-click", data: { target: "email" } },
    ]);
  });

  test("fires deep-dive-read once after scrolling past Results on a Deep dive", async ({ page }) => {
    await stubUmami(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/projects/whatsapp-auto-wish-bot");

    // Not fired while at the top of the page.
    await page.waitForTimeout(200);
    expect(await trackedEvents(page)).toEqual([]);

    // Scroll past Results into What I learned.
    await page.locator("#what-i-learned").scrollIntoViewIfNeeded();
    await expect.poll(() => trackedEvents(page)).toEqual([{ event: "deep-dive-read" }]);

    // Scrolling back up and down again does not fire a second time.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.locator("#what-i-learned").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    expect(await trackedEvents(page)).toEqual([{ event: "deep-dive-read" }]);
  });

  test("does not fire contact-sent on Turnstile verification failure", async ({ page }) => {
    await stubUmami(page);
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Human verification failed. Please try again.",
        }),
      }),
    );

    await page.goto("/");
    const section = page.locator("#contact");
    await section.getByLabel("Name").fill("Ada Lovelace");
    await section.getByLabel("Email").fill("ada@example.test");
    await section.getByLabel("Message").fill("Testing Turnstile failure.");
    await section.getByRole("button", { name: /send/i }).click();

    await expect(section.getByRole("status")).toContainText(/verification/i);
    expect(await trackedEvents(page)).toEqual([]);
  });
});
