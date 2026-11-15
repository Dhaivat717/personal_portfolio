import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 390, height: 844 };

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });

for (const path of ["/", "/no-such-page"]) {
  test(`on ${path} the nav's name links Home and its Section links go to Home anchors`, async ({ page }) => {
    await page.goto(path);
    const nav = mainNav(page);
    await expect(nav.getByRole("link", { name: "Dhaivat Patel" })).toHaveAttribute("href", "/");
    await expect(nav.getByRole("link", { name: "Experience" })).toHaveAttribute("href", "/#experience");
    await expect(nav.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/#contact");
  });
}

const GLASS = { light: "rgba(255, 255, 255, 0.72)", dark: "rgba(0, 0, 0, 0.66)" } as const;
const HAIRLINE = { light: "rgb(210, 210, 215)", dark: "rgb(56, 56, 61)" } as const;

for (const path of ["/", "/no-such-page"]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`on ${path} in ${scheme} mode the nav sticks to the top and turns frosted glass once scrolled, without shifting layout`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      // Pages are short today; make them tall enough to scroll.
      await page.addStyleTag({ content: "main { min-height: 300vh; }" });
      const header = page.getByRole("banner");
      const toggle = mainNav(page).getByRole("switch", { name: "Dark mode" });
      await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(header).toHaveCSS("backdrop-filter", "none");
      await expect(toggle).toBeVisible();
      const before = await header.boundingBox();
      expect(before?.y).toBe(0);

      await page.mouse.wheel(0, 600);
      await expect(header).toHaveCSS("background-color", GLASS[scheme]);
      await expect(header).toHaveCSS("backdrop-filter", /blur\(20px\)/);
      await expect(header).toHaveCSS("border-bottom-color", HAIRLINE[scheme]);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      expect(await header.boundingBox()).toEqual(before);
      await expect(toggle).toBeInViewport();

      await page.mouse.wheel(0, -600);
      await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    });
  }
}

test("the Résumé button links to /resume.pdf, which is served as a PDF", async ({ page, request }) => {
  await page.goto("/");
  await expect(mainNav(page).getByRole("link", { name: "Résumé" })).toHaveAttribute("href", "/resume.pdf");
  const res = await request.get("/resume.pdf");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("tab order runs Skip to content → name → Section links → Résumé → Dark mode switch, all inside the nav", async ({ page }) => {
  await page.goto("/");
  const nav = mainNav(page);
  await expect(nav.getByRole("switch", { name: "Dark mode" })).toBeVisible();
  const order = [
    page.getByRole("link", { name: "Skip to content" }),
    nav.getByRole("link", { name: "Dhaivat Patel" }),
    nav.getByRole("link", { name: "Experience" }),
    nav.getByRole("link", { name: "Contact" }),
    nav.getByRole("link", { name: "Résumé" }),
    nav.getByRole("switch", { name: "Dark mode" }),
  ];
  for (const el of order) {
    await page.keyboard.press("Tab");
    await expect(el).toBeFocused();
  }
});

test.describe("at phone width", () => {
  test.use({ viewport: PHONE });

  test("the links collapse into a keyboard-operable menu that closes on Esc", async ({ page }) => {
    await page.goto("/no-such-page");
    const nav = mainNav(page);
    const menu = nav.getByRole("button", { name: "Menu" });
    const experience = nav.getByRole("link", { name: "Experience" });

    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(experience).toBeHidden();

    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(experience).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Contact" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Résumé" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(experience).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await experience.click();
    await expect(page).toHaveURL("/#experience");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  test("the Dark mode switch stays in the bar next to the menu button, one tap away", async ({ page }) => {
    await page.goto("/");
    const nav = mainNav(page);
    const menu = nav.getByRole("button", { name: "Menu" });
    const toggle = nav.getByRole("switch", { name: "Dark mode" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByRole("link", { name: "Résumé" })).toBeHidden();
    await expect(toggle).toBeVisible();
    // In the 52px bar, within the viewport, beside the menu button.
    const box = (await toggle.boundingBox())!;
    const menuBox = (await menu.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
    expect(box.y + box.height).toBeLessThanOrEqual(52);
    expect(box.x - (menuBox.x + menuBox.width)).toBeLessThan(24);

    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, viewport: PHONE });

  test("every nav link stays reachable at phone width, with no menu button", async ({ page }) => {
    await page.goto("/");
    const nav = mainNav(page);
    await expect(nav.getByRole("button", { name: "Menu" })).toHaveCount(0);
    for (const name of ["Dhaivat Patel", "Experience", "Contact", "Résumé"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width);
  });
});
