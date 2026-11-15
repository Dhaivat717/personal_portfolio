import { expect, test } from "@playwright/test";

const BLACK = "rgb(0, 0, 0)";
const WHITE = "rgb(255, 255, 255)";

test("in light mode the toggle offers dark mode, and clicking it switches the page to dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Switch to dark mode" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
});

test("in dark mode the toggle offers light mode, and clicking it switches the page to light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("body")).toHaveCSS("background-color", WHITE);
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});

test("the chosen theme is remembered across pages and reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
  await page.goto("/no-such-page");
  await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
});

test("the toggle comes after 'Skip to content' in the tab order", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Switch to (dark|light) mode/ })).toBeFocused();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the toggle is hidden and the page still follows the OS theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Switch to/ })).toHaveCount(0);
    await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
  });
});
