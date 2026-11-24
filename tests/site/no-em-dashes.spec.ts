import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const distDir = resolve(import.meta.dirname, "../../dist");
const EM_DASH_PATTERN = /—|&mdash;|&#8212;|&#x2014;/i;

function listHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    const normalized = entry.replace(/\\/g, "/");
    if (extname(normalized).toLowerCase() === ".html") {
      results.push(join(dir, normalized));
    }
  }
  return results.sort();
}

test("built HTML pages contain zero em dashes", () => {
  const htmlFiles = listHtmlFiles(distDir);
  expect(htmlFiles.length).toBeGreaterThan(0);

  const violations: string[] = [];
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    const match = html.match(EM_DASH_PATTERN);
    if (match) {
      violations.push(`${file.slice(distDir.length + 1)}: matched ${JSON.stringify(match[0])}`);
    }
  }

  expect(violations).toEqual([]);
});
