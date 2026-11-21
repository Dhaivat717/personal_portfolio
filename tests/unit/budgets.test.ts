import { describe, expect, test } from "vitest";
import {
  budgetCategoryForRoute,
  compressedSize,
  evaluateBudgets,
  type BudgetsConfig,
  type LoadedResource,
} from "../../scripts/budgets.ts";

const BUDGETS: BudgetsConfig = {
  home: { jsKb: 60, firstLoadKb: 500 },
  projects: { jsKb: 15, firstLoadKb: 800 },
  deepDive: { jsKb: 15, firstLoadKb: 800 },
};

describe("budgetCategoryForRoute", () => {
  test("maps Home, /projects, and Deep dives to their budget categories", () => {
    expect(budgetCategoryForRoute("/")).toBe("home");
    expect(budgetCategoryForRoute("/projects")).toBe("projects");
    expect(budgetCategoryForRoute("/projects/whatsapp-auto-wish-bot")).toBe("deepDive");
    expect(budgetCategoryForRoute("/404")).toBeNull();
  });
});

describe("compressedSize", () => {
  test("compresses repetitive text and never inflates incompressible binary data", () => {
    const repetitive = Buffer.from("console.log('hello');\n".repeat(200));
    expect(compressedSize(repetitive)).toBeLessThan(repetitive.byteLength / 4);

    const tiny = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(compressedSize(tiny)).toBe(4);
  });
});

describe("evaluateBudgets", () => {
  test("passes when JS and first-load compressed bytes are within budget", () => {
    const resources: LoadedResource[] = [
      { url: "http://localhost:8788/", resourceType: "document", contentType: "text/html", compressedBytes: 4_000 },
      { url: "http://localhost:8788/_astro/nav.js", resourceType: "script", contentType: "text/javascript", compressedBytes: 2_000 },
      { url: "http://localhost:8788/fonts/inter.woff2", resourceType: "font", contentType: "font/woff2", compressedBytes: 30_000 },
    ];

    const result = evaluateBudgets("home", resources, BUDGETS);
    expect(result.violations).toEqual([]);
    expect(result.jsBytes).toBe(2_000);
    expect(result.firstLoadBytes).toBe(36_000);
  });

  test("excludes video clips from first-load budget on /projects and Deep dives", () => {
    const resources: LoadedResource[] = [
      { url: "http://localhost:8788/projects/bot", resourceType: "document", contentType: "text/html", compressedBytes: 5_000 },
      { url: "http://localhost:8788/projects/bot/hero.mp4", resourceType: "media", contentType: "video/mp4", compressedBytes: 2_000_000 },
      { url: "http://localhost:8788/projects/bot/demo.webm", resourceType: "other", contentType: "video/webm", compressedBytes: 1_500_000 },
    ];

    const result = evaluateBudgets("deepDive", resources, BUDGETS);
    expect(result.violations).toEqual([]);
    expect(result.firstLoadBytes).toBe(5_000);
  });

  test("fails with clear messages when JS or first-load budget is exceeded", () => {
    const resources: LoadedResource[] = [
      { url: "http://localhost:8788/projects", resourceType: "document", contentType: "text/html", compressedBytes: 850 * 1024 },
      { url: "http://localhost:8788/_astro/heavy.js", resourceType: "script", contentType: "application/javascript", compressedBytes: 20 * 1024 },
    ];

    const result = evaluateBudgets("projects", resources, BUDGETS);
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0]).toMatch(/JS/i);
    expect(result.violations[0]).toMatch(/15 KB/);
    expect(result.violations[1]).toMatch(/first load/i);
    expect(result.violations[1]).toMatch(/800 KB/);
  });
});
