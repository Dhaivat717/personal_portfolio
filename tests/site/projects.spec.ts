import { expect, test } from "@playwright/test";

test("/projects lists each Personal project as a row that opens its Deep dive", async ({ page }) => {
  const res = await page.goto("/projects");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle("Projects · Dhaivat Patel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Projects");
  await expect(page.locator(".list")).toHaveCSS("border-top-width", "1px");

  const row = page.getByRole("main").getByRole("link", { name: /WhatsApp Auto-Wish Bot/ });
  await expect(row).toHaveAttribute("href", "/projects/whatsapp-auto-wish-bot");
  // Icon tile, name, pitch, stack chips and "read →".
  await expect(row.locator("svg")).toBeVisible();
  await expect(row.getByRole("heading", { name: "WhatsApp Auto-Wish Bot" })).toBeVisible();
  await expect(row.getByRole("list", { name: "Stack" }).getByRole("listitem").first()).toBeVisible();
  await expect(row).toContainText("read →");

  await row.click();
  await expect(page).toHaveURL(/\/projects\/whatsapp-auto-wish-bot$/);
});

test("a Deep dive shows its title, pitch and body, and links back to Projects", async ({ page }) => {
  const res = await page.goto("/projects/whatsapp-auto-wish-bot");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle("WhatsApp Auto-Wish Bot · Dhaivat Patel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("WhatsApp Auto-Wish Bot");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /wishes on WhatsApp/);
  await expect(page.getByRole("link", { name: "← Projects" })).toHaveAttribute("href", "/projects");
});

test.describe("a Deep dive's table of contents and headings", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("has one h1, then exactly the five spine h2s in order", async ({ page }) => {
    await page.goto("/projects/whatsapp-auto-wish-bot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
      "Problem",
      "Architecture",
      "Approach",
      "Results",
      "What I learned",
    ]);
  });

  test("stays in view while scrolling", async ({ page }) => {
    await page.goto("/projects/whatsapp-auto-wish-bot");
    const toc = page.getByRole("navigation", { name: "On this page" });
    await page.getByRole("heading", { name: "What I learned" }).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 10_000);
    await expect(toc).toBeInViewport();
    await expect(toc.getByRole("link", { name: "Problem" })).toBeInViewport();
  });

  test("links work by keyboard", async ({ page }) => {
    await page.goto("/projects/whatsapp-auto-wish-bot");
    const link = page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Results" });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#results$/);
    await expect(page.getByRole("heading", { level: 2, name: "Results" })).toBeInViewport();
  });

  test("highlights the active section in the accent color as the reader scrolls", async ({ page }) => {
    await page.goto("/projects/whatsapp-auto-wish-bot");
    const toc = page.getByRole("navigation", { name: "On this page" });
    const problemLink = toc.getByRole("link", { name: "Problem" });
    const architectureLink = toc.getByRole("link", { name: "Architecture" });
    const learnedLink = toc.getByRole("link", { name: "What I learned" });

    // At the top of the page, Problem is highlighted.
    await expect(problemLink).toHaveAttribute("aria-current", "location");
    await expect(architectureLink).not.toHaveAttribute("aria-current", "location");

    // Scroll to Architecture: Architecture becomes active and styled in the accent color.
    await page.getByRole("heading", { level: 2, name: "Architecture" }).evaluate((el) => {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "instant" });
    });
    await expect(architectureLink).toHaveAttribute("aria-current", "location");
    await expect(problemLink).not.toHaveAttribute("aria-current", "location");

    const { activeColor, mutedColor } = await page.evaluate(() => {
      const active = document.querySelector('.toc a[aria-current="location"]');
      const inactive = document.querySelector('.toc a:not([aria-current="location"])');
      return {
        activeColor: active ? getComputedStyle(active).color : "",
        mutedColor: inactive ? getComputedStyle(inactive).color : "",
      };
    });
    expect(activeColor).not.toBe(mutedColor);

    // Scrolling to the bottom highlights What I learned.
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    });
    await expect(learnedLink).toHaveAttribute("aria-current", "location");
  });
});
