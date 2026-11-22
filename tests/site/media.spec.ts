import { expect, test, type Locator, type Page } from "@playwright/test";

const DEEP_DIVE = "/projects/whatsapp-auto-wish-bot";

/** The nth clip figure on the page (0 = summary hero clip, 1 = Results clip). */
function clipFigureAt(page: Page, index: number): Locator {
  return page.getByRole("figure").filter({ has: page.locator("video") }).nth(index);
}

/** The nth clip video on the page. */
function clipAt(page: Page, index: number): Locator {
  return clipFigureAt(page, index).locator("video");
}

/** Every clip file (MP4/WebM) the page has requested so far. */
function trackClipRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (req) => {
    if (/\.(mp4|webm)(\?|$)/.test(req.url())) urls.push(new URL(req.url()).pathname);
  });
  return urls;
}

async function isPlaying(video: Locator): Promise<boolean> {
  return video.evaluate((v: HTMLVideoElement) => !v.paused && !v.ended && v.readyState > 2);
}

test.describe("a clip", () => {
  // Short enough that the Results clip starts well below the fold.
  test.use({ viewport: { width: 1280, height: 400 } });

  test("isn't requested until scrolled near, then plays in view", async ({ page }) => {
    const requested = trackClipRequests(page);
    await page.goto(DEEP_DIVE);
    await page.waitForLoadState("networkidle");
    const results = clipAt(page, 1);
    await expect(results).not.toBeInViewport();
    expect(requested.filter((url) => url.includes("results-demo"))).toEqual([]);

    await results.scrollIntoViewIfNeeded();
    await expect.poll(() => requested.some((url) => url.includes("results-demo"))).toBe(true);
    await expect.poll(() => isPlaying(results)).toBe(true);
  });
});

test.describe("the summary's clip", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("pauses when scrolled out of view", async ({ page }) => {
    await page.goto(DEEP_DIVE);
    const hero = clipAt(page, 0);
    await expect.poll(() => isPlaying(hero)).toBe(true);
    await page.mouse.wheel(0, 3000);
    await expect(hero).not.toBeInViewport();
    await expect.poll(() => hero.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });

  test("has a pause/play button that toggles playback and is reachable by keyboard", async ({ page }) => {
    await page.goto(DEEP_DIVE);
    const hero = clipAt(page, 0);
    await expect.poll(() => isPlaying(hero)).toBe(true);

    const pause = page.getByRole("button", { name: "Pause clip" }).first();
    await expect(pause).toBeVisible();
    for (let i = 0; i < 40 && !(await pause.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(pause).toBeFocused();

    await page.keyboard.press("Enter");
    await expect.poll(() => hero.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    const play = page.getByRole("button", { name: "Play clip" }).first();
    await expect(play).toBeFocused();

    await page.keyboard.press("Space");
    await expect.poll(() => isPlaying(hero)).toBe(true);
    await expect(page.getByRole("button", { name: "Pause clip" }).first()).toBeFocused();
  });
});

test.describe("with prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  test("a clip shows its poster and doesn't autoplay or download", async ({ page }) => {
    const requested = trackClipRequests(page);
    await page.goto(DEEP_DIVE);
    await page.waitForLoadState("networkidle");
    const hero = clipAt(page, 0);
    await expect(hero).toHaveAttribute("poster", /\S/);
    await expect(hero).toBeVisible();
    expect(await hero.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    expect(requested).toEqual([]);
    await expect(page.getByRole("button", { name: "Play clip" }).first()).toBeVisible();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a clip shows its poster and caption", async ({ page, request }) => {
    await page.goto(DEEP_DIVE);
    const figure = clipFigureAt(page, 0);
    await expect(figure.locator("figcaption")).toBeVisible();
    await expect(figure.locator("figcaption")).toHaveText(/\S/);
    const poster = await figure.locator("video").getAttribute("poster");
    expect(poster).toBeTruthy();
    expect((await request.get(poster!)).status()).toBe(200);
    // The button needs JS to work, so it isn't shown without it.
    await expect(figure.getByRole("button")).toHaveCount(0);
  });
});

test("a Deep dive stays within the 15 KB JS and 800 KB first-load budgets", async ({ page }) => {
  // Sizes as served, uncompressed: stricter than the compressed budget.
  const bytes = { js: 0, all: 0 };
  const reads: Promise<void>[] = [];
  page.on("response", (res) => {
    const type = res.request().resourceType();
    if (type === "media") return; // clips don't count toward first load
    reads.push(
      res.body().then(
        (body) => {
          bytes.all += body.length;
          if (type === "script") bytes.js += body.length;
        },
        () => {},
      ),
    );
  });
  await page.goto(DEEP_DIVE);
  await page.waitForLoadState("networkidle");
  await Promise.all(reads);
  const inlineJs = await page.locator("script:not([src])").evaluateAll((els) =>
    els.reduce((sum, el) => sum + new TextEncoder().encode(el.textContent ?? "").length, 0),
  );
  expect(bytes.js + inlineJs).toBeLessThanOrEqual(15_000);
  expect(bytes.all).toBeLessThanOrEqual(800_000);
});
