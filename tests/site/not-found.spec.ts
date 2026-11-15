import { expect, test } from "@playwright/test";

test("an unknown route returns 404 with a noindex robots meta", async ({ request }) => {
  const res = await request.get("/no-such-page");
  expect(res.status()).toBe(404);
  expect(await res.text()).toMatch(/<meta name="robots" content="noindex"/);
});

test("the Not Found page links to Home and Projects", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("main").getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
});
