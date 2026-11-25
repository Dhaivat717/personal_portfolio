import { expect, test } from "@playwright/test";

const STUB_PORT = Number(
  process.env.PLAYWRIGHT_EMAIL_PORT ?? Number(process.env.PLAYWRIGHT_PORT ?? 8788) + 1,
);
const STUB_BASE = `http://127.0.0.1:${STUB_PORT}`;

test.describe("GET /api/github-stats", () => {
  test("fetches contribution-graph total from GitHub GraphQL API, returns JSON with 1-hour edge cache header, and never leaks GITHUB_TOKEN", async ({
    request,
  }) => {
    const res = await request.get("/api/github-stats");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(res.headers()["cache-control"]).toContain("max-age=3600");

    const rawText = await res.text();
    expect(rawText).not.toContain("ghp_");
    expect(rawText).not.toContain("github_pat_");
    expect(JSON.parse(rawText)).toEqual({ contributions: 30 });

    const capturedRes = await fetch(`${STUB_BASE}/graphql/captured`);
    const captured = (await capturedRes.json()) as Array<{
      method?: string;
      authorization?: string;
      body?: { query?: string; variables?: { login?: string } };
    }>;
    expect(captured.length).toBeGreaterThanOrEqual(1);
    const last = captured[captured.length - 1];
    expect(last.method).toBe("POST");
    expect(last.authorization).toMatch(/^Bearer \S+$/);
    expect(last.body?.query).toContain("totalContributions");
    expect(last.body?.variables?.login).toBe("Dhaivat717");
  });

  test("Home page fetches /api/github-stats after load and swaps the number in place with no layout shift", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Hold the browser's /api/github-stats request briefly so we can measure the baked state first.
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/github-stats", async (route) => {
      await responseGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ contributions: 845 }),
      });
    });

    await page.goto("/");
    const ghStatLink = page.getByRole("link", { name: /GitHub contributions/ });
    const ghStatNum = page.locator("[data-github-contributions]");

    await expect(ghStatNum).toHaveText("30");
    const boxBefore = (await ghStatLink.boundingBox())!;

    releaseResponse();

    await expect(ghStatNum).toHaveText("845");
    const boxAfter = (await ghStatLink.boundingBox())!;
    expect(boxAfter.width).toBe(boxBefore.width);
    expect(boxAfter.height).toBe(boxBefore.height);
    expect(boxAfter.x).toBe(boxBefore.x);
    expect(boxAfter.y).toBe(boxBefore.y);

    expect(await page.content()).not.toContain("ghp_");
    expect(await page.content()).not.toContain("github_pat_");
  });

  test("Home page keeps the baked number with no spinner, blank box, or layout shift when /api/github-stats fails", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route("**/api/github-stats", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ error: "GitHub API returned an error." }),
      }),
    );

    const statsRespPromise = page.waitForResponse((r) =>
      r.url().endsWith("/api/github-stats"),
    );
    await page.goto("/");

    const ghStatLink = page.getByRole("link", { name: /GitHub contributions/ });
    const ghStatNum = page.locator("[data-github-contributions]");
    const boxBefore = (await ghStatLink.boundingBox())!;

    const statsResp = await statsRespPromise;
    expect(statsResp.status()).toBe(502);

    // Give any client handler a tick to settle after the failed response.
    await page.waitForTimeout(100);

    await expect(ghStatNum).toHaveText("30");
    const boxAfter = (await ghStatLink.boundingBox())!;
    expect(boxAfter.width).toBe(boxBefore.width);
    expect(boxAfter.height).toBe(boxBefore.height);
    expect(boxAfter.x).toBe(boxBefore.x);
    expect(boxAfter.y).toBe(boxBefore.y);
  });
});
