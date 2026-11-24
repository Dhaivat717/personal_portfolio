import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const TEXT_EXTENSIONS = new Set([".astro", ".css", ".html", ".js", ".json", ".md", ".mdx", ".mjs", ".svg", ".ts", ".tsx"]);
const EM_DASH_PATTERN = /—|&mdash;|&#8212;|&#x2014;|\\u2014/i;

function listTextFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    const normalized = entry.replace(/\\/g, "/");
    if (TEXT_EXTENSIONS.has(extname(normalized).toLowerCase())) {
      results.push(join(dir, normalized));
    }
  }
  return results;
}

describe("site copy typography", () => {
  test("contains zero em dashes across src/ and functions/", () => {
    const violations: string[] = [];

    for (const dir of ["src", "functions"]) {
      for (const file of listTextFiles(join(root, dir))) {
        const lines = readFileSync(file, "utf8").split(/\r?\n/);
        lines.forEach((line, idx) => {
          if (EM_DASH_PATTERN.test(line)) {
            violations.push(`${file.slice(root.length + 1)}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });
});
