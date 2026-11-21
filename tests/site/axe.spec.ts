import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { discoverRoutes } from "../../scripts/routes.ts";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 720 },
] as const;

const THEME_MODES = [
  { name: "OS light", osScheme: "light", savedTheme: null },
  { name: "OS dark", osScheme: "dark", savedTheme: null },
  { name: "saved light (overriding dark OS)", osScheme: "dark", savedTheme: "light" },
  { name: "saved dark (overriding light OS)", osScheme: "light", savedTheme: "dark" },
] as const;

const routes = discoverRoutes();

test.describe("axe accessibility audit", () => {
  for (const route of routes) {
    for (const viewport of VIEWPORTS) {
      test(`${route} has no axe violations at ${viewport.name} width in both themes (OS and saved choice)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        for (const mode of THEME_MODES) {
          await test.step(mode.name, async () => {
            await page.emulateMedia({ colorScheme: mode.osScheme });
            await page.goto(route);
            await page.evaluate((saved) => {
              if (saved) {
                localStorage.setItem("theme", saved);
                document.documentElement.dataset.theme = saved;
              } else {
                localStorage.removeItem("theme");
                delete document.documentElement.dataset.theme;
              }
            }, mode.savedTheme);

            if (mode.savedTheme) {
              await page.reload();
              await expect(page.locator("html")).toHaveAttribute("data-theme", mode.savedTheme);
            } else {
              await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
            }

            const results = await new AxeBuilder({ page }).analyze();
            const summary = results.violations.map(
              (v) =>
                `${v.id} (${v.impact ?? "unknown"}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
            );
            expect(summary, `${route} [${viewport.name}, ${mode.name}] axe violations`).toEqual([]);
          });
        }
      });
    }
  }
});
