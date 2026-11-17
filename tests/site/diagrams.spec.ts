import { expect, test, type Page } from "@playwright/test";

/** Every Deep dive the site serves, found from /projects rather than a hand-kept list. */
async function deepDives(page: Page): Promise<string[]> {
  await page.goto("/projects");
  const hrefs = await page
    .getByRole("main")
    .locator('a[href^="/projects/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
  return [...new Set(hrefs)];
}

test("every diagram on every Deep dive is an image with a non-empty accessible name", async ({ page }) => {
  const routes = await deepDives(page);
  expect(routes.length).toBeGreaterThan(0);
  for (const route of routes) {
    await page.goto(route);
    const diagrams = page.locator("[data-diagram] svg");
    // The build guarantees at least one, in Architecture.
    expect(await diagrams.count(), route).toBeGreaterThan(0);
    for (const svg of await diagrams.all()) {
      await expect(svg, route).toHaveAttribute("role", "img");
      await expect(svg, route).toHaveAccessibleName(/\S/);
    }
  }
});

test.describe("the seed project's architecture diagram", () => {
  const route = "/projects/whatsapp-auto-wish-bot";

  test("sits in the Architecture section, named by its title", async ({ page }) => {
    await page.goto(route);
    const diagram = page.getByRole("img", { name: /^Wish pipeline:/ });
    await expect(diagram).toBeVisible();
    // After the Architecture h2 and before the Approach h2.
    const [h2, svg, next] = await Promise.all(
      [
        page.getByRole("heading", { level: 2, name: "Architecture" }),
        diagram,
        page.getByRole("heading", { level: 2, name: "Approach" }),
      ].map(async (l) => (await l.boundingBox())!.y),
    );
    expect(svg).toBeGreaterThan(h2);
    expect(svg).toBeLessThan(next);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`follows the ${scheme} theme: labels match body text, strokes are visible`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(route);
      const colors = await page.evaluate(() => {
        const svg = document.querySelector("[data-diagram] svg")!;
        const body = getComputedStyle(document.body);
        const label = svg.querySelector(".box:not(.upstream) .label")!;
        const rect = svg.querySelector(".box:not(.accent) rect")!;
        return {
          text: body.color,
          background: body.backgroundColor,
          label: getComputedStyle(label).fill,
          stroke: getComputedStyle(rect).stroke,
        };
      });
      // Labels are drawn in the body text color, whatever the theme.
      expect(colors.label).toBe(colors.text);
      // Strokes are a real color, distinct from the page behind them.
      expect(colors.stroke).toMatch(/^rgb\(/);
      expect(colors.stroke).not.toBe(colors.background);
    });
  }

  test("changes colors with the theme toggle, with no reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(route);
    const stroke = () => page.locator("[data-diagram] .box rect").nth(1).evaluate((r) => getComputedStyle(r).stroke);
    const light = await stroke();
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await expect.poll(stroke).not.toBe(light);
  });
});
