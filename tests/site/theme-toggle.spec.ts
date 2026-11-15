import { expect, test } from "@playwright/test";

const BLACK = "rgb(0, 0, 0)";
const WHITE = "rgb(255, 255, 255)";

test("in light mode the Dark mode switch is off, and switching it on turns the page dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
});

test("in dark mode the Dark mode switch is on, and switching it off turns the page light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator("body")).toHaveCSS("background-color", WHITE);
});

test("the switch works from the keyboard", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(toggle).not.toBeChecked();
});

test("the chosen theme is remembered across pages and reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page.reload();
  await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
  await expect(page.getByRole("switch", { name: "Dark mode" })).toBeChecked();
  await page.goto("/no-such-page");
  await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the switch is hidden and the page still follows the OS theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(page.locator("body")).toHaveCSS("background-color", BLACK);
  });
});
