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
