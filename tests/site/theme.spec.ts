import { expect, test } from "@playwright/test";

// Expected values come from the spec: light accent #c2410c, dark accent #ff8a3d.
const themes = [
  { scheme: "light", background: "rgb(255, 255, 255)", accent: "rgb(194, 65, 12)" },
  { scheme: "dark", background: "rgb(0, 0, 0)", accent: "rgb(255, 138, 61)" },
] as const;

for (const { scheme, background, accent } of themes) {
  test(`follows the OS ${scheme} setting`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", background);
    await expect(page.locator("[data-hero]").getByText("Amazon Ads", { exact: true })).toHaveCSS("color", accent);
  });
}

test("the focus ring is a 2px solid accent outline with a 2px offset", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toHaveCSS("outline", "2px solid rgb(194, 65, 12)");
  await expect(skip).toHaveCSS("outline-offset", "2px");
});
