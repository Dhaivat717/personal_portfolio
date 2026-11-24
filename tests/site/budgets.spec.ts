import { expect, test } from "@playwright/test";
import {
  budgetCategoryForRoute,
  compressedSize,
  evaluateBudgets,
  isExcludedFromBudget,
  loadBudgets,
  type LoadedResource,
} from "../../scripts/budgets.ts";
import { discoverRoutes } from "../../scripts/routes.ts";

const budgets = loadBudgets();
const budgetedRoutes = discoverRoutes()
  .map((route) => ({ route, category: budgetCategoryForRoute(route) }))
  .filter((entry): entry is { route: string; category: NonNullable<typeof entry.category> } => entry.category !== null);

test.describe("compressed size budgets", () => {
  for (const { route, category } of budgetedRoutes) {
    test(`${route} stays within its ${category} JS and first-load budgets`, async ({ page }) => {
      const resources: LoadedResource[] = [];
      const pending: Promise<void>[] = [];

      page.on("response", (response) => {
        const status = response.status();
        if (status >= 300 && status < 400) return;

        const resourceType = response.request().resourceType();
        const contentType = response.headers()["content-type"] ?? "";
        const url = response.url();
        // Clips are excluded from non-home budgets and Chromium may hold open
        // partial-content (206) streams for longer videos, causing response.body() to hang.
        if (isExcludedFromBudget(category, { url, resourceType, contentType })) return;

        pending.push(
          response
            .body()
            .then((body) => {
              resources.push({
                url,
                resourceType,
                contentType,
                compressedBytes: compressedSize(body),
              });
            })
            .catch(() => {
              // Ignore responses without readable bodies (e.g. aborted prefetches).
            }),
        );
      });

      await page.goto(route, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {
        // Third-party widgets (e.g. Cloudflare Turnstile) may keep background connections open.
      });
      await Promise.all(pending);

      const evaluation = evaluateBudgets(category, resources, budgets);
      expect(resources.length, `${route} should load at least one resource`).toBeGreaterThan(0);
      expect(evaluation.violations, `${route} size budget violations`).toEqual([]);
    });
  }
});
