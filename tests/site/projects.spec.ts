import { expect, test } from "@playwright/test";

test("/projects lists each Personal project as a row that opens its Deep dive", async ({ page }) => {
  const res = await page.goto("/projects");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle("Projects · Dhaivat Patel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Projects.");

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
});
